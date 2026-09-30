/** Full-data archives are distinct from CSV/report exports and rebuilds. */
export interface BackupList {
  directory: string;
  username: string;
  destination: string;
  defaultName: string;
  maxArchiveBytes: number;
  backups: Array<{ name: string; sizeBytes: number; modifiedAt: string }>;
}
export interface BackupSummary {
  createdAt: string;
  username: string;
  dataRoot: string;
  port: number;
  fileCount: number;
  totalBytes: number;
}
export interface CreatedBackup extends BackupSummary {
  name: string;
  path: string;
  sizeBytes: number;
}
export interface RestorePreview extends BackupSummary {
  token: string;
  expiresAt: string;
  destination: string;
  restartRequired: boolean;
}
export interface RestoreResult extends RestorePreview {
  restored: true;
  recoveryDirectory: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backups${url}`, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 404)
      throw new Error(
        'Backup controls are not available from this server. Rebuild and restart MoneyInMotion, then reload this page.',
      );
    throw new Error(
      body.error || 'The backup service could not finish. Check the server and try again.',
    );
  }
  return response.json() as Promise<T>;
}
function post<T>(url: string, body: unknown): Promise<T> {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export const listBackups = (): Promise<BackupList> => request('');
export const createBackup = (): Promise<CreatedBackup> => post('', {});
export const previewBackup = (name: string): Promise<RestorePreview> => post('/preview', { name });
export function previewUploadedBackup(file: File): Promise<RestorePreview> {
  const form = new FormData();
  form.append('archive', file);
  return request('/preview-upload', { method: 'POST', body: form });
}
export const cancelRestore = (token: string): Promise<{ cancelled: boolean }> =>
  request(`/preview/${encodeURIComponent(token)}`, { method: 'DELETE' });
export const restoreBackup = (token: string, confirmUsername: string): Promise<RestoreResult> =>
  post('/restore', { token, confirmUsername });
export const backupDownloadUrl = (name: string): string =>
  `/api/backups/download/${encodeURIComponent(name)}`;
