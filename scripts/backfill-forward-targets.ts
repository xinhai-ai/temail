import prisma from "@/lib/prisma";
import { normalizeForwardRuleConfig } from "@/services/forward-config";

type Args = {
  dryRun: boolean;
  limit?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--limit") {
      const raw = argv[i + 1];
      i += 1;
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive integer");
      }
      args.limit = parsed;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  const rules = await prisma.forwardRule.findMany({
    select: {
      id: true,
      type: true,
      config: true,
      targets: { select: { id: true } },
    },
    ...(typeof limit === "number" ? { take: limit } : {}),
  });

  let checked = 0;
  let skipped = 0;
  let created = 0;
  let failed = 0;

  for (const rule of rules) {
    checked += 1;
    if (rule.targets.length > 0) {
      skipped += 1;
      continue;
    }

    const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
    if (!normalized.ok) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`Rule ${rule.id}: cannot normalize config: ${normalized.error}`);
      continue;
    }

    const targetConfig = JSON.stringify(normalized.config.destination);

    if (!dryRun) {
      await prisma.forwardTarget.create({
        data: {
          ruleId: rule.id,
          type: rule.type,
          config: targetConfig,
        },
      });
    }

    created += 1;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ dryRun, checked, skipped, created, failed }, null, 2)
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

