import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRegistrationMode } from "@/lib/registration";
import { getTurnstileClientConfig } from "@/lib/turnstile";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  const [mode, turnstile, flags] = await Promise.all([
    getRegistrationMode(),
    getTurnstileClientConfig(),
    getAuthFeatureFlags(),
  ]);
  return <LoginForm showRegisterLink={mode !== "closed"} turnstile={turnstile} passkeyEnabled={flags.passkeyEnabled} />;
}
