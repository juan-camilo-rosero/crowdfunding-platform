/** Error thrown by withTimeout, so callers can tell a timeout from a failure. */
export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label}-timeout`);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects with a TimeoutError instead of waiting forever.
 *
 * Nothing in the photo flow may hang: a decode, an encode or an upload that
 * never settles is exactly what used to leave the dialog frozen on
 * "Subiendo…". The underlying work is not cancelled — the platform offers no
 * way to — but the UI stops waiting for it and can say so.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
