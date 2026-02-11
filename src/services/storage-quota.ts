import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";

export type EffectiveStorageQuota = {
  maxStorageMb: number | null;
  maxStorageFiles: number | null;
  maxStorageBytes: number | null;
};

export type UserStorageUsage = {
  bytes: number;
  files: number;
  emails: number;
};

type QuotaCheckResult = {
  allowed: boolean;
  usage: UserStorageUsage;
  quota: EffectiveStorageQuota;
  nextUsage: {
    bytes: number;
    files: number;
  };
  exceededReasons: Array<"bytes" | "files">;
};

function toBytes(mb: number | null): number | null {
  if (mb === null) return null;
  if (!Number.isFinite(mb) || mb < 0) return null;
  return mb * 1024 * 1024;
}

export async function resolveEffectiveStorageQuota(userId: string): Promise<EffectiveStorageQuota> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      maxStorageMb: true,
      maxStorageFiles: true,
      userGroup: {
        select: {
          maxStorageMb: true,
          maxStorageFiles: true,
        },
      },
    },
  });

  if (!user) {
    return {
      maxStorageMb: null,
      maxStorageFiles: null,
      maxStorageBytes: null,
    };
  }

  if (isAdminRole(user.role)) {
    return {
      maxStorageMb: null,
      maxStorageFiles: null,
      maxStorageBytes: null,
    };
  }

  const maxStorageMb = user.maxStorageMb ?? user.userGroup?.maxStorageMb ?? null;
  const maxStorageFiles = user.maxStorageFiles ?? user.userGroup?.maxStorageFiles ?? null;

  return {
    maxStorageMb,
    maxStorageFiles,
    maxStorageBytes: toBytes(maxStorageMb),
  };
}

export async function getUserStorageUsage(userId: string): Promise<UserStorageUsage> {
  const result = await prisma.email.aggregate({
    where: { mailbox: { userId } },
    _sum: {
      storageBytes: true,
      storageFiles: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    bytes: Number(result._sum.storageBytes || 0),
    files: Number(result._sum.storageFiles || 0),
    emails: Number(result._count.id || 0),
  };
}

export async function canStoreForUser(params: {
  userId: string;
  additionalBytes: number;
  additionalFiles: number;
}): Promise<QuotaCheckResult> {
  const additionalBytes = Math.max(0, Math.floor(params.additionalBytes));
  const additionalFiles = Math.max(0, Math.floor(params.additionalFiles));

  const [usage, quota] = await Promise.all([
    getUserStorageUsage(params.userId),
    resolveEffectiveStorageQuota(params.userId),
  ]);

  const nextUsage = {
    bytes: usage.bytes + additionalBytes,
    files: usage.files + additionalFiles,
  };

  const exceededReasons: Array<"bytes" | "files"> = [];
  if (quota.maxStorageBytes !== null && nextUsage.bytes > quota.maxStorageBytes) {
    exceededReasons.push("bytes");
  }
  if (quota.maxStorageFiles !== null && nextUsage.files > quota.maxStorageFiles) {
    exceededReasons.push("files");
  }

  return {
    allowed: exceededReasons.length === 0,
    usage,
    quota,
    nextUsage,
    exceededReasons,
  };
}

export async function listUsersStorageUsage(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
  const search = (params?.search || "").trim();

  const where =
    search.length > 0
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : undefined;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        maxStorageMb: true,
        maxStorageFiles: true,
        userGroup: {
          select: {
            id: true,
            name: true,
            maxStorageMb: true,
            maxStorageFiles: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((user) => user.id);
  const usageByUser = new Map<string, { usageBytes: number; usageFiles: number; emailCount: number }>();

  if (userIds.length > 0) {
    const grouped = await prisma.email.groupBy({
      by: ["mailboxId"],
      where: { mailbox: { userId: { in: userIds } } },
      _sum: {
        storageBytes: true,
        storageFiles: true,
      },
      _count: {
        id: true,
      },
    });

    if (grouped.length > 0) {
      const mailboxOwners = await prisma.mailbox.findMany({
        where: { id: { in: grouped.map((row) => row.mailboxId) } },
        select: { id: true, userId: true },
      });

      const mailboxOwnerMap = new Map(mailboxOwners.map((row) => [row.id, row.userId]));
      for (const row of grouped) {
        const userId = mailboxOwnerMap.get(row.mailboxId);
        if (!userId) continue;

        const current = usageByUser.get(userId) || { usageBytes: 0, usageFiles: 0, emailCount: 0 };
        current.usageBytes += Number(row._sum.storageBytes || 0);
        current.usageFiles += Number(row._sum.storageFiles || 0);
        current.emailCount += Number(row._count.id || 0);
        usageByUser.set(userId, current);
      }
    }
  }

  const rows = users.map((user) => {
    const usage = usageByUser.get(user.id) || { usageBytes: 0, usageFiles: 0, emailCount: 0 };
    const usageBytes = usage.usageBytes;
    const usageFiles = usage.usageFiles;
    const emailCount = usage.emailCount;

    const isAdmin = isAdminRole(user.role);
    const maxStorageMb = isAdmin ? null : user.maxStorageMb ?? user.userGroup?.maxStorageMb ?? null;
    const maxStorageFiles = isAdmin ? null : user.maxStorageFiles ?? user.userGroup?.maxStorageFiles ?? null;
    const maxStorageBytes = toBytes(maxStorageMb);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      userGroup: user.userGroup,
      usageBytes,
      usageFiles,
      emailCount,
      quota: {
        maxStorageMb,
        maxStorageBytes,
        maxStorageFiles,
      },
      exceeded: {
        bytes: maxStorageBytes !== null ? usageBytes > maxStorageBytes : false,
        files: maxStorageFiles !== null ? usageFiles > maxStorageFiles : false,
      },
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalUsers += 1;
      acc.totalBytes += row.usageBytes;
      acc.totalFiles += row.usageFiles;
      acc.totalEmails += row.emailCount;
      return acc;
    },
    {
      totalUsers: 0,
      totalBytes: 0,
      totalFiles: 0,
      totalEmails: 0,
    }
  );

  return {
    summary,
    users: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
