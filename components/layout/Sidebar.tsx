"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Building2,
  Scale,
  GitBranch,
  Shield,
  Timer,
  Swords,
  Monitor,
  FileText,
  BarChart3,
  Brain,
  LogOut,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useNavigationStore } from "@/store/navigationStore";
import { useTournamentStore } from "@/store/tournamentStore";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { clearAdminSession, getStoredAdminSession } from "@/components/auth/AuthGate";

const NAV_SECTIONS = [
  {
    label: "MANAGEMENT",
    items: [
      { id: "Dashboard", route: "/dashboard", icon: LayoutDashboard },
      { id: "Athlete Registration", route: "/athletes", icon: Users },
      { id: "Club Registration", route: "/clubs", icon: Building2 },
    ],
  },
  {
    label: "COMPETITION",
    items: [
      { id: "Weigh-in", route: "/weighin", icon: Scale },
      { id: "Draw & Brackets", route: "/brackets", icon: GitBranch },
      { id: "Referee Management", route: "/referees", icon: Shield },
      { id: "Round Management", route: "/rounds", icon: Timer },
    ],
  },
  {
    label: "LIVE",
    items: [
      { id: "Electronic Judging", route: "/judging/judge", icon: Swords },
      { id: "TV Display", route: "/tv", icon: Monitor },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { id: "Instant Reports", route: "/reports", icon: FileText },
      { id: "Tournament Statistics", route: "/statistics", icon: BarChart3 },
      { id: "AI Analytics", route: "/ai", icon: Brain },
    ],
  },
];

export function Sidebar() {
  const { setActivePage } = useNavigationStore();
  const { settings } = useTournamentStore();
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = React.useState("Admin");
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  React.useEffect(() => {
    setAdminName(getStoredAdminSession()?.username ?? "Admin");
  }, []);

  const handleLogout = () => {
    clearAdminSession();
    setShowLogoutConfirm(false);
    router.push("/dashboard");
  };

  return (
    <aside className="w-[80px] lg:w-[260px] flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col z-50 transition-all duration-300">
      {/* ── Branding ── */}
      <div className="pt-8 pb-6 px-0 lg:px-6 flex flex-col items-center">
        <h1 className="font-display text-3xl lg:text-5xl text-[var(--ikf-red)] leading-none tracking-wide">
          IKF
        </h1>
        <p className="font-body text-[8px] lg:text-[10px] uppercase tracking-[0.2em] lg:tracking-[0.4em] text-[var(--ikf-gold)] font-bold mt-1 text-center hidden lg:block">
          Kenshido
        </p>
      </div>

      <div className="px-4 lg:px-6 mb-4">
        <div className="h-px w-full bg-[var(--border-default)] opacity-50" />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 lg:px-4 pb-6 space-y-6 custom-scrollbar">
        {NAV_SECTIONS.map((section, idx) => {
          const transSectionKey = section.label.toLowerCase() as keyof typeof import('@/lib/i18n').translations['en'];
          const transSectionLabel = t(transSectionKey, settings.language) || section.label;

          return (
            <div key={idx}>
              <div className="px-2 mb-2 text-center lg:text-left">
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--text-muted)] font-body hidden lg:block">
                  {transSectionLabel}
                </span>
                <div className="h-px w-6 mx-auto bg-[var(--text-muted)] opacity-20 block lg:hidden my-2" />
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.route || (item.route !== "/" && pathname?.startsWith(item.route));
                  const Icon = item.icon;
                  
                  const transKey = item.id.toLowerCase().replace(/ /g, '_').replace(/&_/, '').replace(/\(/g, '').replace(/\)/g, '').replace(/-/g, '_') as keyof typeof import('@/lib/i18n').translations['en'];
                  const transLabel = t(transKey, settings.language) || item.id;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setActivePage(item.id);
                          router.push(item.route);
                        }}
                        className={cn(
                          "relative w-full flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-3 py-3 lg:py-2.5 rounded-lg font-body text-sm font-medium transition-all duration-200 group overflow-hidden",
                          isActive
                            ? "text-white bg-[rgba(255,255,255,0.05)] lg:bg-transparent"
                            : "text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.02)]"
                        )}
                        title={transLabel}
                      >
                        {/* Active state background & border */}
                        {isActive && (
                          <>
                            <motion.div
                              layoutId="activeNavIndicator"
                              className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--ikf-red)] rounded-r-full"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                            <div className="absolute inset-0 bg-[var(--ikf-red-muted)] pointer-events-none hidden lg:block" />
                          </>
                        )}

                        <Icon
                          size={20}
                          className={cn(
                            "relative z-10 transition-colors flex-shrink-0",
                            isActive ? "text-[var(--ikf-red)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                          )}
                        />
                        <span className="relative z-10 hidden lg:block truncate">{transLabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── User Profile Bottom ── */}
      <div className="p-4 border-t border-[var(--border-default)] bg-[rgba(0,0,0,0.1)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
              <Shield size={16} className="text-[var(--text-secondary)]" />
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[var(--status-live)] rounded-full border-2 border-[var(--bg-secondary)]" />
          </div>
          <div className="flex-col hidden lg:flex min-w-0">
            <span className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">
              {adminName}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
              IKF Admin Platform
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-9 h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:border-[rgba(200,16,46,0.45)] hover:bg-[rgba(200,16,46,0.12)] transition-all flex-shrink-0"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--ikf-red)] rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(200,16,46,0.1)] border border-[var(--ikf-red)] flex items-center justify-center mx-auto mb-4">
              <LogOut size={26} className="text-[var(--ikf-red)]" />
            </div>
            <h2 className="font-display text-2xl text-white mb-2">Log Out</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 h-12 rounded-xl border-2 border-[var(--border-default)] text-white font-bold hover:bg-[rgba(255,255,255,0.05)] transition-all">Cancel</button>
              <button onClick={handleLogout} className="flex-1 h-12 rounded-xl bg-[var(--ikf-red)] text-white font-bold hover:bg-[#a00d25] transition-all">Log Out</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
