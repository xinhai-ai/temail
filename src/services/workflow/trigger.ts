import { prisma } from "@/lib/prisma";
import { triggerWorkflow } from "./engine";
import { logWorkflowDispatch, updateDispatchLogExecution } from "./logging";
import type { Email } from "@prisma/client";
import type { EmailContext } from "@/lib/workflow/types";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

/**
 * Trigger workflows when a new email is received
 */
export async function triggerEmailWorkflows(
  email: Email,
  mailboxId: string,
  userId: string
): Promise<void> {
  try {
    const feature = await assertUserGroupFeatureEnabled({ userId, feature: "workflow" });
    if (!feature.ok) {
      console.log(`[workflow-trigger] Skipping workflows for user ${userId}: ${feature.error}`);
      return;
    }

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

          // Log the skipped dispatch
          await logWorkflowDispatch({
            workflowId: workflow.id,
            workflowName: workflow.name,
            triggerType: "email",
            emailId: email.id,
            emailFrom: email.fromAddress,
            emailTo: email.toAddress,
            emailSubject: email.subject,
            dispatched: false,
            skipReason: `Mailbox mismatch: workflow bound to ${workflow.mailboxId}, email received at ${mailboxId}`,
          });

          continue;
        }

        console.log(`[workflow-trigger] Triggering workflow ${workflow.id} (${workflow.name})`);

        // Log the dispatch before triggering
        const dispatchLogId = await logWorkflowDispatch({
          workflowId: workflow.id,
          workflowName: workflow.name,
          triggerType: "email",
          emailId: email.id,
          emailFrom: email.fromAddress,
          emailTo: email.toAddress,
          emailSubject: email.subject,
          dispatched: true,
        });

        // Trigger workflow asynchronously
        const executionId = await triggerWorkflow(
          workflow.id,
          `email:${email.id}`,
          emailContext
        );

        // Update dispatch log with execution ID
        await updateDispatchLogExecution(dispatchLogId, executionId);

        console.log(`[workflow-trigger] Successfully triggered workflow ${workflow.id}, execution: ${executionId}`);
      } catch (error) {
        console.error(`[workflow-trigger] Failed to trigger workflow ${workflow.id}:`, error);

        // Log the failed dispatch
        await logWorkflowDispatch({
          workflowId: workflow.id,
          workflowName: workflow.name,
          triggerType: "email",
          emailId: email.id,
          emailFrom: email.fromAddress,
          emailTo: email.toAddress,
          emailSubject: email.subject,
          dispatched: false,
          skipReason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    console.error("[workflow-trigger] Error triggering email workflows:", error);
  }
}
