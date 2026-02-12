import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { encryptString } from "@/lib/secret-encryption";
import { isImapServiceEnabled, syncImapDomain, triggerImapReconcile } from "@/lib/imap-client";
import { assertCanCreateMailbox } from "@/services/usergroups/policy";
import { testImapLogin } from "@/services/personal-imap/connection";
import { discoverImapConnection } from "@/services/personal-imap/discovery";
import { deriveMailboxPrefixFromEmail, generatePersonalDomainName, maskEmailAddress } from "@/services/personal-imap/utils";

const createSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  username: z.string().trim().min(1).optional(),
  host: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  syncInterval: z.number().int().min(10).max(1440).default(60),
  label: z.string().trim().max(80).optional(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.personalImapAccount.findMany({
    where: { userId: session.user.id },
    include: {
      mailbox: {
        select: {
          id: true,
          address: true,
          archivedAt: true,
          sourceLabel: true,
          _count: {
            select: {
              emails: { where: { status: "UNREAD" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    accounts.map((account) => ({
      id: account.id,
      email: account.email,
      emailMasked: maskEmailAddress(account.email),
      host: account.host,
      port: account.port,
      secure: account.secure,
      username: account.username,
      status: account.status,
      syncInterval: account.syncInterval,
      lastSync: account.lastSync,
      lastError: account.lastError,
      consecutiveErrors: account.consecutiveErrors,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      mailbox: account.mailbox,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const input = createSchema.parse(bodyResult.data);
    const email = normalizeEmail(input.email);

    const quota = await assertCanCreateMailbox(session.user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, code: quota.code, meta: quota.meta }, { status: quota.status });
    }

    const existingAccount = await prisma.personalImapAccount.findFirst({
      where: { userId: session.user.id, email },
      select: { id: true },
    });
    if (existingAccount) {
      return NextResponse.json({ error: "Personal IMAP account already connected" }, { status: 400 });
    }

    const existingMailbox = await prisma.mailbox.findUnique({
      where: { address: email },
      select: { id: true },
    });
    if (existingMailbox) {
      return NextResponse.json({ error: "Mailbox address already exists" }, { status: 400 });
    }

    const discovered = await discoverImapConnection({
      email,
      username: input.username,
      host: input.host,
      port: input.port,
      secure: input.secure,
    });

    await testImapLogin({
      host: discovered.host,
      port: discovered.port,
      secure: discovered.secure,
      username: discovered.username,
      password: input.password,
    });

    const domainName = generatePersonalDomainName();
    const prefix = deriveMailboxPrefixFromEmail(email);
    const encrypted = encryptString(input.password);

    const created = await prisma.$transaction(async (tx) => {
      const domain = await tx.domain.create({
        data: {
          name: domainName,
          sourceType: "PERSONAL_IMAP",
          status: "PENDING",
          inboundPolicy: "KNOWN_ONLY",
          isPublic: false,
          description: `Personal IMAP ${email}`,
          userId: session.user.id,
        },
      });

      const mailbox = await tx.mailbox.create({
        data: {
          prefix,
          address: email,
          userId: session.user.id,
          domainId: domain.id,
          kind: "PERSONAL_IMAP",
          sourceLabel: input.label || discovered.label,
          note: input.label || undefined,
        },
      });

      await tx.imapConfig.create({
        data: {
          host: discovered.host,
          port: discovered.port,
          secure: discovered.secure,
          username: discovered.username,
          password: "__encrypted__",
          syncInterval: input.syncInterval,
          domainId: domain.id,
        },
      });

      const account = await tx.personalImapAccount.create({
        data: {
          userId: session.user.id,
          mailboxId: mailbox.id,
          domainId: domain.id,
          email,
          host: discovered.host,
          port: discovered.port,
          secure: discovered.secure,
          username: discovered.username,
          passwordCiphertext: encrypted.ciphertext,
          passwordIv: encrypted.iv,
          passwordTag: encrypted.tag,
          syncInterval: input.syncInterval,
          status: "ACTIVE",
        },
        include: {
          mailbox: {
            select: {
              id: true,
              address: true,
              archivedAt: true,
              sourceLabel: true,
              _count: {
                select: {
                  emails: { where: { status: "UNREAD" } },
                },
              },
            },
          },
        },
      });

      await tx.domain.update({
        where: { id: domain.id },
        data: { status: "ACTIVE" },
      });

      return account;
    });

    if (isImapServiceEnabled()) {
      triggerImapReconcile().catch((err) => {
        console.error("[api/personal-imap/accounts] reconcile error:", err);
      });
      syncImapDomain(created.domainId).catch((err) => {
        console.error("[api/personal-imap/accounts] initial sync error:", err);
      });
    }

    return NextResponse.json({
      id: created.id,
      email: created.email,
      emailMasked: maskEmailAddress(created.email),
      host: created.host,
      port: created.port,
      secure: created.secure,
      username: created.username,
      status: created.status,
      syncInterval: created.syncInterval,
      lastSync: created.lastSync,
      lastError: created.lastError,
      consecutiveErrors: created.consecutiveErrors,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      mailbox: created.mailbox,
    });
  } catch (error) {
    console.error("[api/personal-imap/accounts] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
