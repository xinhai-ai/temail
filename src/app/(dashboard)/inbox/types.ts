export type Domain = {
  id: string;
  name: string;
};

export type MailboxGroup = {
  id: string;
  name: string;
  color?: string | null;
  sortOrder?: number;
  _count?: { mailboxes: number };
};

export type Mailbox = {
  id: string;
  address: string;
  kind?: "ALIAS" | "PERSONAL_IMAP";
  sourceLabel?: string | null;
  note?: string | null;
  isStarred: boolean;
  status: string;
  archivedAt?: string | null;
  lastEmailReceivedAt?: string | null;
  expireMailboxDaysOverride?: number | null;
  expireMailboxActionOverride?: "ARCHIVE" | "DELETE" | null;
  expireEmailDaysOverride?: number | null;
  expireEmailActionOverride?: "ARCHIVE" | "DELETE" | null;
  group?: MailboxGroup | null;
  _count: { emails: number }; // unread count
};

export type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type Tag = {
  id: string;
  name: string;
  color?: string | null;
};

export type EmailListItem = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  status: string;
  isStarred: boolean;
  receivedAt: string;
  mailboxId: string;
  mailbox: { address: string };
  tags?: Tag[];
  snippet?: string | null;
};

export type EmailDetail = EmailListItem & {
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: string | boolean | null;  // true = available via /raw API, string = inline content
  rawContentPath?: string | null;
  attachments?: Attachment[];
};
