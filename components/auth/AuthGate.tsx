"use client";

import React from "react";
import { motion } from "framer-motion";
import { LockKeyhole, ShieldCheck, Trophy, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTournamentStore } from "@/store/tournamentStore";
import {
  ROLE_LABELS,
  accountRequiresApproval,
  canAccessRoute,
  getDefaultRouteForRole,
  getUniqueAccounts,
  type RoleSession,
} from "@/lib/roleAccess";

const AUTH_STORAGE_KEY = "ikf_role_session";
const LEGACY_AUTH_STORAGE_KEY = "ikf_admin_session";

export function getStoredRoleSession(): RoleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw) as RoleSession;
      if (session.authenticated && session.username && session.role) return session;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as { username?: string; authenticated?: boolean; signedInAt?: string };
      if (legacy.authenticated && legacy.username) {
        const migrated: RoleSession = {
          authenticated: true,
          accountId: "legacy-admin-session",
          username: legacy.username,
          role: "admin",
          displayName: legacy.username,
          signedInAt: legacy.signedInAt ?? new Date().toISOString(),
        };
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
        return migrated;
      }
    }
    return null;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    return null;
  }
}

export function getStoredAdminSession() {
  return getStoredRoleSession();
}

export function clearRoleSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("ikf-auth-change"));
  window.dispatchEvent(new Event("ikf-admin-auth-change"));
}

export function clearAdminSession() {
  clearRoleSession();
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accounts = useTournamentStore(state => state.accounts);
  const [isReady, setIsReady] = React.useState(false);
  const [session, setSession] = React.useState<RoleSession | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loginAccounts = React.useMemo(() => getUniqueAccounts(accounts), [accounts]);

  React.useEffect(() => {
    setSession(getStoredRoleSession());
    setIsReady(true);
    const syncSession = () => setSession(getStoredRoleSession());
    window.addEventListener("storage", syncSession);
    window.addEventListener("ikf-auth-change", syncSession);
    window.addEventListener("ikf-admin-auth-change", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("ikf-auth-change", syncSession);
      window.removeEventListener("ikf-admin-auth-change", syncSession);
    };
  }, []);

  React.useEffect(() => {
    if (!session || !pathname) return;
    if (!canAccessRoute(session.role, pathname)) {
      router.replace(getDefaultRouteForRole(session.role));
    }
  }, [pathname, router, session]);

  React.useEffect(() => {
    if (!session) return;
    const liveAccount = loginAccounts.find(account => account.id === session.accountId);
    if (!liveAccount) return;
    if (
      liveAccount.refereeId === session.refereeId &&
      liveAccount.athleteId === session.athleteId &&
      liveAccount.clubId === session.clubId &&
      liveAccount.displayName === session.displayName
    ) return;

    const refreshed: RoleSession = {
      ...session,
      displayName: liveAccount.displayName,
      refereeId: liveAccount.refereeId,
      athleteId: liveAccount.athleteId,
      clubId: liveAccount.clubId,
    };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshed));
    setSession(refreshed);
  }, [loginAccounts, session]);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    window.setTimeout(() => {
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();
      const account = loginAccounts.find(item =>
        item.username.trim().toLowerCase() === normalizedUsername.toLowerCase() &&
        item.password === normalizedPassword
      );

      if (!account) {
        setIsSubmitting(false);
        toast.error("Access denied. Invalid credentials.");
        return;
      }

      if (accountRequiresApproval(account.role) && account.approvalStatus !== "Approved") {
        setIsSubmitting(false);
        toast.error("This referee account is waiting for chief admin approval.");
        return;
      }

      const nextSession: RoleSession = {
        authenticated: true,
        accountId: account.id,
        username: account.username,
        role: account.role,
        displayName: account.displayName,
        refereeId: account.refereeId,
        athleteId: account.athleteId,
        clubId: account.clubId,
        signedInAt: new Date().toISOString(),
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      window.dispatchEvent(new Event("ikf-auth-change"));
      setSession(nextSession);
      setIsSubmitting(false);
      toast.success(`Welcome, ${account.displayName}`);
      router.replace(getDefaultRouteForRole(account.role));
    }, 350);
  };

  if (!isReady) {
    return (
      <div className="min-h-[100dvh] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[var(--ikf-red)] animate-spin" />
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <main className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,16,46,0.22),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(212,160,23,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.035)_0,transparent_35%)]" />
      <section className="relative z-10 grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.08)] shadow-[0_0_40px_rgba(212,160,23,0.12)]">
              <Trophy className="text-[var(--ikf-gold)]" size={26} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.45em] text-[var(--ikf-gold)]">IKF Kenshido</p>
              <p className="text-sm text-[var(--text-secondary)]">One tournament site for every approved role</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
              <Sparkles size={14} className="text-[var(--ikf-red)]" /> Secure role access
            </div>
            <h1 className="font-display text-7xl xl:text-8xl leading-[0.88] tracking-wide">
              CONTROL THE <span className="text-[var(--ikf-red)] drop-shadow-[0_0_30px_rgba(200,16,46,0.35)]">ARENA</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
              Sign in as chief admin, referee, athlete, club, or TV display. Each account opens only the section it owns.
            </p>
          </motion.div>

          <div className="grid max-w-2xl grid-cols-2 gap-4">
            {["Live Sync", "Role Locked"].map((item) => (
              <div key={item} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-white/[0.03] p-4 backdrop-blur-xl">
                <p className="font-display text-2xl text-white">{item}</p>
                <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-[var(--ikf-red)] to-[var(--ikf-gold)]" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center p-4 sm:p-10">
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            onSubmit={handleLogin}
            className="w-full max-w-[470px] overflow-hidden rounded-3xl sm:rounded-[2rem] border border-[rgba(255,255,255,0.1)] bg-[rgba(17,19,24,0.82)] shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
          >
            <div className="relative p-6 sm:p-10">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--ikf-red)] via-[var(--ikf-gold)] to-[var(--corner-blue)]" />
              <div className="mb-7 sm:mb-9 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.1)] shadow-[0_0_60px_rgba(200,16,46,0.22)]">
                  <LockKeyhole className="text-[var(--ikf-red)]" size={30} />
                </div>
                <h2 className="mt-3 font-display text-4xl sm:text-5xl tracking-wide text-white">Welcome Back</h2>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">Use your approved tournament account.</p>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Login</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25 px-5 text-base font-semibold text-white outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--ikf-red)] focus:shadow-[0_0_0_4px_rgba(200,16,46,0.12)]"
                    placeholder="Username"
                    autoComplete="username"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Password</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25 px-5 text-base font-semibold text-white outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--ikf-red)] focus:shadow-[0_0_0_4px_rgba(200,16,46,0.12)]"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {Object.values(ROLE_LABELS).map(label => (
                  <span key={label} className="rounded-full border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {label}
                  </span>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--ikf-red)] to-[#e0344f] px-4 text-sm sm:text-base font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] text-white shadow-[0_20px_45px_rgba(200,16,46,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(200,16,46,0.38)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Checking..." : "Enter Platform"}<ShieldCheck size={19} />
              </button>
            </div>
          </motion.form>
        </div>
      </section>
    </main>
  );
}
