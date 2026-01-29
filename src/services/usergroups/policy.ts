import prisma from "@/lib/prisma";

export type UserGroupFeature = "telegram" | "workflow" | "openapi";

function isAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export type PolicyError = {
  ok: false;
  status: 400 | 403 | 404 | 500;
  error: string;
  code:
    | "USER_NOT_FOUND"
    | "USERGROUP_FEATURE_DISABLED"
    | "USERGROUP_MAILBOX_LIMIT_REACHED"
    | "USERGROUP_WORKFLOW_LIMIT_REACHED"
    | "USERGROUP_DOMAIN_NOT_ALLOWED";
  meta?: Record<string, unknown>;
};

export type PolicyOk<T = undefined> = { ok: true; value: T };

export type PolicyResult<T = undefined> = PolicyOk<T> | PolicyError;

type UserGroupRow = {
  id: string;
  domainPolicy: "ALL_PUBLIC" | "ALLOWLIST";
  maxMailboxes: number | null;
  maxWorkflows: number | null;
  telegramEnabled: boolean;
  workflowEnabled: boolean;
  openApiEnabled: boolean;
};

async function getUserPolicyContext(userId: string): Promise<
  | {
      role: string;
      isAdmin: boolean;
      userGroup: UserGroupRow | null;
    }
  | null
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      userGroup: {
        select: {
          id: true,
          domainPolicy: true,
          maxMailboxes: true,
          maxWorkflows: true,
          telegramEnabled: true,
          workflowEnabled: true,
          openApiEnabled: true,
        },
      },
    },
  });

  if (!user) return null;
  return {
    role: user.role,
    isAdmin: isAdminRole(user.role),
    userGroup: user.userGroup as UserGroupRow | null,
  };
}

function featureToField(feature: UserGroupFeature): keyof Pick<UserGroupRow, "telegramEnabled" | "workflowEnabled" | "openApiEnabled"> {
  if (feature === "telegram") return "telegramEnabled";
  if (feature === "workflow") return "workflowEnabled";
  return "openApiEnabled";
}

export async function assertUserGroupFeatureEnabled(params: {
  userId: string;
  feature: UserGroupFeature;
}): Promise<PolicyResult> {
  const ctx = await getUserPolicyContext(params.userId);
  if (!ctx) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (ctx.isAdmin) return { ok: true, value: undefined };
  if (!ctx.userGroup) return { ok: true, value: undefined };

  const enabled = ctx.userGroup[featureToField(params.feature)];
  if (enabled) return { ok: true, value: undefined };

  return {
    ok: false,
    status: 403,
    error: `${params.feature} is disabled for your group`,
    code: "USERGROUP_FEATURE_DISABLED",
    meta: { feature: params.feature },
  };
}

export async function assertCanCreateMailbox(userId: string): Promise<PolicyResult> {
  const ctx = await getUserPolicyContext(userId);
  if (!ctx) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (ctx.isAdmin) return { ok: true, value: undefined };
  const limit = ctx.userGroup?.maxMailboxes ?? null;
  if (limit === null) return { ok: true, value: undefined };

  const count = await prisma.mailbox.count({
    where: { userId, status: { not: "DELETED" } },
  });

  if (count < limit) return { ok: true, value: undefined };

  return {
    ok: false,
    status: 403,
    error: "Mailbox limit reached",
    code: "USERGROUP_MAILBOX_LIMIT_REACHED",
    meta: { limit, count },
  };
}

export async function assertCanCreateWorkflow(userId: string): Promise<PolicyResult> {
  const ctx = await getUserPolicyContext(userId);
  if (!ctx) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (ctx.isAdmin) return { ok: true, value: undefined };
  const limit = ctx.userGroup?.maxWorkflows ?? null;
  if (limit === null) return { ok: true, value: undefined };

  const count = await prisma.workflow.count({ where: { userId } });
  if (count < limit) return { ok: true, value: undefined };

  return {
    ok: false,
    status: 403,
    error: "Workflow limit reached",
    code: "USERGROUP_WORKFLOW_LIMIT_REACHED",
    meta: { limit, count },
  };
}

export async function assertDomainAllowedForUser(params: {
  userId: string;
  domainId: string;
}): Promise<PolicyResult> {
  const ctx = await getUserPolicyContext(params.userId);
  if (!ctx) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (ctx.isAdmin) return { ok: true, value: undefined };
  if (!ctx.userGroup) return { ok: true, value: undefined };
  if (ctx.userGroup.domainPolicy !== "ALLOWLIST") return { ok: true, value: undefined };

  const allowed = await prisma.userGroupDomain.findFirst({
    where: {
      userGroupId: ctx.userGroup.id,
      domainId: params.domainId,
    },
    select: { userGroupId: true },
  });

  if (allowed) return { ok: true, value: undefined };

  return {
    ok: false,
    status: 403,
    error: "Domain is not allowed for your group",
    code: "USERGROUP_DOMAIN_NOT_ALLOWED",
    meta: { domainId: params.domainId },
  };
}

export async function getAllowedDomainIdsForUser(userId: string): Promise<
  | { ok: true; domainIds: string[] | null }
  | PolicyError
> {
  const ctx = await getUserPolicyContext(userId);
  if (!ctx) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (ctx.isAdmin) return { ok: true, domainIds: null };
  if (!ctx.userGroup) return { ok: true, domainIds: null };
  if (ctx.userGroup.domainPolicy !== "ALLOWLIST") return { ok: true, domainIds: null };

  const rows = await prisma.userGroupDomain.findMany({
    where: { userGroupId: ctx.userGroup.id },
    select: { domainId: true },
    orderBy: { domainId: "asc" },
  });
  return { ok: true, domainIds: rows.map((r) => r.domainId) };
}

export async function assertUserHasUserGroup(params: { userId: string }): Promise<PolicyResult<{ userGroupId: string | null }>> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true, userGroupId: true },
  });
  if (!user) {
    return { ok: false, status: 404, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (isAdminRole(user.role)) return { ok: true, value: { userGroupId: null } };
  return { ok: true, value: { userGroupId: user.userGroupId } };
}
