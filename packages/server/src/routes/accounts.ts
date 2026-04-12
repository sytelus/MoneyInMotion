/**
 * Accounts API routes.
 *
 * GET  /api/accounts - scan statementsDir for AccountConfig.json files
 * POST /api/accounts - create account folder + AccountConfig.json
 *
 * @module
 */

import { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { AccountConfig } from '@moneyinmotion/core';
import type { ServerConfig } from '../config.js';

const ACCOUNT_CONFIG_FILE_NAME = 'AccountConfig.json';

const accountInfoSchema = z.object({
    id: z.string().min(1),
    instituteName: z.string().min(1),
    title: z.string().optional().nullable(),
    type: z.number(),
    requiresParent: z.boolean(),
    interAccountNameTags: z.array(z.string()).optional().nullable(),
});

const accountConfigSchema = z.object({
    accountInfo: accountInfoSchema,
    fileFilters: z.array(z.string()).default(['*.csv']),
    scanSubFolders: z.boolean().default(true),
});

/**
 * Recursively scan a directory tree for AccountConfig.json files.
 */
function scanForAccountConfigs(dirPath: string): AccountConfig[] {
    const results: AccountConfig[] = [];

    if (!fs.existsSync(dirPath)) {
        return results;
    }

    const configPath = path.join(dirPath, ACCOUNT_CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(raw) as AccountConfig;
            results.push(config);
        } catch {
            // Skip malformed config files
        }
    }

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch {
            continue; // Skip entries we can't access
        }
        if (stat.isDirectory()) {
            results.push(...scanForAccountConfigs(fullPath));
        }
    }

    return results;
}

export function createAccountsRouter(getConfig: () => ServerConfig): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const config = getConfig();
        const accounts = scanForAccountConfigs(config.statementsDir);
        res.json(accounts);
    });

    router.post('/', (req, res) => {
        const result = accountConfigSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: result.error.issues.map((i) => i.message).join('; '),
                status: 400,
            });
            return;
        }

        const accountConfig = result.data as AccountConfig;

        // Validate account ID to prevent path traversal
        const accountId = accountConfig.accountInfo.id;
        if (
            !accountId ||
            /[/\\]/.test(accountId) ||
            accountId.includes('..') ||
            !/^[a-zA-Z0-9._-]+$/.test(accountId)
        ) {
            res.status(400).json({
                error: 'Invalid account ID: must contain only alphanumeric characters, hyphens, underscores, and dots, and must not contain path separators or ".."',
                status: 400,
            });
            return;
        }

        const config = getConfig();

        // Create account folder named by account id
        const accountDir = path.join(
            config.statementsDir,
            accountConfig.accountInfo.id,
        );
        if (!fs.existsSync(accountDir)) {
            fs.mkdirSync(accountDir, { recursive: true });
        }

        // Write AccountConfig.json
        const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            JSON.stringify(accountConfig, null, 2),
            'utf-8',
        );

        res.status(201).json(accountConfig);
    });

    return router;
}
