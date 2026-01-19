"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Mailbox, MailboxGroup } from "../types";

type ConfirmDialogsProps = {
  deleteEmailId: string | null;
  skipEmailDeleteConfirm: boolean;
  bulkDeleteOpen: boolean;
  selectedEmailCount: number;
  deleteMailboxId: string | null;
  deleteGroup: MailboxGroup | null;
  deleting: boolean;
  mailboxes: Mailbox[];
  onDeleteEmailIdChange: (id: string | null) => void;
  onSkipEmailDeleteConfirmChange: (skip: boolean) => void;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onDeleteMailboxIdChange: (id: string | null) => void;
  onDeleteGroupChange: (group: MailboxGroup | null) => void;
  onConfirmDeleteEmail: () => void;
  onConfirmBulkDelete: () => void;
  onConfirmDeleteMailbox: () => void;
  onConfirmDeleteGroup: () => void;
};

export function ConfirmDialogs({
  deleteEmailId,
  skipEmailDeleteConfirm,
  bulkDeleteOpen,
  selectedEmailCount,
  deleteMailboxId,
  deleteGroup,
  deleting,
  mailboxes,
  onDeleteEmailIdChange,
  onSkipEmailDeleteConfirmChange,
  onBulkDeleteOpenChange,
  onDeleteMailboxIdChange,
  onDeleteGroupChange,
  onConfirmDeleteEmail,
  onConfirmBulkDelete,
  onConfirmDeleteMailbox,
  onConfirmDeleteGroup,
}: ConfirmDialogsProps) {
  const deleteMailboxAddress = deleteMailboxId
    ? mailboxes.find((m) => m.id === deleteMailboxId)?.address
    : null;

  return (
    <>
      <AlertDialog
        open={Boolean(deleteEmailId)}
        onOpenChange={(open) => !open && onDeleteEmailIdChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash</AlertDialogTitle>
            <AlertDialogDescription>
              This email will be moved to Trash. You can restore it later from the Trash page.
            </AlertDialogDescription>
            <div className="flex items-center gap-2 pt-3">
              <Checkbox
                id="skip-delete-email-confirm"
                checked={skipEmailDeleteConfirm}
                onCheckedChange={(checked) => onSkipEmailDeleteConfirmChange(Boolean(checked))}
              />
              <Label htmlFor="skip-delete-email-confirm" className="text-sm text-muted-foreground">
                Don&apos;t remind me again
              </Label>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteEmail}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Moving..." : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={onBulkDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Emails to Trash</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedEmailCount} selected emails to Trash? You can restore them later from the Trash page.
            </AlertDialogDescription>
            <div className="flex items-center gap-2 pt-3">
              <Checkbox
                id="skip-bulk-delete-email-confirm"
                checked={skipEmailDeleteConfirm}
                onCheckedChange={(checked) => onSkipEmailDeleteConfirmChange(Boolean(checked))}
              />
              <Label htmlFor="skip-bulk-delete-email-confirm" className="text-sm text-muted-foreground">
                Don&apos;t remind me again
              </Label>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Moving..." : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteMailboxId)}
        onOpenChange={(open) => !open && onDeleteMailboxIdChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mailbox</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete mailbox &quot;
              {deleteMailboxAddress || "-"}&quot;? All emails in this mailbox will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteMailbox}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteGroup)}
        onOpenChange={(open) => !open && onDeleteGroupChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete group &quot;{deleteGroup?.name}&quot;? Mailboxes in
              this group will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteGroup}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
