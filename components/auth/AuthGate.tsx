"use client";

import React from "react";
import { motion } from "framer-motion";
import { LockKeyhole, ShieldCheck, Trophy, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const ADMIN_USERS = Array.from({ length: 7 }, (_, index) => {
  const adminNumber = index + 1;
  return {
    username: `admin${adminNumber}`,
    password: `admin${adminNumber}password`,
  };
});

const AUTH_STORAGE_KEY = "ikf_admin_session";

function isValidAdmin(username: string, password: string) {
  return ADMIN_USERS.some((admin) => admin.username === username.trim() && admin.password === password);
}

export function getStoredAdminSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { username?: string; authenticated?: boolean };
    if (!session.authenticated || !session.username) return null;
    return session;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("ikf-admin-auth-change"));
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setIsAuthenticated(Boolean(getStoredAdminSession()));
    setIsReady(true);
    const syncSession = () => setIsAuthenticated(Boolean(getStoredAdminSession()));
    window.addEventListener("storage", syncSession);
    window.addEventListener("ikf-admin-auth-change", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("ikf-admin-auth-change", syncSession);
    };
  }, []);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    window.setTimeout(() => {
      if (!isValidAdmin(username, password)) {
        setIsSubmitting(false);
        toast.error("Access denied. Use one of the seven admin accounts.");
        return;
      }
      const normalizedUsername = username.trim();
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ authenticated: true, username: normalizedUsername, signedInAt: new Date().toISOString() }));
      setIsAuthenticated(true);
      setIsSubmitting(false);
      toast.success(`Welcome back, ${normalizedUsername}`);
    }, 450);
  };

  if (!isReady) {
    return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="h-12 w-12 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[var(--ikf-red)] animate-spin" /></div>;
  }

  if (isAuthenticated) return <>{children}</>;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,16,46,0.22),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(212,160,23,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.035)_0,transparent_35%)]" />
      <div className="absolute -left-32 top-16 h-96 w-96 rounded-full bg-[var(--ikf-red)]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[var(--corner-blue)]/10 blur-3xl" />
      <section className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.08)] shadow-[0_0_40px_rgba(212,160,23,0.12)]"><Trophy className="text-[var(--ikf-gold)]" size={26} /></div><div><p className="text-xs font-black uppercase tracking-[0.45em] text-[var(--ikf-gold)]">IKF Kenshido</p><p className="text-sm text-[var(--text-secondary)]">Official tournament command center</p></div></div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]"><Sparkles size={14} className="text-[var(--ikf-red)]" /> Elite access only</div>
            <h1 className="font-display text-7xl xl:text-8xl leading-[0.88] tracking-wide">CONTROL THE <span className="text-[var(--ikf-red)] drop-shadow-[0_0_30px_rgba(200,16,46,0.35)]">ARENA</span></h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">A cinematic admin entrance for managing athletes, brackets, judging, reports, live displays, and tournament operations.</p>
          </motion.div>
          <div className="grid max-w-2xl grid-cols-2 gap-4">{["Live Sync", "Secure Gate"].map((item) => <div key={item} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-white/[0.03] p-4 backdrop-blur-xl"><p className="font-display text-2xl text-white">{item}</p><div className="mt-3 h-1 rounded-full bg-gradient-to-r from-[var(--ikf-red)] to-[var(--ikf-gold)]" /></div>)}</div>
        </div>
        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.form initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.55 }} onSubmit={handleLogin} className="w-full max-w-[470px] overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.1)] bg-[rgba(17,19,24,0.82)] shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="relative p-8 sm:p-10">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--ikf-red)] via-[var(--ikf-gold)] to-[var(--corner-blue)]" />
              <div className="mb-9 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.1)] shadow-[0_0_60px_rgba(200,16,46,0.22)]"><LockKeyhole className="text-[var(--ikf-red)]" size={34} /></div><p className="text-xs font-black uppercase tracking-[0.38em] text-[var(--ikf-gold)]">Admin Login</p><h2 className="mt-3 font-display text-5xl tracking-wide text-white">Welcome Back</h2><p className="mt-3 text-sm text-[var(--text-secondary)]">Authorized administrators can access the platform.</p></div>
              <div className="space-y-5">
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Login</span><input value={username} onChange={(event) => setUsername(event.target.value)} className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25 px-5 text-base font-semibold text-white outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--ikf-red)] focus:shadow-[0_0_0_4px_rgba(200,16,46,0.12)]" placeholder="admin1" autoComplete="username" required /></label>
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Password</span><div className="relative"><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25 px-5 text-base font-semibold text-white outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--ikf-red)] focus:shadow-[0_0_0_4px_rgba(200,16,46,0.12)]" placeholder="Enter your password" autoComplete="current-password" required /></div></label>
              </div>
              <button type="submit" disabled={isSubmitting} className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--ikf-red)] to-[#e0344f] font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_45px_rgba(200,16,46,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(200,16,46,0.38)] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? "Checking..." : "Enter Command Center"}<ShieldCheck size={19} /></button>
            </div>
          </motion.form>
        </div>
      </section>
    </main>
  );
}
