"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">You are offline</h1>
            <p className="text-sm text-muted-foreground">Unable to reach the network right now.</p>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          TEmail core shell is still available. Reconnect to sync inbox and account data.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:w-auto" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
