/** An error with an HTTP status; `handle()` turns it into `{ error, ...details }` JSON. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
