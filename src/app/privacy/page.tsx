import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy · TEmail",
  description: "Privacy Policy for using this TEmail instance.",
};

const LAST_UPDATED = "January 19, 2026";

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy explains how the Operator of this TEmail instance
              collects, uses, and protects information when you use the Service.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-6 sm:p-8 space-y-6">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">1. Who we are</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Service is operated by the administrator of the server hosting it (the
                “Operator”). If you are using a self-hosted deployment, the Operator may be
                an individual or organization running this instance.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                2. Information we process
              </h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>
                  <span className="font-medium text-foreground">Account data:</span>{" "}
                  email address, optional name, and authentication data necessary to sign in.
                </li>
                <li>
                  <span className="font-medium text-foreground">Email data:</span>{" "}
                  inbound email metadata (e.g., from/to/subject/time) and message content you
                  receive or store in the Service.
                </li>
                <li>
                  <span className="font-medium text-foreground">Operational data:</span>{" "}
                  logs and technical data (e.g., timestamps, actions, delivery results) used
                  to keep the Service secure and reliable.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                3. How we use information
              </h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve the Service.</li>
                <li>Authenticate users and prevent abuse, spam, and fraud.</li>
                <li>Deliver inbound email, forwarding, and workflow processing.</li>
                <li>Debug issues, monitor performance, and ensure stability.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                4. Sharing and disclosures
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Operator does not sell personal information. The Operator may share
                information only as necessary to run the Service (for example, with
                infrastructure providers used by the Operator), to comply with legal
                obligations, or to protect the Service and its users.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">5. Data retention</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Service retains email and operational data as configured by the Operator.
                Retention may depend on mailbox settings, trash policies, and storage limits.
                You may delete content where the Service provides controls to do so.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">6. Security</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Operator uses reasonable measures to protect the Service. However, no
                method of transmission or storage is 100% secure, and the Operator cannot
                guarantee absolute security.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">7. Your choices</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Depending on how this instance is configured, you may access, export, or
                delete certain data through the application. You may also contact the
                Operator to request access or deletion, subject to applicable law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">8. Changes</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Operator may update this Privacy Policy from time to time. Continued use
                of the Service after changes become effective constitutes acceptance of the
                updated policy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">9. Contact</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For privacy questions or requests, contact the Operator of this Service.
              </p>
            </section>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            This document is provided for general informational purposes and does not
            constitute legal advice. Consider consulting qualified counsel to tailor this
            policy for your specific deployment and jurisdiction.
          </p>
        </div>
      </main>
    </div>
  );
}

