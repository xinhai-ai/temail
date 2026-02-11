import { auth } from "@/lib/auth";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";

export { isAdminRole, isSuperAdminRole };

export async function getAdminSession() {
  const session = await auth();
  if (!session || !isAdminRole(session.user.role)) return null;
  return session;
}

export async function getSuperAdminSession() {
  const session = await auth();
  if (!session || !isSuperAdminRole(session.user.role)) return null;
  return session;
}
