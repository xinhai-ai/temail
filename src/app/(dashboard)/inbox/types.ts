export type Domain = {
  id: string;
  name: string;
};

export type MailboxGroup = {
  id: string;
  name: string;
  color?: string | null;
};

export type Mailbox = {
  id: string;
  address: string;
  note?: string | null;
  isStarred: boolean;
  status: string;
  group?: MailboxGroup | null;
  _count: { emails: number }; // unread count
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
};

export type EmailDetail = EmailListItem & {
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: string | null;
};

