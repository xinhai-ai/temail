import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRegistrationMode } from "@/lib/registration";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  const mode = await getRegistrationMode();
  return <LoginForm showRegisterLink={mode !== "closed"} />;
}
