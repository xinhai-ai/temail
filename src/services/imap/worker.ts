import { ImapFlow, type MailboxObject } from "imapflow";
import prisma from "@/lib/prisma";
import { decryptString } from "@/lib/secret-encryption";
import {
  type ImapDomain,
  type SyncOptions,
  syncUnseenMessages,
  syncByUidRange,
  recordSyncError,
  resetSyncErrors,
} from "@/services/imap/sync";

export type WorkerConfig = {
  idleTimeoutMs: number;     // IDLE timeout (default: 25 min)
  heartbeatMs: number;       // NOOP interval (default: 5 min)
  reconnectMinMs: number;    // Min reconnect delay (default: 1s)
  reconnectMaxMs: number;    // Max reconnect delay (default: 5 min)
  maxConsecutiveErrors: number; // Max errors before stopping (default: 10)
};

export type WorkerStatus = "idle" | "connecting" | "syncing" | "error" | "stopped";

export type WorkerState = {
  status: WorkerStatus;
  domainId: string;
  domainName: string;
  lastSync?: Date;
  lastError?: string;
  consecutiveErrors: number;
  connectedAt?: Date;
};

const DEFAULT_CONFIG: WorkerConfig = {
  idleTimeoutMs: 25 * 60 * 1000,     // 25 minutes (RFC 2177 suggests < 29 min)
  heartbeatMs: 5 * 60 * 1000,        // 5 minutes
  reconnectMinMs: 1000,              // 1 second
  reconnectMaxMs: 5 * 60 * 1000,     // 5 minutes
  maxConsecutiveErrors: 10,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getReconnectDelay(attempt: number, config: WorkerConfig): number {
  const base = Math.min(config.reconnectMaxMs, config.reconnectMinMs * Math.pow(2, Math.min(attempt, 10)));
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(config.reconnectMaxMs, base + jitter);
}

export class EnhancedDomainWorker {
  private readonly domain: ImapDomain;
  private readonly config: WorkerConfig;
  private readonly syncOptions: SyncOptions;
  private readonly abortController: AbortController;
  private readonly signal: AbortSignal;
  private readonly configHash: string;  // Hash of actual config values
  private readonly debug: boolean;

  private client: ImapFlow | null = null;
  private mailbox: MailboxObject | null = null;
  private status: WorkerStatus = "idle";
  private lastSync?: Date;
  private lastError?: string;
  private consecutiveErrors = 0;
  private connectedAt?: Date;
  private runPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;

  constructor(
    domain: ImapDomain,
    options?: Partial<WorkerConfig> & { syncOptions?: SyncOptions }
  ) {
    this.domain = domain;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.syncOptions = options?.syncOptions || {};
    this.debug = this.syncOptions.debug ?? false;
    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    // Create hash of config values that matter for connection
    this.configHash = this.computeConfigHash(domain);
  }

  private computeConfigHash(domain: ImapDomain): string {
    const { imapConfig } = domain;
    const personal = domain.personalImapAccount;
    // Only include fields that affect the connection
    return JSON.stringify({
      sourceType: domain.sourceType,
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      username: imapConfig.username,
      password: imapConfig.password,
      syncInterval: imapConfig.syncInterval,
      personalStatus: personal?.status ?? null,
      personalUsername: personal?.username ?? null,
      personalPasswordCiphertext: personal?.passwordCiphertext ?? null,
      personalPasswordIv: personal?.passwordIv ?? null,
      personalPasswordTag: personal?.passwordTag ?? null,
    });
  }

  get state(): WorkerState {
    return {
      status: this.status,
      domainId: this.domain.id,
      domainName: this.domain.name,
      lastSync: this.lastSync,
      lastError: this.lastError,
      consecutiveErrors: this.consecutiveErrors,
      connectedAt: this.connectedAt,
    };
  }

  getConfigHash(): string {
    return this.configHash;
  }

  matchesConfig(domain: ImapDomain): boolean {
    return this.configHash === this.computeConfigHash(domain);
  }

  start(): void {
    if (this.runPromise) return;
    this.runPromise = this.run();
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = (async () => {
      this.status = "stopped";
      this.abortController.abort();

      if (this.client) {
        try {
          await this.client.logout();
        } catch {
          // ignore
        }
        this.client = null;
      }

      if (this.runPromise) {
        await this.runPromise.catch(() => {});
      }
    })();

    return this.stopPromise;
  }

  async triggerSync(): Promise<void> {
    if (this.status === "stopped" || !this.client || !this.mailbox) {
      return;
    }

    try {
      this.status = "syncing";
      const lock = await this.client.getMailboxLock("INBOX");
      try {
        await syncByUidRange(this.client, this.domain, this.mailbox, this.syncOptions);
        this.lastSync = new Date();
      } finally {
        lock.release();
      }
      this.status = "idle";
    } catch (error) {
      this.log(`sync error: ${error}`);
    }
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    // Always log for now to debug IDLE issues
    const prefix = `[imap-worker] domain=${this.domain.name}`;
    if (meta) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private async run(): Promise<void> {
    let attempt = 0;

    while (!this.signal.aborted) {
      try {
        await this.connectAndIdle();
        attempt = 0;
        this.consecutiveErrors = 0;
      } catch (error) {
        if (this.signal.aborted) break;

        this.status = "error";
        this.consecutiveErrors++;
        this.lastError = error instanceof Error ? error.message : String(error);

        await recordSyncError(this.domain.id, error).catch(() => {});

        const isAuthError = this.isAuthenticationError(error);
        if (isAuthError) {
          this.log(`authentication failed, stopping worker`);
          await prisma.domain.update({
            where: { id: this.domain.id },
            data: { status: "ERROR" },
          }).catch(() => {});
          break;
        }

        if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
          this.log(`max consecutive errors (${this.config.maxConsecutiveErrors}) reached, stopping worker`);
          await prisma.domain.update({
            where: { id: this.domain.id },
            data: { status: "ERROR" },
          }).catch(() => {});
          break;
        }

        console.error(`[imap-worker] domain=${this.domain.name} error:`, error);
        await prisma.domain.update({
          where: { id: this.domain.id },
          data: { status: "ERROR" },
        }).catch(() => {});
      } finally {
        if (this.client) {
          try {
            await this.client.logout();
          } catch {
            // ignore
          }
          this.client = null;
          this.mailbox = null;
        }
        this.connectedAt = undefined;
      }

      if (this.signal.aborted) break;

      attempt++;
      const delay = getReconnectDelay(attempt, this.config);
      this.log(`reconnecting in ${delay}ms (attempt ${attempt})`);
      await sleep(delay);
    }

    this.status = "stopped";
  }

  private async connectAndIdle(): Promise<void> {
    this.status = "connecting";
    this.log("connecting");

    const { imapConfig } = this.domain;
    const auth =
      this.domain.sourceType === "PERSONAL_IMAP"
        ? this.getPersonalImapAuth()
        : {
            user: imapConfig.username,
            pass: imapConfig.password,
          };

    this.client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      auth,
      logger: false,
      emitLogs: this.debug,
      maxIdleTime: this.config.idleTimeoutMs,
    });

    // Track if we need to break IDLE
    let idleResolve: (() => void) | null = null;

    // Set up event handlers for connection monitoring
    this.client.on("error", (err) => {
      this.log(`[event] error: ${err.message}`);
    });

    this.client.on("close", () => {
      this.log("[event] close");
      // Break IDLE if connection closed
      if (idleResolve) {
        idleResolve();
        idleResolve = null;
      }
    });

    // IDLE related events - these should break IDLE to sync
    this.client.on("exists", (data) => {
      this.log(`[event] exists: ${JSON.stringify(data)}`);
      // New message arrived - break IDLE to sync
      if (idleResolve) {
        this.log("breaking IDLE due to new message");
        idleResolve();
        idleResolve = null;
      }
    });

    this.client.on("expunge", (data) => {
      this.log(`[event] expunge: ${JSON.stringify(data)}`);
    });

    this.client.on("flags", (data) => {
      this.log(`[event] flags: ${JSON.stringify(data)}`);
    });

    this.client.on("log", (entry) => {
      this.log(`[event] log: ${JSON.stringify(entry)}`);
    });

    this.client.on("mailboxOpen", (mailbox) => {
      this.log(`[event] mailboxOpen: ${mailbox.path}, exists=${mailbox.exists}, uidNext=${mailbox.uidNext}`);
    });

    this.client.on("mailboxClose", (mailbox) => {
      this.log(`[event] mailboxClose: ${mailbox.path}`);
    });

    await this.client.connect();
    this.connectedAt = new Date();
    this.log("connected");

    await prisma.domain.update({
      where: { id: this.domain.id },
      data: { status: "ACTIVE" },
    });

    await resetSyncErrors(this.domain.id);

    // Get mailbox lock and keep it for the entire session
    const lock = await this.client.getMailboxLock("INBOX");

    try {
      this.mailbox = this.client.mailbox as MailboxObject;

      // Initial sync
      this.status = "syncing";
      this.log("initial sync");
      await syncByUidRange(this.client, this.domain, this.mailbox, this.syncOptions);
      this.lastSync = new Date();

      // IDLE loop
      while (!this.signal.aborted && this.client.usable) {
        this.status = "idle";
        this.log("entering IDLE mode");

        try {
          // Create a promise that resolves when we need to break IDLE
          const breakIdlePromise = new Promise<void>((resolve) => {
            idleResolve = resolve;
          });

          // Race between IDLE timeout and break signal
          await Promise.race([
            this.client.idle(),
            breakIdlePromise,
          ]);

          // Clear the resolve function
          idleResolve = null;

          this.log("IDLE interrupted or timed out");

          // After IDLE returns, sync new messages
          if (!this.signal.aborted && this.client.usable) {
            this.status = "syncing";
            this.mailbox = this.client.mailbox as MailboxObject;
            const result = await syncUnseenMessages(this.client, this.domain, this.syncOptions);
            this.lastSync = new Date();

            if (result.processed > 0) {
              this.log(`synced ${result.processed} new messages`);
            }
          }
        } catch (idleError) {
          // IDLE might fail if connection drops
          if (this.signal.aborted) break;
          throw idleError;
        }
      }
    } finally {
      lock.release();
    }
  }

  private isAuthenticationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes("authentication") ||
      msg.includes("auth failed") ||
      msg.includes("invalid credentials") ||
      msg.includes("login failed") ||
      msg.includes("authenticationfailed")
    );
  }

  private getPersonalImapAuth(): { user: string; pass: string } {
    const account = this.domain.personalImapAccount;
    if (!account) {
      throw new Error("Missing personal IMAP account configuration");
    }
    if (account.status === "DISABLED") {
      throw new Error("Personal IMAP account is disabled");
    }
    const pass = decryptString({
      ciphertext: account.passwordCiphertext,
      iv: account.passwordIv,
      tag: account.passwordTag,
    });
    return {
      user: account.username,
      pass,
    };
  }
}
