import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTurnstileClientConfig } from "@/lib/turnstile";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  const [turnstile, flags] = await Promise.all([
    getTurnstileClientConfig(),
    getAuthFeatureFlags(),
  ]);

  return <ForgotPasswordForm turnstile={turnstile} enabled={flags.passwordResetEnabled} />;
}

