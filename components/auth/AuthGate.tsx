"use client";

import React from "react";
import { LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { useTournamentStore } from "@/store/tournamentStore";
import {
  ROLE_LABELS,
  accountRequiresApproval,
  canAccessRoute,
  getDefaultRouteForRole,
  getUniqueAccounts,
  type RoleSession,
} from "@/lib/roleAccess";
import { NATIONAL_COUNTRY } from "@/lib/nationalCompetition";
import { useSocket } from "@/components/providers/SocketProvider";
import type { RoleAccount, UserRole } from "@/types/tournament";

const AUTH_STORAGE_KEY = "ikf_role_session";
const LEGACY_AUTH_STORAGE_KEY = "ikf_admin_session";
const SELF_SERVICE_ROLES: UserRole[] = ["athlete", "club", "corner-referee"];

export function getStoredRoleSession(): RoleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw) as Omit<RoleSession, "role"> & { role?: UserRole | "central-referee" };
      if (session.authenticated && session.username && session.role === "central-referee") {
        const migrated: RoleSession = {
          authenticated: true,
          accountId: session.accountId,
          username: session.username,
          role: "admin",
          displayName: "Table Chief",
          signedInAt: session.signedInAt ?? new Date().toISOString(),
        };
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      if (session.authenticated && session.username && session.role) return session as RoleSession;
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
  const { isHydrated } = useSocket();
  const accounts = useTournamentStore(state => state.accounts);
  const addAccount = useTournamentStore(state => state.addAccount);
  const addReferee = useTournamentStore(state => state.addReferee);
  const [isReady, setIsReady] = React.useState(false);
  const [hydrationTimedOut, setHydrationTimedOut] = React.useState(false);
  const [session, setSession] = React.useState<RoleSession | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginRole, setLoginRole] = React.useState<UserRole>("admin");
  const [showCreateAccount, setShowCreateAccount] = React.useState(false);
  const [createRole, setCreateRole] = React.useState<UserRole>("athlete");
  const [createName, setCreateName] = React.useState("");
  const [createUsername, setCreateUsername] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
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
    if (isHydrated) {
      setHydrationTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      console.warn("[AuthGate] Sync hydration timed out. Rendering auth screen with current local state.");
      setHydrationTimedOut(true);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [isHydrated]);

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
        item.password === normalizedPassword &&
        item.role === loginRole
      );

      if (!account) {
        setIsSubmitting(false);
        toast.error("Access denied. Check login, password, and role.");
        return;
      }

      if (accountRequiresApproval(account.role) && account.approvalStatus !== "Approved") {
        setIsSubmitting(false);
        toast.error("This referee account is waiting for table chief approval.");
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

  const handleCreateAccount = () => {
    const displayName = createName.trim();
    const nextUsername = createUsername.trim();
    const nextPassword = createPassword.trim();
    if (displayName.length < 2 || nextUsername.length < 3 || nextPassword.length < 3) {
      toast.error("Name, login, and password are required.");
      return;
    }
    if (loginAccounts.some(account => account.username.trim().toLowerCase() === nextUsername.toLowerCase())) {
      toast.error("This login is already used. Choose another one.");
      return;
    }

    const accountId = `account-${uuidv4()}`;
    const now = new Date().toISOString();
    const approvalStatus: RoleAccount["approvalStatus"] = accountRequiresApproval(createRole) ? "Pending" : "Approved";
    const account: RoleAccount = {
      id: accountId,
      username: nextUsername,
      password: nextPassword,
      role: createRole,
      displayName,
      approvalStatus,
      createdAt: now,
      ...(approvalStatus === "Approved" ? { approvedAt: now } : {}),
    };
    addAccount(account);

    if (createRole === "corner-referee") {
      addReferee({
        id: uuidv4(),
        name: displayName,
        role: "Corner Judge",
        country: NATIONAL_COUNTRY,
        grade: "Submitted Official",
        status: "Available",
        approvalStatus: "Pending",
        accountId,
      });
      toast.success("Referee account submitted. The table chief must approve it before login works.");
    } else {
      toast.success("Account created. Log in with your role, then complete your profile.");
    }

    setUsername(nextUsername);
    setPassword(nextPassword);
    setLoginRole(createRole);
    setShowCreateAccount(false);
    setCreateName("");
    setCreateUsername("");
    setCreatePassword("");
    setCreateRole("athlete");
  };

  if (!isReady || (!isHydrated && !hydrationTimedOut)) {
    return (
      <div className="min-h-[100dvh] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[var(--ikf-red)] animate-spin" />
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <main className="login-cinematic relative h-screen min-h-[100dvh] overflow-hidden bg-black text-white">
      <div className="fixed inset-0 bg-[url('/loginbackground.jpg')] bg-cover bg-center sm:bg-[center_58%]" />
      <div className="fixed inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.2)_46%,rgba(0,0,0,0.54)_100%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,26,36,0.08),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.44),transparent_34%,transparent_66%,rgba(0,0,0,0.42))]" />

      <section className="relative z-10 h-screen min-h-[100dvh] w-full max-w-full overflow-hidden px-4 py-5 sm:px-8 sm:py-8">
        <div className="login-phrase-left pointer-events-none fixed left-4 top-[18dvh] max-w-[12rem] sm:left-8 sm:top-[20dvh] sm:max-w-[19rem] lg:left-[6vw] lg:top-[22dvh] lg:max-w-[24rem]">
          <p className="font-display text-[clamp(2.1rem,7vw,5.7rem)] leading-[0.88] text-white drop-shadow-[0_10px_36px_rgba(0,0,0,0.9)]">
            TWO ENTER,<br />ONE LEAVES.
          </p>
        </div>

        <div className="login-phrase-right pointer-events-none fixed right-4 top-[30dvh] max-w-[11rem] text-right sm:right-8 sm:top-[26dvh] sm:max-w-[18rem] lg:right-[6vw] lg:top-[31dvh] lg:max-w-[24rem]">
          <p className="font-display text-[clamp(2rem,6.4vw,5.4rem)] leading-[0.88] text-white drop-shadow-[0_10px_36px_rgba(0,0,0,0.9)]">
            EARN YOUR<br />VICTORY
          </p>
        </div>

        <p className="login-kanji pointer-events-none fixed bottom-[7dvh] left-5 font-serif text-[clamp(2.4rem,7vw,6rem)] leading-none text-white/88 drop-shadow-[0_14px_38px_rgba(0,0,0,0.85)] sm:left-10 lg:left-[7vw]">
          剣志道
        </p>

        <div className="login-panel-shell fixed left-1/2 top-[clamp(1rem,5dvh,3.8rem)] w-[calc(100vw-32px)] max-w-[350px] -translate-x-1/2 sm:max-w-[390px]">
          <form
            onSubmit={handleLogin}
            className="login-panel w-full overflow-hidden rounded-[28px] border border-white/20 bg-white/[0.13] text-white shadow-[0_28px_90px_rgba(0,0,0,0.56)] backdrop-blur-xl"
          >
            <div className="border-b border-white/10 bg-white/[0.16] px-6 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-white/86 sm:text-base">Tournament Login</p>
            </div>

            <div className="space-y-4 px-6 py-6 sm:px-8 sm:py-7">
              <label className="group flex items-center gap-3 border-b border-white/42 pb-2 transition-colors focus-within:border-white">
                <Mail size={16} className="shrink-0 text-white/78" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/72"
                  placeholder="Login"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="group flex items-center gap-3 border-b border-white/42 pb-2 transition-colors focus-within:border-white">
                <LockKeyhole size={16} className="shrink-0 text-white/78" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/72"
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <label className="group flex items-center gap-3 border-b border-white/42 pb-2 transition-colors focus-within:border-white">
                <UserRound size={16} className="shrink-0 text-white/78" />
                <select
                  value={loginRole}
                  onChange={(event) => setLoginRole(event.target.value as UserRole)}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
                  required
                >
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role} className="bg-[#26262d] text-white">{label}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-between gap-4 pt-1 text-[0.68rem] text-white/60">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-3 w-3 accent-white/70" />
                  Remember me
                </label>
                <span className="italic">Secure access</span>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateAccount(value => !value)}
                className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-white/74 transition hover:text-white"
              >
                {showCreateAccount ? "Hide sign up" : "Sign up"}
              </button>

              {showCreateAccount && (
                <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    className="h-10 w-full border-b border-white/30 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:border-white"
                    placeholder="Full name / club name"
                  />
                  <select
                    value={createRole}
                    onChange={(event) => setCreateRole(event.target.value as UserRole)}
                    className="h-10 w-full border-b border-white/30 bg-transparent text-sm font-semibold text-white outline-none focus:border-white"
                  >
                    {SELF_SERVICE_ROLES.map(role => (
                      <option key={role} value={role} className="bg-[#26262d] text-white">{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  <input
                    value={createUsername}
                    onChange={(event) => setCreateUsername(event.target.value)}
                    className="h-10 w-full border-b border-white/30 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:border-white"
                    placeholder="Login"
                  />
                  <input
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    type="password"
                    className="h-10 w-full border-b border-white/30 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:border-white"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    className="h-10 w-full rounded-md bg-white/22 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-white/32"
                  >
                    Sign up
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mx-auto mt-2 flex h-12 w-[72%] min-w-44 items-center justify-center gap-2 rounded-md bg-white/24 px-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_35px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-white/34 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Checking..." : "Login"}<ShieldCheck size={16} />
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
