import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { decryptString, encryptString } from "@/lib/secret-encryption";
import { isImapServiceEnabled, syncImapDomain, triggerImapReconcile } from "@/lib/imap-client";
import { testImapLogin } from "@/services/personal-imap/connection";
import { discoverImapConnection } from "@/services/personal-imap/discovery";
import { maskEmailAddress } from "@/services/personal-imap/utils";

const updateSchema = z.object({
  host: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  username: z.string().trim().min(1).optional(),
  password: z.string().min(1).optional(),
  syncInterval: z.number().int().min(10).max(1440).optional(),
  label: z.string().trim().max(80).nullable().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

function toResponse(account: {
  id: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  status: string;
  syncInterval: number;
  lastSync: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
  createdAt: Date;
  updatedAt: Date;
  mailbox: {
    id: string;
    address: string;
    archivedAt: Date | null;
    sourceLabel: string | null;
    _count: { emails: number };
  };
}) {
  return {
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
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    const existing = await prisma.personalImapAccount.findFirst({
      where: { id, userId: session.user.id },
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

    if (!existing) {
      return NextResponse.json({ error: "Personal IMAP account not found" }, { status: 404 });
    }

    const nextStatus = data.status ?? existing.status;
    const discovered = await discoverImapConnection({
      email: existing.email,
      username: data.username ?? existing.username,
      host: data.host ?? existing.host,
      port: data.port ?? existing.port,
      secure: data.secure ?? existing.secure,
    });

    const nextSyncInterval = data.syncInterval ?? existing.syncInterval;

    const shouldTestConnection =
      nextStatus === "ACTIVE" &&
      (Boolean(data.password) ||
        Boolean(data.username) ||
        Boolean(data.host) ||
        typeof data.port === "number" ||
        typeof data.secure === "boolean" ||
        existing.status !== "ACTIVE");

    if (shouldTestConnection) {
      const password = data.password
        ? data.password
        : decryptString({
            ciphertext: existing.passwordCiphertext,
            iv: existing.passwordIv,
            tag: existing.passwordTag,
          });

      await testImapLogin({
        host: discovered.host,
        port: discovered.port,
        secure: discovered.secure,
        username: discovered.username,
        password,
      });
    }

    const encrypted = data.password ? encryptString(data.password) : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.personalImapAccount.update({
        where: { id: existing.id },
        data: {
          host: discovered.host,
          port: discovered.port,
          secure: discovered.secure,
          username: discovered.username,
          syncInterval: nextSyncInterval,
          status: nextStatus,
          ...(encrypted
            ? {
                passwordCiphertext: encrypted.ciphertext,
                passwordIv: encrypted.iv,
                passwordTag: encrypted.tag,
              }
            : {}),
          ...(nextStatus === "DISABLED"
            ? {
                lastError: null,
                consecutiveErrors: 0,
              }
            : {}),
        },
      });

      await tx.imapConfig.update({
        where: { domainId: existing.domainId },
        data: {
          host: discovered.host,
          port: discovered.port,
          secure: discovered.secure,
          username: discovered.username,
          syncInterval: nextSyncInterval,
        },
      });

      await tx.domain.update({
        where: { id: existing.domainId },
        data: {
          status: nextStatus === "DISABLED" ? "INACTIVE" : "PENDING",
        },
      });

      await tx.mailbox.update({
        where: { id: existing.mailboxId },
        data: {
          sourceLabel: data.label === undefined ? undefined : data.label,
          note: data.label === undefined ? undefined : data.label,
          archivedAt: nextStatus === "DISABLED" ? new Date() : null,
        },
      });

      return tx.personalImapAccount.findUniqueOrThrow({
        where: { id: existing.id },
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
    });

    if (isImapServiceEnabled()) {
      triggerImapReconcile().catch((err) => {
        console.error("[api/personal-imap/accounts/:id] reconcile error:", err);
      });
      if (nextStatus === "ACTIVE") {
        syncImapDomain(existing.domainId).catch((err) => {
          console.error("[api/personal-imap/accounts/:id] sync error:", err);
        });
      }
    }

    return NextResponse.json(toResponse(updated));
  } catch (error) {
    console.error("[api/personal-imap/accounts/:id] PATCH error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const account = await prisma.personalImapAccount.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, domainId: true, mailboxId: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Personal IMAP account not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.personalImapAccount.update({
      where: { id: account.id },
      data: {
        status: "DISABLED",
        lastError: null,
        consecutiveErrors: 0,
      },
    });

    await tx.domain.update({
      where: { id: account.domainId },
      data: { status: "INACTIVE" },
    });

    await tx.mailbox.update({
      where: { id: account.mailboxId },
      data: { archivedAt: new Date() },
    });
  });

  if (isImapServiceEnabled()) {
    triggerImapReconcile().catch((err) => {
      console.error("[api/personal-imap/accounts/:id] reconcile error:", err);
    });
  }

  return NextResponse.json({ success: true });
}
