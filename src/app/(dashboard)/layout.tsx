import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("temail_sidebar_collapsed")?.value === "1";

  return (
    <SessionProvider>
      <AppShell isAdmin={isAdmin} initialSidebarCollapsed={initialSidebarCollapsed}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
