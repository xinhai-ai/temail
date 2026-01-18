import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Shield, Zap, Globe } from "lucide-react";
import { getRegistrationMode } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const canRegister = (await getRegistrationMode()) !== "closed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Mail className="h-8 w-8 text-purple-500" />
          <span className="text-2xl font-bold text-white">TEmail</span>
        </div>
        <div className="space-x-4">
          <Button variant="ghost" className="text-white" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          {canRegister && (
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          )}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-6">
            Temporary Email Made Simple
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Create disposable email addresses instantly. Protect your privacy,
            avoid spam, and manage multiple inboxes with ease.
          </p>
          {canRegister && (
            <Button size="lg" asChild>
              <Link href="/register">Start Free</Link>
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white/10 rounded-lg p-6 text-center">
            <Shield className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Privacy First</h3>
            <p className="text-slate-300">
              Keep your real email private. Use temporary addresses for signups.
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-6 text-center">
            <Zap className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Instant Setup</h3>
            <p className="text-slate-300">
              Create new email addresses in seconds. No configuration needed.
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-6 text-center">
            <Globe className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Multi-Domain</h3>
            <p className="text-slate-300">
              Use multiple domains. Organize with groups and tags.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
