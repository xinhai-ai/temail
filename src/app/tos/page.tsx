import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service · TEmail",
  description: "Terms of Service for using this TEmail instance.",
};

const LAST_UPDATED = "January 19, 2026";

export default function TosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-border/60">
                <Mail className="h-5 w-5 text-primary" />
              </span>
              <span className="text-base font-semibold tracking-tight">TEmail</span>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="space-y-10">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            <p className="text-muted-foreground leading-relaxed">
              These Terms govern your access to and use of this TEmail instance (the
              “Service”). By using the Service, you agree to these Terms.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-6 sm:p-8 space-y-6">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">1. Operator</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Service is operated by the administrator of the server hosting it (the
                “Operator”). If you are self-hosting, you are the Operator and are
                responsible for configuring, maintaining, and complying with applicable
                laws for your deployment.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">2. Accounts</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account
                credentials and for all activity under your account. You must provide
                accurate information and keep it up to date.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">3. Acceptable Use</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You agree not to misuse the Service. This includes (but is not limited to)
                sending or facilitating spam, phishing, malware distribution, unlawful
                content, or attempting to gain unauthorized access to systems or data.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                4. Inbound Email Content
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Emails received into your inboxes may contain personal data or sensitive
                information. You are solely responsible for the content you receive, store,
                forward, or process using the Service, and for obtaining any necessary
                rights or consents.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                5. Forwarding and Workflows
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you configure forwarding rules or workflows, you are responsible for the
                destinations you select and the outcomes produced. The Operator may apply
                rate limits or restrictions to protect service stability.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">6. Availability</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Service is provided on an “as is” and “as available” basis. The Operator
                does not guarantee uninterrupted or error-free operation. Maintenance,
                upgrades, or incidents may cause downtime.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">7. Termination</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Operator may suspend or terminate access to the Service if you violate
                these Terms or if necessary to protect the Service, other users, or the
                Operator’s systems.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">8. Changes</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Operator may update these Terms from time to time. Continued use of the
                Service after changes become effective constitutes acceptance of the updated
                Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">9. Contact</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For questions about these Terms, contact the Operator of this Service.
              </p>
            </section>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            This document is provided for general informational purposes and does not
            constitute legal advice. Consider consulting qualified counsel to tailor terms
            for your specific deployment and jurisdiction.
          </p>
        </div>
      </main>
    </div>
  );
}

