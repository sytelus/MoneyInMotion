import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileRepository } from '../../src/storage/file-repository.js';

describe('FileRepository', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyai-test-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates with correct folder paths', () => {
        const repo = new FileRepository(tempDir);

        expect(repo.rootFolderPath).toBe(tempDir);
        expect(repo.importFolderPath).toBe(path.join(tempDir, 'Statements'));
        expect(repo.mergedFolderPath).toBe(path.join(tempDir, 'Merged'));
    });

    it('returns empty array when import folder does not exist', () => {
        const repo = new FileRepository(tempDir);
        const locations = repo.getStatementLocations();

        expect(locations).toHaveLength(0);
    });

    it('scans directories for statement files with AccountConfig', () => {
        // Set up directory structure:
        //   Statements/
        //     MyBank/
        //       AccountConfig.json
        //       statement1.csv
        //       statement2.csv
        //       readme.txt  (should not match)
        const statementsDir = path.join(tempDir, 'Statements');
        const bankDir = path.join(statementsDir, 'MyBank');
        fs.mkdirSync(bankDir, { recursive: true });

        const accountConfig = {
            accountInfo: {
                id: 'test-bank',
                instituteName: 'TestBank',
                type: 1,
                requiresParent: false,
            },
            fileFilters: ['*.csv'],
            scanSubFolders: false,
        };

        fs.writeFileSync(
            path.join(bankDir, 'AccountConfig.json'),
            JSON.stringify(accountConfig),
        );
        fs.writeFileSync(path.join(bankDir, 'statement1.csv'), 'Date,Amount\n01/01/2024,100\n');
        fs.writeFileSync(path.join(bankDir, 'statement2.csv'), 'Date,Amount\n02/01/2024,200\n');
        fs.writeFileSync(path.join(bankDir, 'readme.txt'), 'Not a statement');

        const repo = new FileRepository(tempDir);
        const locations = repo.getStatementLocations();

        // Should find 2 CSV files, not the txt file
        expect(locations).toHaveLength(2);

        const fileNames = locations.map((l) => path.basename(l.address)).sort();
        expect(fileNames).toEqual(['statement1.csv', 'statement2.csv']);

        // Each location should have the correct account config
        for (const loc of locations) {
            expect(loc.accountConfig).toBeTruthy();
            expect(loc.accountConfig!.accountInfo.id).toBe('test-bank');
        }

        // Each location should have import info
        for (const loc of locations) {
            expect(loc.importInfo).toBeTruthy();
            expect(loc.importInfo!.id).toBeTruthy();
            expect(loc.importInfo!.format).toBe('csv');
        }
    });

    it('scans subdirectories recursively', () => {
        const statementsDir = path.join(tempDir, 'Statements');
        const bankDir = path.join(statementsDir, 'MyBank');
        const subDir = path.join(bankDir, '2024');
        fs.mkdirSync(subDir, { recursive: true });

        const accountConfig = {
            accountInfo: {
                id: 'test-bank',
                instituteName: 'TestBank',
                type: 1,
                requiresParent: false,
            },
            fileFilters: ['*.csv'],
            scanSubFolders: true,
        };

        fs.writeFileSync(
            path.join(bankDir, 'AccountConfig.json'),
            JSON.stringify(accountConfig),
        );
        fs.writeFileSync(path.join(bankDir, 'main.csv'), 'Date,Amount\n01/01/2024,100\n');
        fs.writeFileSync(path.join(subDir, 'sub.csv'), 'Date,Amount\n02/01/2024,200\n');

        const repo = new FileRepository(tempDir);
        const locations = repo.getStatementLocations();

        expect(locations).toHaveLength(2);
    });

    it('does not recurse when scanSubFolders is false', () => {
        const statementsDir = path.join(tempDir, 'Statements');
        const bankDir = path.join(statementsDir, 'MyBank');
        const subDir = path.join(bankDir, '2024');
        fs.mkdirSync(subDir, { recursive: true });

        const accountConfig = {
            accountInfo: {
                id: 'test-bank',
                instituteName: 'TestBank',
                type: 1,
                requiresParent: false,
            },
            fileFilters: ['*.csv'],
            scanSubFolders: false,
        };

        fs.writeFileSync(
            path.join(bankDir, 'AccountConfig.json'),
            JSON.stringify(accountConfig),
        );
        fs.writeFileSync(path.join(bankDir, 'main.csv'), 'Date,Amount\n01/01/2024,100\n');
        fs.writeFileSync(path.join(subDir, 'sub.csv'), 'Date,Amount\n02/01/2024,200\n');

        const repo = new FileRepository(tempDir);
        const locations = repo.getStatementLocations();

        expect(locations).toHaveLength(1);
        expect(path.basename(locations[0]!.address)).toBe('main.csv');
    });

    it('reports correct latestMerged paths', () => {
        const repo = new FileRepository(tempDir);

        expect(repo.latestMergedPath).toBe(
            path.join(tempDir, 'Merged', 'LatestMerged.json'),
        );
        expect(repo.latestMergedEditsPath).toBe(
            path.join(tempDir, 'Merged', 'LatestMergedEdits.json'),
        );
    });

    it('checks existence of merged files', () => {
        const repo = new FileRepository(tempDir);

        expect(repo.latestMergedExists()).toBe(false);
        expect(repo.latestMergedEditsExists()).toBe(false);

        const mergedDir = path.join(tempDir, 'Merged');
        fs.mkdirSync(mergedDir, { recursive: true });
        fs.writeFileSync(path.join(mergedDir, 'LatestMerged.json'), '{}');

        expect(repo.latestMergedExists()).toBe(true);
        expect(repo.latestMergedEditsExists()).toBe(false);
    });
});
