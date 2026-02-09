import prisma from "@/lib/prisma";

export const DEFAULT_USERGROUP_NAME = "Default";

export async function getOrCreateDefaultUserGroupId(): Promise<string> {
  const existing = await prisma.userGroup.findUnique({
    where: { name: DEFAULT_USERGROUP_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.userGroup.create({
      data: {
        name: DEFAULT_USERGROUP_NAME,
        domainPolicy: "ALL_PUBLIC",
        maxMailboxes: 300,
        maxWorkflows: 10,
        telegramEnabled: true,
        workflowEnabled: true,
        workflowForwardEmailEnabled: false,
        workflowForwardWebhookEnabled: true,
        openApiEnabled: true,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    const again = await prisma.userGroup.findUnique({
      where: { name: DEFAULT_USERGROUP_NAME },
      select: { id: true },
    });
    if (!again) throw new Error("Failed to create default user group");
    return again.id;
  }
}

export async function assignDefaultUserGroupToUnassignedUsers(): Promise<{
  defaultGroupId: string;
  updatedCount: number;
}> {
  const defaultGroupId = await getOrCreateDefaultUserGroupId();
  const updated = await prisma.user.updateMany({
    where: { role: "USER", userGroupId: null },
    data: { userGroupId: defaultGroupId },
  });
  return { defaultGroupId, updatedCount: updated.count };
}
