export function isAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role?: string | null) {
  return role === "SUPER_ADMIN";
}
