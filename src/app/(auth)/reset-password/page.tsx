import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  const flags = await getAuthFeatureFlags();

  const resolvedSearchParams = await (searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}));
  const getParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const token = (getParam("token") || "").trim();
  return <ResetPasswordForm token={token} enabled={flags.passwordResetEnabled} />;
}

