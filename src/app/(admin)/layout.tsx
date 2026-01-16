import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("temail_sidebar_collapsed")?.value === "1";

  return (
    <SessionProvider>
      <AppShell isAdmin={true} initialSidebarCollapsed={initialSidebarCollapsed}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
