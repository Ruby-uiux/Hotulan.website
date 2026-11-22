import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionSecret, verifySessionToken } from "@/lib/auth/session";
import { can, type Access, type Module, type Role } from "@/lib/permissions";
import { HttpError } from "./errors";
import { getStaffAuth } from "./repo/people";

/** The signed-in staff member, re-checked against the database on every call. */
export interface StaffSession {
  id: string;
  username: string;
  name: string;
  role: Role;
}

/**
 * Valid only if the cookie signature checks out AND the staff row still exists, is
 * active, can sign in, and has the same role the session was issued for. Deactivating
 * someone or changing their role therefore ends their session on the very next request.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const secret = readSessionSecret();
  if (!secret) return null;
  const payload = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret);
  if (!payload) return null;
  const staff = await getStaffAuth(payload.sid);
  if (!staff || !staff.active || !staff.passwordHash || staff.role !== payload.role) return null;
  return { id: staff.id, username: staff.username, name: staff.name, role: staff.role };
}

/**
 * Server-side gate for every admin API handler: 401 without a valid session, 403 when
 * the role's access to `module` (lib/permissions.ts matrix) is below `need`.
 * Middleware only checks the cookie signature; this is the real authorisation.
 */
export async function requireStaff(module: Module, need: Exclude<Access, "none"> = "view"): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new HttpError(401, "Нэвтрэх шаардлагатай.");
  if (!can(session.role, module, need)) throw new HttpError(403, "Танд энэ үйлдлийг хийх эрх байхгүй.");
  return session;
}
