/** Web Locks is a UX guard. Transactional revision checks remain the safety boundary. */
export class BoardLease {
  private releaseLock?: () => void;
  async acquire(id: string): Promise<boolean> {
    this.release();
    if (!navigator.locks) return true;
    return new Promise<boolean>((resolve, reject) => {
      void navigator.locks
        .request(
          `boardpilot:board:${id}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            await new Promise<void>((release) => {
              this.releaseLock = release;
              resolve(true);
            });
          },
        )
        .catch(reject);
    }).catch(() => true); // CAS revision checks protect data when a browser denies Web Locks.
  }
  release() {
    this.releaseLock?.();
    this.releaseLock = undefined;
  }
}
