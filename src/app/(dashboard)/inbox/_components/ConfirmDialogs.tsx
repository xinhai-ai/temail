"use client";

import { useTranslations } from "next-intl";
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
  const tCommon = useTranslations("common");
  const t = useTranslations("inbox");

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
            <AlertDialogTitle>{t("confirm.moveToTrash.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.moveToTrash.description")}
            </AlertDialogDescription>
            <div className="flex items-center gap-2 pt-3">
              <Checkbox
                id="skip-delete-email-confirm"
                checked={skipEmailDeleteConfirm}
                onCheckedChange={(checked) => onSkipEmailDeleteConfirmChange(Boolean(checked))}
              />
              <Label htmlFor="skip-delete-email-confirm" className="text-sm text-muted-foreground">
                {t("confirm.dontRemindAgain")}
              </Label>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteEmail}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("confirm.moving") : t("confirm.moveToTrash.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={onBulkDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.bulkMoveToTrash.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.bulkMoveToTrash.description", { count: selectedEmailCount })}
            </AlertDialogDescription>
            <div className="flex items-center gap-2 pt-3">
              <Checkbox
                id="skip-bulk-delete-email-confirm"
                checked={skipEmailDeleteConfirm}
                onCheckedChange={(checked) => onSkipEmailDeleteConfirmChange(Boolean(checked))}
              />
              <Label htmlFor="skip-bulk-delete-email-confirm" className="text-sm text-muted-foreground">
                {t("confirm.dontRemindAgain")}
              </Label>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("confirm.moving") : t("confirm.moveToTrash.action")}
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
            <AlertDialogTitle>{t("confirm.deleteMailbox.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.deleteMailbox.description", { address: deleteMailboxAddress || "-" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteMailbox}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("confirm.deleting") : tCommon("delete")}
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
            <AlertDialogTitle>{t("confirm.deleteGroup.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.deleteGroup.description", { name: deleteGroup?.name ?? "-" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteGroup}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("confirm.deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
