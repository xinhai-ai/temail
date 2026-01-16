import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { normalizeForwardRuleConfig, normalizeForwardTargetConfig, type ForwardDestination } from "@/services/forward-config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rule = await prisma.forwardRule.findUnique({
    where: { id },
    include: { targets: true },
  });

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  try {
    const testMessage = {
      subject: "Test Forward - TEmail (Admin)",
      from: "test@temail.local",
      to: "test@temail.local",
      text: "This is a test message from TEmail forward system (admin).",
      timestamp: new Date().toISOString(),
    };

    type RuntimeTarget = { targetId?: string; destination: ForwardDestination } | { targetId?: string; error: string };

    const runtimeTargets: RuntimeTarget[] = (() => {
      if (rule.targets.length > 0) {
        return rule.targets.map((t) => {
          const normalized = normalizeForwardTargetConfig(t.type, t.config);
          if (!normalized.ok) return { targetId: t.id, error: normalized.error };
          return { targetId: t.id, destination: normalized.destination };
        });
      }

      const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
      if (!normalized.ok) return [{ error: normalized.error }];
      return [{ destination: normalized.config.destination }];
    })();

    const results: Array<{ targetId?: string; type?: string; success: boolean; message: string; responseCode?: number }> = [];

    for (const t of runtimeTargets) {
      if ("error" in t) {
        results.push({ targetId: t.targetId, success: false, message: t.error });
        await prisma.forwardLog.create({
          data: { ruleId: id, ...(t.targetId ? { targetId: t.targetId } : {}), success: false, message: t.error },
        });
        continue;
      }

      const destination = t.destination;
      const result = await (async () => {
        switch (destination.type) {
          case "TELEGRAM":
            return sendTelegram(destination, testMessage);
          case "DISCORD":
            return sendDiscord(destination, testMessage);
          case "SLACK":
            return sendSlack(destination, testMessage);
          case "WEBHOOK":
            return sendWebhook(destination, testMessage);
          case "EMAIL":
            return { success: true, message: "Email forward test skipped" };
        }
      })();

      await prisma.forwardLog.create({
        data: {
          ruleId: id,
          ...(t.targetId ? { targetId: t.targetId } : {}),
          success: result.success,
          message: result.message,
          ...(typeof result.code === "number" ? { responseCode: result.code } : {}),
        },
      });

      results.push({
        targetId: t.targetId,
        type: destination.type,
        success: result.success,
        message: result.message,
        ...(typeof result.code === "number" ? { responseCode: result.code } : {}),
      });
    }

    await prisma.forwardRule.update({
      where: { id: rule.id },
      data: { lastTriggered: new Date() },
    }).catch(() => {
      // ignore
    });

    const allOk = results.every((r) => r.success);
    const status = allOk ? 200 : 400;
    return NextResponse.json({ success: allOk, results }, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

interface TestMessage {
  subject: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
}

type SendResult = { success: boolean; message: string; code?: number };

async function sendTelegram(
  destination: Extract<ForwardDestination, { type: "TELEGRAM" }>,
  message: TestMessage
): Promise<SendResult> {
  const text = `📧 *Test Email*\\n\\n*From:* ${message.from}\\n*To:* ${message.to}\\n*Subject:* ${message.subject}\\n\\n${message.text}`;

  const res = await fetch(
    `https://api.telegram.org/bot${destination.token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify({
        chat_id: destination.chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );

  if (res.ok) {
    return { success: true, message: "Telegram message sent", code: res.status };
  }
  const data = await res.json();
  return { success: false, message: data.description || "Telegram failed", code: res.status };
}

async function sendDiscord(
  destination: Extract<ForwardDestination, { type: "DISCORD" }>,
  message: TestMessage
): Promise<SendResult> {
  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const res = await fetch(validated.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...destination.headers },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body: JSON.stringify({
      embeds: [
        {
          title: `📧 ${message.subject}`,
          description: message.text,
          color: 0xf59e0b,
          fields: [
            { name: "From", value: message.from, inline: true },
            { name: "To", value: message.to, inline: true },
          ],
          timestamp: message.timestamp,
        },
      ],
    }),
  });

  return res.ok
    ? { success: true, message: "Discord message sent", code: res.status }
    : { success: false, message: "Discord webhook failed", code: res.status };
}

async function sendSlack(
  destination: Extract<ForwardDestination, { type: "SLACK" }>,
  message: TestMessage
): Promise<SendResult> {
  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const res = await fetch(validated.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...destination.headers },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📧 ${message.subject}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*From:*\\n${message.from}` },
            { type: "mrkdwn", text: `*To:*\\n${message.to}` },
          ],
        },
        {
          type: "section",
          text: { type: "plain_text", text: message.text },
        },
      ],
    }),
  });

  return res.ok
    ? { success: true, message: "Slack message sent", code: res.status }
    : { success: false, message: "Slack webhook failed", code: res.status };
}

async function sendWebhook(
  destination: Extract<ForwardDestination, { type: "WEBHOOK" }>,
  message: TestMessage
): Promise<SendResult> {
  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const res = await fetch(validated.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...destination.headers,
    },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body: JSON.stringify(message),
  });

  return res.ok
    ? { success: true, message: "Webhook sent", code: res.status }
    : { success: false, message: `Webhook failed: ${res.status}`, code: res.status };
}
