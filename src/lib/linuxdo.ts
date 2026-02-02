import "server-only";

import prisma from "@/lib/prisma";
import { getOrCreateDefaultUserGroupId } from "@/services/usergroups/default-group";
import {
  LINUXDO_TRUST_LEVEL_MAPPING_KEY,
  type LinuxDoTrustLevelMapping,
  parseLinuxDoTrustLevelMapping,
} from "@/lib/linuxdo-shared";

export * from "@/lib/linuxdo-shared";

export async function getLinuxDoTrustLevelMapping(): Promise<LinuxDoTrustLevelMapping> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: LINUXDO_TRUST_LEVEL_MAPPING_KEY },
    select: { value: true },
  });

  const parsed = parseLinuxDoTrustLevelMapping(row?.value ?? null);
  if (parsed) return parsed;

  const defaultGroupId = await getOrCreateDefaultUserGroupId();
  return {
    tl0: { action: "assign", userGroupId: defaultGroupId },
    tl1: { action: "assign", userGroupId: defaultGroupId },
    tl2: { action: "assign", userGroupId: defaultGroupId },
    tl34: { action: "assign", userGroupId: defaultGroupId },
  };
}
