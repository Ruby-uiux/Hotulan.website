/** Error carrying the server's Mongolian message plus any structured details (e.g. `available` stock). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгана уу.");
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  // Session expired mid-work in the admin panel: send the operator back through login,
  // then return them to the page they were on.
  if (response.status === 401 && typeof window !== "undefined") {
    const { pathname, search } = window.location;
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      window.location.assign(`/admin/login?expired=1&next=${encodeURIComponent(pathname + search)}`);
    }
  }

  if (!response.ok) {
    const { error, ...details } = payload;
    throw new ApiError(response.status, typeof error === "string" ? error : "Алдаа гарлаа.", details);
  }
  return payload as T;
}
