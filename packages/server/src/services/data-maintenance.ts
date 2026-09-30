/** Single-process maintenance gate; external filesystem writers must be stopped. */
export class DataMaintenance {
  private busy = false;
  private recoveryRequired = false;

  /** Failed rollback must never reopen mutation endpoints on mixed disk state. */
  requireRecovery(): void {
    this.recoveryRequired = true;
  }

  assertAvailable(): void {
    if (this.recoveryRequired) {
      throw Object.assign(
        new Error(
          'Restore recovery is required. Stop and restart the server; preserve the recovery folder if startup reports an error.',
        ),
        { status: 423 },
      );
    }
    if (this.busy) {
      throw Object.assign(
        new Error('Backup or restore is running. Wait for it to finish, then retry.'),
        { status: 423 },
      );
    }
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.assertAvailable();
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
}
