export type EmailStatus = "UNREAD" | "READ" | "ARCHIVED" | "DELETED";

export type RealtimeEmailSummary = {
  id: string;
  mailboxId: string;
  mailboxAddress: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  status: EmailStatus;
  isStarred: boolean;
  receivedAt: string;
};

export type RealtimeEvent =
  | { type: "email.created"; data: { email: RealtimeEmailSummary } }
  | {
      type: "email.updated";
      data: {
        id: string;
        mailboxId: string;
        status?: EmailStatus;
        isStarred?: boolean;
      };
    }
  | { type: "email.deleted"; data: { id: string; mailboxId: string } }
  | {
      type: "emails.bulk_updated";
      data: {
        action: "markRead" | "delete" | "archive" | "unarchive" | "restore" | "purge";
        ids: string[];
        mailboxId?: string;
      };
    };

export type RealtimeEnvelope = {
  id: string;
  ts: string;
  event: RealtimeEvent;
};
