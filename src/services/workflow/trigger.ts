import { prisma } from "@/lib/prisma";
import { triggerWorkflow } from "./engine";
import type { Email } from "@prisma/client";
import type { EmailContext } from "@/lib/workflow/types";

/**
 * Trigger workflows when a new email is received
 */
export async function triggerEmailWorkflows(
  email: Email,
  mailboxId: string,
  userId: string
): Promise<void> {
  try {
    console.log(`[workflow-trigger] Looking for workflows for user ${userId}, mailbox ${mailboxId}`);

    // Find all active workflows for this user
    const workflows = await prisma.workflow.findMany({
      where: {
        userId,
        status: "ACTIVE",
        config: {
          contains: '"trigger:email"',
        },
      },
    });

    console.log(`[workflow-trigger] Found ${workflows.length} active workflows with email trigger`);

    if (workflows.length === 0) {
      return;
    }

    // Create email context
    const emailContext: EmailContext = {
      id: email.id,
      messageId: email.messageId || undefined,
      fromAddress: email.fromAddress,
      fromName: email.fromName || undefined,
      toAddress: email.toAddress,
      subject: email.subject,
      textBody: email.textBody || undefined,
      htmlBody: email.htmlBody || undefined,
      receivedAt: email.receivedAt,
    };

    // Trigger each workflow
    for (const workflow of workflows) {
      try {
        // Check if workflow should be triggered for this mailbox
        if (workflow.mailboxId && workflow.mailboxId !== mailboxId) {
          console.log(`[workflow-trigger] Skipping workflow ${workflow.id} - mailbox mismatch (workflow: ${workflow.mailboxId}, email: ${mailboxId})`);
          continue;
        }

        console.log(`[workflow-trigger] Triggering workflow ${workflow.id} (${workflow.name})`);

        // Trigger workflow asynchronously
        await triggerWorkflow(
          workflow.id,
          `email:${email.id}`,
          emailContext
        );

        console.log(`[workflow-trigger] Successfully triggered workflow ${workflow.id}`);
      } catch (error) {
        console.error(`[workflow-trigger] Failed to trigger workflow ${workflow.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[workflow-trigger] Error triggering email workflows:", error);
  }
}
