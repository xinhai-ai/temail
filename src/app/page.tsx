import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Check, FileText, Forward, Globe, Inbox, Mail, Menu, Shield, Zap } from "lucide-react";
import { getRegistrationMode } from "@/lib/registration";
import { isVercelDeployment } from "@/lib/deployment/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, mode, tHome, tAuth] = await Promise.all([
    auth(),
    getRegistrationMode(),
    getTranslations("home"),
    getTranslations("auth"),
  ]);
  const canRegister = mode !== "closed";
  const vercelMode = isVercelDeployment();
  const isAuthed = Boolean(session);

  const primaryCta = isAuthed
    ? { href: "/dashboard", label: tHome("cta.openDashboard") }
    : canRegister
      ? { href: "/register", label: tHome("cta.getStarted") }
      : { href: "/login", label: tAuth("login") };

  const secondaryCta = isAuthed
    ? { href: "/inbox", label: tHome("cta.goToInbox") }
    : { href: "#features", label: tHome("cta.exploreFeatures") };

  const secondaryCtaNode = secondaryCta.href.startsWith("#") ? (
    <a href={secondaryCta.href}>{secondaryCta.label}</a>
  ) : (
    <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
  );

  const statusBadge =
    mode === "invite"
      ? { label: tHome("status.inviteOnly"), className: "bg-muted/60 text-foreground border-border/60" }
      : mode === "closed"
        ? { label: tHome("status.signInOnly"), className: "bg-muted/60 text-foreground border-border/60" }
        : null;

  const features = [
    {
      key: "multiDomain",
      icon: Globe,
      title: tHome("features.multiDomain.title"),
      description: tHome("features.multiDomain.description"),
    },
    {
      key: "ingestion",
      icon: Inbox,
      title: tHome("features.ingestion.title"),
      description: tHome("features.ingestion.description"),
    },
    {
      key: "forwarding",
      icon: Forward,
      title: tHome("features.forwarding.title"),
      description: tHome("features.forwarding.description"),
    },
    {
      key: "automation",
      icon: Zap,
      title: tHome("features.automation.title"),
      description: tHome("features.automation.description"),
    },
    {
      key: "observability",
      icon: FileText,
      title: tHome("features.observability.title"),
      description: tHome("features.observability.description"),
    },
    {
      key: "privacyDefaults",
      icon: Shield,
      title: tHome("features.privacyDefaults.title"),
      description: tHome("features.privacyDefaults.description"),
    },
  ];

  const faqs = [
    {
      key: "selfHosted",
      q: tHome("faqSection.items.selfHosted.q"),
      a: tHome("faqSection.items.selfHosted.a"),
    },
    ...(!vercelMode
      ? [
          {
            key: "imap",
            q: tHome("faqSection.items.imap.q"),
            a: tHome("faqSection.items.imap.a"),
          },
        ]
      : []),
    {
      key: "registration",
      q: tHome("faqSection.items.registration.q"),
      a: tHome("faqSection.items.registration.a"),
    },
    {
      key: "tracking",
      q: tHome("faqSection.items.tracking.q"),
      a: tHome("faqSection.items.tracking.a"),
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
            {tHome("skipToContent")}
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
                {tHome("nav.features")}
              </a>
              <a href="#how" className="hover:text-foreground transition-colors">
                {tHome("nav.howItWorks")}
              </a>
              <a href="#faq" className="hover:text-foreground transition-colors">
                {tHome("nav.faq")}
              </a>
            </nav>

            <div className="flex items-center gap-2">
              {isAuthed ? (
                <Button variant="outline" asChild>
                  <Link href="/dashboard">{tHome("cta.openApp")}</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">{tAuth("login")}</Link>
                  </Button>
                  {canRegister && (
                    <Button asChild>
                      <Link href="/register">{tHome("cta.getStarted")}</Link>
                    </Button>
                  )}
                </>
              )}

              <details className="relative md:hidden">
                <summary className="list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{tHome("nav.openMenu")}</span>
                  </span>
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/60 bg-popover p-2 shadow-lg">
                  <a
                    href="#features"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    {tHome("nav.features")}
                  </a>
                  <a
                    href="#how"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    {tHome("nav.howItWorks")}
                  </a>
                  <a
                    href="#faq"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    {tHome("nav.faq")}
                  </a>
                  <div className="my-2 h-px bg-border/60" />
                  <Link
                    href="/login"
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    {tAuth("login")}
                  </Link>
                  {canRegister && (
                    <Link
                      href="/register"
                      className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      {tHome("cta.getStarted")}
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
                    {tHome("badges.selfHosted")}
                  </Badge>
                  <Badge variant="secondary" className="bg-muted/60 text-foreground">
                    {tHome("badges.stack")}
                  </Badge>
                  {statusBadge && (
                    <Badge variant="outline" className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                  )}
                </div>

                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                  {tHome("hero.title")}
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  {tHome("hero.description")}
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
                      <span className="font-medium text-foreground">{tHome("hero.bullets.privacy.label")}</span>{" "}
                      {tHome("hero.bullets.privacy.text")}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">{tHome("hero.bullets.operational.label")}</span>{" "}
                      {tHome("hero.bullets.operational.text")}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">{tHome("hero.bullets.flexible.label")}</span>{" "}
                      {tHome("hero.bullets.flexible.text")}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">{tHome("hero.bullets.fast.label")}</span>{" "}
                      {tHome("hero.bullets.fast.text")}
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
	                        <div className="text-sm font-semibold">{tHome("preview.inboxTitle")}</div>
	                        <div className="text-xs text-muted-foreground">
	                          demo@inbox.temail.local
	                        </div>
	                      </div>
	                    </div>
	                    <Badge variant="secondary" className="bg-muted/60 text-foreground">
	                      {tHome("preview.live")}
	                    </Badge>
	                  </div>

                  <div className="grid grid-cols-5 gap-0">
	                    <div className="col-span-2 border-r border-border/60 p-3 space-y-2">
	                      {[
	                        { key: "loginCode", subject: tHome("preview.subjects.loginCode"), time: "1m", active: true },
	                        { key: "invoiceReady", subject: tHome("preview.subjects.invoiceReady"), time: "7m" },
	                        { key: "welcome", subject: tHome("preview.subjects.welcome"), time: "2h" },
	                        { key: "webhookDelivery", subject: tHome("preview.subjects.webhookDelivery"), time: "1d" },
	                      ].map((item) => (
	                        <div
	                          key={item.key}
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
	                        <div className="text-xs text-muted-foreground">{tHome("preview.selectedEmail")}</div>
	                        <div className="text-lg font-semibold leading-snug">
	                          {tHome("preview.subjects.loginCode")}
	                        </div>
	                        <div className="text-sm text-muted-foreground">
	                          {tHome("preview.from")}{" "}
	                          <span className="font-medium text-foreground">Acme</span>{" "}
	                          • {tHome("preview.to")}{" "}
	                          <span className="font-mono text-foreground">
	                            demo@inbox.temail.local
	                          </span>
	                        </div>
	                      </div>
	                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
	                        <div className="text-sm font-medium">{tHome("preview.code")}</div>
	                        <div className="mt-2 flex items-center justify-between gap-3">
	                          <div className="font-mono text-2xl tracking-widest">384 921</div>
                          <Badge variant="outline" className="bg-background/60 border-border/60">
                            10 min
                          </Badge>
	                        </div>
	                        <div className="mt-3 text-xs text-muted-foreground">
	                          {tHome("preview.remoteImagesBlocked")}
	                        </div>
	                      </div>
	
	                      <div className="grid grid-cols-2 gap-3">
	                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
	                          <div className="text-xs text-muted-foreground">{tHome("preview.forward")}</div>
	                          <div className="mt-1 text-sm font-medium">{vercelMode ? "Webhook" : "SMTP"}</div>
	                        </div>
	                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
	                          <div className="text-xs text-muted-foreground">{tHome("preview.workflow")}</div>
	                          <div className="mt-1 text-sm font-medium">{tHome("preview.notify")}</div>
	                        </div>
	                      </div>
	                    </div>
	                  </div>
	                </div>
	
	                <p className="mt-3 text-xs text-muted-foreground">
	                  {tHome("preview.lightweight")}
	                </p>
	              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 sm:py-20 border-t border-border/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {tHome("featuresSection.title")}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {tHome("featuresSection.description")}
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.key}
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
                {tHome("howSection.title")}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {tHome("howSection.description")}
              </p>
            </div>

            <ol className="mt-10 grid gap-6 lg:grid-cols-3">
              {[
                {
                  step: "01",
                  title: tHome("howSection.steps.connect.title"),
                  description: tHome("howSection.steps.connect.description"),
                },
                {
                  step: "02",
                  title: tHome("howSection.steps.inboxes.title"),
                  description: tHome("howSection.steps.inboxes.description"),
                },
                {
                  step: "03",
                  title: tHome("howSection.steps.route.title"),
                  description: tHome("howSection.steps.route.description"),
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
                        <div className="text-xs text-muted-foreground">{tHome("preview.step")}</div>
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
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{tHome("faqSection.title")}</h2>
                <p className="mt-3 text-muted-foreground">
                  {tHome("faqSection.description")}
                </p>
              </div>
              <div className="lg:col-span-7 space-y-3">
                {faqs.map((item) => (
                  <details
                    key={item.key}
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
                    {tHome("bottomCta.title")}
                  </h2>
                  <p className="mt-3 text-muted-foreground max-w-2xl">
                    {tHome("bottomCta.description")}
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
                      {isAuthed ? tHome("cta.accountSettings") : tAuth("login")}
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
              {tHome("footer.copyright", { year: new Date().getFullYear() })}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                {tHome("nav.features")}
              </a>
              <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
                {tHome("nav.howItWorks")}
              </a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
                {tHome("nav.faq")}
              </a>
              <Link href="/tos" className="text-muted-foreground hover:text-foreground transition-colors">
                {tHome("footer.terms")}
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                {tHome("footer.privacy")}
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                {tAuth("login")}
              </Link>
              {canRegister && (
                <Link href="/register" className="text-muted-foreground hover:text-foreground transition-colors">
                  {tHome("cta.getStarted")}
                </Link>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
