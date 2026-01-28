import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/services/auth/email-verification";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, resolvedSearchParams] = await Promise.all([
    getTranslations("auth"),
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);

  const getParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const token = (getParam("token") || "").trim();
  const result = token ? await verifyEmailToken(token) : { ok: false as const, error: "missing_token" as const };

  const isOk = result.ok;
  const title = isOk ? t("verifyEmailPage.successTitle") : t("verifyEmailPage.errorTitle");
  const description = isOk
    ? t("verifyEmailPage.successDescription")
    : result.error === "missing_token"
    ? t("verifyEmailPage.missingToken")
    : result.error === "invalid_or_expired"
    ? t("verifyEmailPage.invalidOrExpired")
    : t("verifyEmailPage.failed");
  const icon = isOk ? <MailCheck className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-destructive" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button asChild className="w-full h-11 font-medium">
            <Link href="/login">{t("verifyEmailPage.goToLogin")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
