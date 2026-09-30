/** Settings backup/restore routes. Uploaded archives stay outside financial data. */
import { Router } from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { BackupService, MAX_BACKUP_BYTES } from '../services/backup-service.js';

export function createBackupsRouter(service: BackupService): Router {
  const router = Router();
  router.get('/', (_req, res) => res.json(service.list()));
  router.post('/', async (_req, res) => res.status(201).json(await service.create()));
  router.get('/download/:name', (req, res) => {
    res.download(service.downloadPath(String(req.params.name)));
  });
  router.post('/preview', async (req, res) => {
    const body = z
      .object({ name: z.string().min(1).max(255) })
      .strict()
      .parse(req.body);
    res.json(await service.preview(body));
  });
  router.post('/preview-upload', (req, res, next) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-backup-upload-'));
    fs.chmodSync(directory, 0o700);
    // Busboy reports partsLimit at the boundary following the final permitted
    // part; leave room for that boundary while files/fields enforce one file.
    const upload = multer({
      dest: directory,
      limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_BACKUP_BYTES },
    });
    // Multer's callback runs after a disconnected upload too. Clean up only here,
    // after its file handles close, not in a socket-close handler racing the writer.
    upload.single('archive')(req, res, (error: unknown) => {
      void (async () => {
        try {
          if (error instanceof multer.MulterError)
            throw Object.assign(
              new Error(
                'Choose one ZIP archive no larger than 2 GiB; extra form fields are not accepted.',
              ),
              { status: 413 },
            );
          if (error)
            throw Object.assign(
              new Error(
                'The server could not stage the ZIP. Check temporary-folder permissions and free disk space, then try again.',
              ),
              { status: 409 },
            );
          if (req.aborted) return;
          if (!req.file)
            throw Object.assign(new Error('Choose a MoneyInMotion backup ZIP.'), { status: 400 });
          res.json(await service.preview({ uploadPath: req.file.path }));
        } catch (failure) {
          next(failure);
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      })();
    });
  });
  router.post('/restore', async (req, res) => {
    const body = z
      .object({ token: z.string().uuid(), confirmUsername: z.string().min(1) })
      .strict()
      .parse(req.body);
    res.json(await service.restore(body.token, body.confirmUsername));
  });
  router.delete('/preview/:token', (req, res) => {
    service.maintenance.assertAvailable();
    service.cancel(String(req.params.token));
    res.json({ cancelled: true });
  });
  // Zod errors are request validation, not unexpected production server faults.
  router.use(
    (
      error: unknown,
      _req: import('express').Request,
      _res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      next(
        error instanceof z.ZodError
          ? Object.assign(new Error('Invalid backup or restore request.'), { status: 400 })
          : error,
      );
    },
  );
  return router;
}
