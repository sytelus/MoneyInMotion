#!/usr/bin/env node

/** Remove generated build output without touching dependencies or source. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
const packageJson = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf-8'),
);
if (packageJson.name !== 'moneyinmotion') {
    throw new Error(`Refusing to clean an unexpected directory: ${repositoryRoot}`);
}

const generatedPaths = ['core', 'server', 'web'].flatMap((packageName) => [
    path.join(repositoryRoot, 'packages', packageName, 'dist'),
    path.join(
        repositoryRoot,
        'packages',
        packageName,
        'tsconfig.tsbuildinfo',
    ),
]);

for (const generatedPath of generatedPaths) {
    fs.rmSync(generatedPath, { recursive: true, force: true });
}

console.log('Removed generated package build output.');
