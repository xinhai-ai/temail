import { auth } from "@/lib/auth";

export function isAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role?: string | null) {
  return role === "SUPER_ADMIN";
}

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

