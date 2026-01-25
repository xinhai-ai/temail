"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type EditMailboxNoteDialogProps = {
  open: boolean;
  mailboxAddress: string | null;
  note: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
};

export function EditMailboxNoteDialog({
  open,
  mailboxAddress,
  note,
  saving,
  onOpenChange,
  onNoteChange,
  onSave,
}: EditMailboxNoteDialogProps) {
  const t = useTranslations("inbox");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mailboxes.dialog.editNote")}</DialogTitle>
          {mailboxAddress ? (
            <DialogDescription className="break-all">
              {mailboxAddress}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="mailbox-note">{t("mailboxes.dialog.noteOptional")}</Label>
          <Input
            id="mailbox-note"
            placeholder={t("mailboxes.dialog.notePlaceholder")}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            autoFocus
            disabled={saving}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("mailboxes.actions.saving") : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

