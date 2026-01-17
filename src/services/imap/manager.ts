import prisma from "@/lib/prisma";
import { Scheduler, type SchedulerConfig } from "@/services/imap/scheduler";
import { EnhancedDomainWorker, type WorkerConfig, type WorkerState } from "@/services/imap/worker";
import type { ImapDomain, SyncOptions } from "@/services/imap/sync";

export type ManagerConfig = {
  scheduler: Partial<SchedulerConfig>;
  worker: Partial<WorkerConfig>;
  syncOptions: SyncOptions;
  debug: boolean;
};

export type ManagerStatus = {
  startedAt: Date;
  workersCount: number;
  workers: WorkerState[];
  scheduler: Array<{ name: string; lastRun?: Date }>;
};

const DEFAULT_MANAGER_CONFIG: ManagerConfig = {
  scheduler: {},
  worker: {},
  syncOptions: {},
  debug: false,
};

export class ImapServiceManager {
  private readonly config: ManagerConfig;
  private readonly scheduler: Scheduler;
  private readonly workers: Map<string, EnhancedDomainWorker> = new Map();
  private readonly startedAt: Date;

  private stopped = false;
  private reconciling = false;

  constructor(config?: Partial<ManagerConfig>) {
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };
    this.config.syncOptions = { ...this.config.syncOptions, debug: this.config.debug };
    this.scheduler = new Scheduler({ ...this.config.scheduler, debug: this.config.debug });
    this.startedAt = new Date();
  }

  start(): void {
    if (this.stopped) return;

    this.log("starting IMAP service manager");

    // Schedule reconcile task
    this.scheduler.schedule({
      name: "reconcile",
      intervalMs: this.config.scheduler.reconcileMs || 30_000,
      handler: () => this.reconcile(),
    });

    // Schedule full sync task
    this.scheduler.schedule({
      name: "fullSync",
      intervalMs: this.config.scheduler.fullSyncMs || 5 * 60_000,
      handler: () => this.fullSyncAll(),
    });

    // Schedule health check task
    this.scheduler.schedule({
      name: "healthCheck",
      intervalMs: this.config.scheduler.healthCheckMs || 60_000,
      handler: () => this.healthCheck(),
    });

    this.log("IMAP service manager started");
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.log("stopping IMAP service manager");

    this.scheduler.stop();

    const workers = Array.from(this.workers.values());
    this.workers.clear();

    await Promise.all(workers.map((w) => w.stop()));

    this.log("IMAP service manager stopped");
  }

  getStatus(): ManagerStatus {
    return {
      startedAt: this.startedAt,
      workersCount: this.workers.size,
      workers: Array.from(this.workers.values()).map((w) => w.state),
      scheduler: this.scheduler.getTaskStatus(),
    };
  }

  async reconcileNow(): Promise<void> {
    await this.reconcile();
  }

  async syncDomain(domainId: string): Promise<{ success: boolean; message: string }> {
    const worker = this.workers.get(domainId);
    if (!worker) {
      return { success: false, message: "Domain not found or not configured for IMAP" };
    }

    try {
      await worker.triggerSync();
      return { success: true, message: "Sync triggered" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async syncAll(): Promise<{ success: boolean; count: number }> {
    let count = 0;

    for (const worker of this.workers.values()) {
      try {
        await worker.triggerSync();
        count++;
      } catch {
        // continue to next worker
      }
    }

    return { success: true, count };
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    if (!this.config.debug) return;
    const prefix = "[imap-manager]";
    if (meta) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private async reconcile(): Promise<void> {
    if (this.stopped) return;
    if (this.reconciling) return;

    this.reconciling = true;
    try {
      this.log("reconciling workers");

      const domains = await prisma.domain.findMany({
        where: { sourceType: "IMAP", status: { not: "INACTIVE" } },
        include: { imapConfig: true },
        orderBy: { createdAt: "asc" },
      });

      const activeDomains = domains.filter((d): d is ImapDomain => Boolean(d.imapConfig));
      const desired = new Map(activeDomains.map((d) => [d.id, d]));

      // Stop workers for removed/disabled domains
      for (const [domainId, worker] of this.workers) {
        const current = desired.get(domainId);

        if (!current) {
          this.log(`stopping worker for removed domain ${domainId}`);
          await worker.stop();
          this.workers.delete(domainId);
          continue;
        }

        // Restart worker if config changed (only connection-related fields)
        if (!worker.matchesConfig(current.imapConfig)) {
          this.log(`restarting worker for domain ${current.name} (config changed)`);
          await worker.stop();
          this.workers.delete(domainId);
        }
      }

      // Start workers for new domains
      for (const domain of activeDomains) {
        if (this.stopped) return;
        if (this.workers.has(domain.id)) continue;

        this.log(`starting worker for domain ${domain.name}`);
        const worker = new EnhancedDomainWorker(domain, {
          ...this.config.worker,
          syncOptions: this.config.syncOptions,
        });
        worker.start();
        this.workers.set(domain.id, worker);
      }

      this.log(`reconciliation complete: ${this.workers.size} workers active`);
    } catch (error) {
      console.error("[imap-manager] reconcile error:", error);
    } finally {
      this.reconciling = false;
    }
  }

  private async fullSyncAll(): Promise<void> {
    if (this.stopped) return;

    this.log("triggering full sync for all domains");

    for (const worker of this.workers.values()) {
      if (this.stopped) return;
      try {
        await worker.triggerSync();
      } catch (error) {
        this.log(`full sync failed for ${worker.state.domainName}: ${error}`);
      }
    }
  }

  private async healthCheck(): Promise<void> {
    if (this.stopped) return;

    const statuses = Array.from(this.workers.values()).map((w) => w.state);

    const errorWorkers = statuses.filter((s) => s.status === "error");
    const stoppedWorkers = statuses.filter((s) => s.status === "stopped");

    if (errorWorkers.length > 0) {
      this.log(`health check: ${errorWorkers.length} workers in error state`, {
        domains: errorWorkers.map((w) => w.domainName),
      });
    }

    if (stoppedWorkers.length > 0) {
      this.log(`health check: ${stoppedWorkers.length} workers stopped`, {
        domains: stoppedWorkers.map((w) => w.domainName),
      });
    }

    if (this.config.debug) {
      this.log("health check complete", {
        total: statuses.length,
        idle: statuses.filter((s) => s.status === "idle").length,
        connecting: statuses.filter((s) => s.status === "connecting").length,
        syncing: statuses.filter((s) => s.status === "syncing").length,
        error: errorWorkers.length,
        stopped: stoppedWorkers.length,
      });
    }
  }
}
