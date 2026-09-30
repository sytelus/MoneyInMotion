import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BackupRestore } from '../../src/components/settings/BackupRestore.js';
import * as api from '../../src/api/backups.js';

vi.mock('../../src/api/backups.js', () => ({
  listBackups: vi.fn(),
  createBackup: vi.fn(),
  previewBackup: vi.fn(),
  previewUploadedBackup: vi.fn(),
  restoreBackup: vi.fn(),
  cancelRestore: vi.fn(),
  backupDownloadUrl: (name: string) => `/api/backups/download/${name}`,
}));
const summary = {
  username: 'alex',
  dataRoot: '/data',
  port: 3001,
  createdAt: '2026-09-30T10:00:00Z',
  fileCount: 17,
  totalBytes: 1048576,
};
const preview = {
  ...summary,
  token: 'preview-token',
  expiresAt: '2026-09-30T10:15:00Z',
  destination: '/data/alex',
  restartRequired: false,
};
const catalog = {
  directory: '/home/alex',
  username: 'alex',
  destination: '/data/alex',
  defaultName: 'alex_mim_backup_<datetime>.zip',
  maxArchiveBytes: 2147483648,
  backups: [
    { name: 'alex_mim_backup_new.zip', sizeBytes: 100, modifiedAt: summary.createdAt },
    { name: 'alex_mim_backup_old.zip', sizeBytes: 100, modifiedAt: summary.createdAt },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(api.listBackups).mockResolvedValue(catalog);
  vi.mocked(api.previewBackup).mockResolvedValue(preview);
  vi.mocked(api.previewUploadedBackup).mockResolvedValue(preview);
  vi.mocked(api.cancelRestore).mockResolvedValue({ cancelled: true });
  vi.mocked(api.createBackup).mockResolvedValue({
    ...summary,
    name: 'made.zip',
    path: '/home/alex/made.zip',
    sizeBytes: 123,
  });
  vi.mocked(api.restoreBackup).mockResolvedValue({
    ...preview,
    restored: true,
    recoveryDirectory: '/data/.mim-restore-alex-test',
  });
});
afterEach(() => sessionStorage.clear());

describe('Settings backup and restore', () => {
  it('shows scope and location, defaults to the newest server backup, and reports creation', async () => {
    render(<BackupRestore />);
    expect(await screen.findByText('/home/alex')).toBeInTheDocument();
    expect(screen.getByLabelText('Backup in server home folder')).toHaveValue(
      'alex_mim_backup_new.zip',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create full backup' }));
    expect(await screen.findByText('Backup saved')).toBeInTheDocument();
    expect(screen.getByText(/17 files, 1.0 MiB/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download ZIP copy' })).toHaveAttribute(
      'href',
      '/api/backups/download/made.zip',
    );
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('reviews before mutation and cancels without restoring', async () => {
    render(<BackupRestore />);
    await screen.findByText('/home/alex');
    fireEvent.click(screen.getByRole('button', { name: 'Review restore' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('/data/alex')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Restore and replace data' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.cancelRestore).toHaveBeenCalledWith('preview-token');
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it.each(['Cancel', 'Escape'])('returns focus to Review restore after %s', async (method) => {
    render(<BackupRestore />);
    await screen.findByText('/home/alex');
    const review = screen.getByRole('button', { name: 'Review restore' });
    // Validation temporarily disables the opener. Browsers can move focus to
    // the body before the asynchronous preview mounts the dialog.
    fireEvent.click(review);
    const dialog = await screen.findByRole('dialog');
    if (method === 'Cancel') {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    } else {
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(review).toHaveFocus());
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('requires exact confirmation, persists the result and reloads to clear stale application state', async () => {
    const reload = vi.fn();
    render(<BackupRestore onRestored={reload} />);
    await screen.findByText('/home/alex');
    fireEvent.click(screen.getByRole('button', { name: 'Review restore' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Type alex to confirm'), { target: { value: 'Alex' } });
    expect(screen.getByRole('button', { name: 'Restore and replace data' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type alex to confirm'), { target: { value: 'alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore and replace data' }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(api.restoreBackup).toHaveBeenCalledWith('preview-token', 'alex');
    expect(sessionStorage.getItem('mim-restore-result')).toContain('recoveryDirectory');
    expect(screen.getByText('Data restored from backup')).toBeInTheDocument();
  });

  it('rejects a non-ZIP locally without uploading and uses the chosen ZIP instead of the default backup', async () => {
    render(<BackupRestore />);
    await screen.findByText('/home/alex');
    const picker = screen.getByLabelText('Or browse for a backup ZIP on this device');
    fireEvent.change(picker, { target: { files: [new File(['x'], 'wrong.csv')] } });
    expect(screen.getByText(/Nothing was uploaded/)).toBeInTheDocument();
    expect(api.previewUploadedBackup).not.toHaveBeenCalled();
    const file = new File(['zip'], 'backup.zip');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Review restore' }));
    await screen.findByRole('dialog');
    expect(api.previewUploadedBackup).toHaveBeenCalledWith(file);
    expect(api.previewBackup).not.toHaveBeenCalled();
  });

  it('keeps archive errors visible and never enables confirmation for an invalid archive', async () => {
    vi.mocked(api.previewBackup).mockRejectedValue(new Error('Backup integrity check failed.'));
    render(<BackupRestore />);
    await screen.findByText('/home/alex');
    fireEvent.click(screen.getByRole('button', { name: 'Review restore' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Backup integrity check failed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('keeps stale-preview failures inside the confirmation dialog', async () => {
    vi.mocked(api.restoreBackup).mockRejectedValue(
      new Error('Data changed after this preview. Review again.'),
    );
    render(<BackupRestore />);
    await screen.findByText('/home/alex');
    fireEvent.click(screen.getByRole('button', { name: 'Review restore' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Type alex to confirm'), { target: { value: 'alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore and replace data' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'Data changed after this preview',
    );
  });

  it('blocks actions while Settings has unsaved changes and retains readable guidance', async () => {
    render(<BackupRestore disabled />);
    await screen.findByText('/home/alex');
    expect(screen.getByRole('button', { name: 'Create full backup' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review restore' })).toBeDisabled();
    expect(screen.getByText(/Finish or discard settings changes/)).toBeInTheDocument();
  });
});
