import { ImapFlow } from "imapflow";

export type ImapLoginParams = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

export async function testImapLogin(params: ImapLoginParams): Promise<void> {
  const client = new ImapFlow({
    host: params.host,
    port: params.port,
    secure: params.secure,
    auth: {
      user: params.username,
      pass: params.password,
    },
    logger: false,
    emitLogs: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    lock.release();
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore logout errors after connectivity checks.
    }
  }
}
