import { NextResponse } from "next/server";
import { HttpError } from "./validate";

/**
 * Wraps a route handler so validation/business errors become `{ error }` JSON with the
 * right status, and anything unexpected is logged and surfaced as a generic 500
 * (no stack traces or file paths leak to the browser).
 */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) {
  return async (...args: Args) => {
    try {
      const result = await fn(...args);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...err.details }, { status: err.status });
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Серверийн алдаа гарлаа. Дахин оролдоно уу." }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "JSON бүтэц буруу байна.");
  }
}

/** Short, human-readable, collision-checked id (e.g. "HTL-483120"). */
export function uniqueId(prefix: string, taken: Set<string>, digits = 6): string {
  for (;;) {
    const id = `${prefix}${Math.floor(10 ** (digits - 1) + Math.random() * 9 * 10 ** (digits - 1))}`;
    if (!taken.has(id)) return id;
  }
}
