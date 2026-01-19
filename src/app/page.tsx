import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Check, FileText, Forward, Globe, Inbox, Mail, Menu, Shield, Zap } from "lucide-react";
import { getRegistrationMode } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, mode] = await Promise.all([auth(), getRegistrationMode()]);
  const canRegister = mode !== "closed";
  const isAuthed = Boolean(session);

  const primaryCta = isAuthed
    ? { href: "/dashboard", label: "Open dashboard" }
    : canRegister
      ? { href: "/register", label: "Get started" }
      : { href: "/login", label: "Sign in" };

  const secondaryCta = isAuthed
    ? { href: "/inbox", label: "Go to inbox" }
    : { href: "#features", label: "Explore features" };

  const secondaryCtaNode = secondaryCta.href.startsWith("#") ? (
    <a href={secondaryCta.href}>{secondaryCta.label}</a>
  ) : (
    <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
  );

  const statusBadge =
    mode === "invite"
      ? { label: "Invite-only", className: "bg-muted/60 text-foreground border-border/60" }
      : mode === "closed"
        ? { label: "Sign-in only", className: "bg-muted/60 text-foreground border-border/60" }
        : null;

  const features = [
    {
      icon: Globe,
      title: "Multi-domain inboxes",
      description: "Create inboxes across domains — organize with groups, tags, and search.",
    },
    {
      icon: Inbox,
      title: "Webhook & IMAP ingestion",
      description: "Receive inbound mail via Webhook, or sync from IMAP with the worker service.",
    },
    {
      icon: Forward,
      title: "Powerful forwarding",
      description: "Forward via SMTP/Webhook with templates and safe defaults for production.",
    },
    {
      icon: Zap,
      title: "Workflow automation",
      description: "Trigger workflows on inbound messages to parse, notify, enrich, or route.",
    },
    {
      icon: FileText,
      title: "Observable by design",
      description: "Audit inbound events and rule execution with logs you can actually use.",
    },
    {
      icon: Shield,
      title: "Privacy-first defaults",
      description: "Keep sensitive content private — remote images are blocked by default.",
    },
  ];

  const faqs = [
    {
      q: "Is TEmail self-hosted?",
      a: "Yes. TEmail is designed to run on your own infrastructure. Docker Compose is the recommended way to deploy.",
    },
    {
      q: "How does IMAP syncing work?",
      a: "IMAP syncing runs in a separate worker process that periodically pulls mailboxes and writes them into TEmail.",
    },
    {
      q: "Can I disable registration?",
      a: "Yes. The server supports closed or invite-only registration modes, so you can control access.",
    },
    {
      q: "Do you block tracking pixels?",
      a: "Remote images are blocked by default in the email preview to reduce tracking and protect privacy.",
    },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 h-[720px] w-[720px] rounded-full bg-gradient-to-bl from-primary/25 via-primary/0 to-transparent blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 h-[720px] w-[720px] rounded-full bg-gradient-to-tr from-primary/15 via-primary/0 to-transparent blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow"
          >
            Skip to content
          </a>
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-border/60">
                <Mail className="h-5 w-5 text-primary" />
              </span>
              <span className="text-base font-semibold tracking-tight">TEmail</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how" className="hover:text-foreground transition-colors">
                How it works
              </a>
              <a href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </a>
            </nav>

            <div className="flex items-center gap-2">
              {isAuthed ? (
                <Button variant="outline" asChild>
                  <Link href="/dashboard">Open app</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  {canRegister && (
                    <Button asChild>
                      <Link href="/register">Get started</Link>
                    </Button>
                  )}
                </>
              )}

              <details className="relative md:hidden">
                <summary className="list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </span>
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/60 bg-popover p-2 shadow-lg">
                  <a
                    href="#features"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    Features
                  </a>
                  <a
                    href="#how"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    How it works
                  </a>
                  <a
                    href="#faq"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    FAQ
                  </a>
                  <div className="my-2 h-px bg-border/60" />
                  <Link
                    href="/login"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    Sign in
                  </Link>
                  {canRegister && (
                    <Link
                      href="/register"
                      className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      Get started
                    </Link>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="relative">
        <section className="pt-16 sm:pt-20 lg:pt-24 pb-16 sm:pb-20 lg:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-primary/5 border-primary/20 text-foreground"
                  >
                    Self-hosted
                  </Badge>
                  <Badge variant="secondary" className="bg-muted/60 text-foreground">
                    Webhook • IMAP • Workflows
                  </Badge>
                  {statusBadge && (
                    <Badge variant="outline" className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                  )}
                </div>

                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                  Temporary inboxes, forwarding, and automation — in one platform.
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  Build an inbound email pipeline you can trust. Create multi-domain inboxes,
                  ingest mail via Webhook or IMAP, forward to SMTP/Webhook targets, and run
                  workflows on every message.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button size="lg" asChild>
                    <Link href={primaryCta.href}>
                      {primaryCta.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    {secondaryCtaNode}
                  </Button>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">Privacy-first</span>{" "}
                      previews with remote images blocked.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">Operational</span>{" "}
                      logs for inbound events and automation.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">Flexible</span>{" "}
                      inbound sources: Webhook or IMAP worker.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">Fast</span>{" "}
                      Docker Compose setup with SQLite persistence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-primary/10 via-transparent to-transparent blur-2xl" />
                <div className="rounded-2xl border border-border/60 bg-card/50 shadow-xl backdrop-blur">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Inbox className="h-5 w-5 text-primary" />
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-semibold">Inbox</div>
                        <div className="text-xs text-muted-foreground">
                          demo@inbox.temail.local
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-muted/60 text-foreground">
                      Live
                    </Badge>
                  </div>

                  <div className="grid grid-cols-5 gap-0">
                    <div className="col-span-2 border-r border-border/60 p-3 space-y-2">
                      {[
                        { subject: "Your login code", time: "1m", active: true },
                        { subject: "Invoice ready", time: "7m" },
                        { subject: "Welcome to TEmail", time: "2h" },
                        { subject: "Webhook delivery", time: "1d" },
                      ].map((item) => (
                        <div
                          key={item.subject}
                          className={[
                            "rounded-xl border border-border/60 p-3 transition-colors",
                            item.active ? "bg-primary/5" : "bg-card/40 hover:bg-accent/40",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium truncate">{item.subject}</div>
                            <div className="text-xs text-muted-foreground shrink-0">{item.time}</div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            noreply@example.com
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="col-span-3 p-4 space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Selected email</div>
                        <div className="text-lg font-semibold leading-snug">
                          Your login code
                        </div>
                        <div className="text-sm text-muted-foreground">
                          From <span className="font-medium text-foreground">Acme</span>{" "}
                          • To{" "}
                          <span className="font-mono text-foreground">
                            demo@inbox.temail.local
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                        <div className="text-sm font-medium">Code</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="font-mono text-2xl tracking-widest">384 921</div>
                          <Badge variant="outline" className="bg-background/60 border-border/60">
                            10 min
                          </Badge>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Remote images are blocked by default.
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                          <div className="text-xs text-muted-foreground">Forward</div>
                          <div className="mt-1 text-sm font-medium">SMTP</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                          <div className="text-xs text-muted-foreground">Workflow</div>
                          <div className="mt-1 text-sm font-medium">Notify</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  A lightweight preview of the real app UI.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 sm:py-20 border-t border-border/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Everything you need for inbound email.
              </h2>
              <p className="mt-3 text-muted-foreground">
                From disposable inboxes to production pipelines — TEmail keeps it simple.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-border/60 bg-card/60 backdrop-blur"
                >
                  <CardHeader className="space-y-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how"
          className="py-16 sm:py-20 border-t border-border/60 bg-muted/20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                How it works
              </h2>
              <p className="mt-3 text-muted-foreground">
                Get value quickly, then scale up as your inbound traffic grows.
              </p>
            </div>

            <ol className="mt-10 grid gap-6 lg:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Connect inbound",
                  description: "Add a domain and choose Webhook or IMAP as the source.",
                },
                {
                  step: "02",
                  title: "Create inboxes",
                  description: "Spin up mailboxes for signups, integrations, or catch-alls.",
                },
                {
                  step: "03",
                  title: "Route & automate",
                  description: "Forward messages and trigger workflows to process everything.",
                },
              ].map((item) => (
                <li key={item.step}>
                  <Card className="border-border/60 bg-card/60 backdrop-blur">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-mono text-muted-foreground">
                          {item.step}
                        </div>
                        <div className="h-px flex-1 bg-border/60 mx-3" />
                        <div className="text-xs text-muted-foreground">Step</div>
                      </div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" className="py-16 sm:py-20 border-t border-border/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">FAQ</h2>
                <p className="mt-3 text-muted-foreground">
                  Quick answers to common questions about deployment and privacy.
                </p>
              </div>
              <div className="lg:col-span-7 space-y-3">
                {faqs.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-xl border border-border/60 bg-card/60 p-5"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                      <span>{item.q}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20 border-t border-border/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Card className="border-border/60 bg-gradient-to-br from-primary/10 via-card to-card py-0">
              <div className="p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Ready to own your inbound email?
                  </h2>
                  <p className="mt-3 text-muted-foreground max-w-2xl">
                    Deploy TEmail and start routing messages in minutes — without giving up
                    privacy or control.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" asChild>
                    <Link href={primaryCta.href}>
                      {primaryCta.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href={isAuthed ? "/settings" : "/login"}>
                      {isAuthed ? "Account settings" : "Sign in"}
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <footer className="border-t border-border/60 py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} TEmail. Self-hosted inbound email platform.
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
                How it works
              </a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
              <Link href="/tos" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              {canRegister && (
                <Link href="/register" className="text-muted-foreground hover:text-foreground transition-colors">
                  Get started
                </Link>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
