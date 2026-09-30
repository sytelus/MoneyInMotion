/**
 * Exercise real Express middleware without binding a TCP port. This supplements
 * (not replaces) production socket/browser smoke tests in restricted sandboxes.
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import type { Express } from 'express';

export async function inProcessRequest(
  app: Express,
  method: string,
  url: string,
  options: {
    body?: Buffer | Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<{
  status: number;
  headers: ReturnType<ServerResponse['getHeaders']>;
  body: Record<string, unknown>;
  raw: Buffer;
}> {
  const chunks: Buffer[] = [];
  const socket = new Duplex({
    read() {},
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const req = new IncomingMessage(socket as Socket);
  req.method = method;
  req.url = url;
  req.complete = true;
  req.httpVersion = '1.1';
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;
  req.headers = { host: 'localhost', ...options.headers };
  const input = Buffer.isBuffer(options.body)
    ? options.body
    : options.body
      ? Buffer.from(JSON.stringify(options.body))
      : Buffer.alloc(0);
  if (!Buffer.isBuffer(options.body) && options.body)
    req.headers['content-type'] = 'application/json';
  req.headers['content-length'] = String(input.length);
  const res = new ServerResponse(req);
  res.assignSocket(socket as Socket);
  const finished = new Promise<void>((resolve, reject) => {
    res.once('finish', resolve);
    res.once('error', reject);
    socket.once('error', reject);
  });
  app(req, res);
  req.push(input.length ? input : null);
  if (input.length) req.push(null);
  await finished;
  const wire = Buffer.concat(chunks);
  const raw = wire.subarray(wire.indexOf('\r\n\r\n') + 4);
  const body = String(res.getHeader('content-type')).includes('application/json')
    ? (JSON.parse(raw.toString()) as Record<string, unknown>)
    : {};
  socket.destroy();
  return { status: res.statusCode, headers: res.getHeaders(), body, raw };
}
