/* eslint-disable */
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, MapPin, Calendar, AlertTriangle, Activity, Clock } from "lucide-react";
import { IKFCard, IKFBadge, StatCard, SectionDivider } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import { formatMatchCategory } from "@/lib/ageCategories";
import { NATIONAL_CHAMPIONSHIPS } from "@/lib/nationalCompetition";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

function LiveTimer({ initialSeconds = 180 }: { initialSeconds?: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    const iv = setInterval(() => setSeconds(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className="font-mono text-xl text-[var(--status-live)] animate-pulse-live drop-shadow-[0_0_8px_rgba(255,68,68,0.5)] tracking-widest font-bold">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { athletes, clubs, matches, settings, updateSettings, activeMatch, roundTimer } = useTournamentStore();
  const approvedAthletes = athletes.filter(a => a.registrationStatus === "Active" && (a.approvalStatus ?? "Approved") === "Approved");
  const approvedClubs = clubs.filter(c => c.status === "Active" && (c.approvalStatus ?? "Approved") === "Approved");

  const liveMatches = matches.filter(m => m.status === "in-progress");
  const scheduledMatches = matches.filter(m => m.status === "scheduled").sort(
    (a, b) => new Date(a.scheduledTime || 0).getTime() - new Date(b.scheduledTime || 0).getTime()
  );
  const completedMatches = matches.filter(m => m.status === "completed").sort(
    (a, b) => new Date(b.result?.validatedAt ?? 0).getTime() - new Date(a.result?.validatedAt ?? 0).getTime()
  );
  const kos = completedMatches.filter(m => m.result?.method === "KO" || m.result?.method === "TKO").length;
  const disqs = completedMatches.filter(m => m.result?.method === "disqualification").length;

  // Show up to 3 live matches (use scheduled if none live)
  const displayMatches = liveMatches.length > 0 ? liveMatches.slice(0, 3) : scheduledMatches.slice(0, 3);
  const championshipName = settings.championshipName ?? "Tunisia Championship";
  const titleParts = championshipName.trim().split(/\s+/);
  const titleMain = titleParts.length > 1 ? titleParts.slice(0, -1).join(" ") : championshipName;
  const titleAccent = titleParts.length > 1 ? titleParts.at(-1) : "";

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show"
      className="p-8 max-w-[1600px] mx-auto space-y-10">

      {/* ── HERO ── */}
      <motion.div variants={itemVariants}>
        <IKFCard className="relative overflow-hidden border-[var(--border-default)] !p-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(200,16,46,0.2)] via-transparent to-transparent pointer-events-none" />
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 p-10 relative z-10">
            <div className="flex-1">
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-[var(--text-primary)] leading-[0.9] tracking-wide mb-4">
                {titleMain} {titleAccent && <><br /><span className="text-[var(--ikf-red)]">{titleAccent}</span></>}
              </h1>
              <div className="flex items-center gap-6 text-[var(--text-secondary)] font-body text-sm font-medium">
                <span className="flex items-center gap-2"><MapPin size={18} className="text-[var(--ikf-red)]" />{settings.venue}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                <span className="flex items-center gap-2"><Calendar size={18} className="text-[var(--ikf-red)]" />{format(new Date(), "dd MMM yyyy")}</span>
              </div>
              <div className="mt-5 max-w-sm">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">National Competition</label>
                <select
                  value={championshipName}
                  onChange={(event) => updateSettings({ championshipName: event.target.value as typeof settings.championshipName })}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[var(--ikf-gold)]"
                >
                  {NATIONAL_CHAMPIONSHIPS.map(championship => (
                    <option key={championship} value={championship}>{championship}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto flex-shrink-0">
              <button onClick={() => router.push('/athletes')}><StatCard label={t('athletes', settings.language)} value={approvedAthletes.length.toString()} accentColor="none" className="bg-[var(--bg-elevated)] border-none shadow-none hover:border-[var(--ikf-red)]" /></button>
              <button onClick={() => router.push('/clubs')}><StatCard label={t('clubs', settings.language)} value={approvedClubs.length.toString()} accentColor="none" className="bg-[var(--bg-elevated)] border-none shadow-none hover:border-[var(--ikf-red)]" /></button>
              <button onClick={() => router.push('/brackets')}><StatCard label={t('matches', settings.language)} value={matches.length.toString()} accentColor="none" className="bg-[var(--bg-elevated)] border-none shadow-none hover:border-[var(--ikf-red)]" /></button>
              <button onClick={() => router.push(liveMatches.length > 0 ? '/tv' : '/rounds')}><StatCard label={t('live_mats', settings.language)} value={liveMatches.length.toString()} accentColor="red" badge={liveMatches.length > 0 ? <IKFBadge variant="live" label={t('live', settings.language)} size="sm" /> : undefined} className="bg-[var(--bg-elevated)] border-[var(--border-active)] shadow-none" /></button>
            </div>
          </div>
        </IKFCard>
      </motion.div>

      {/* ── LIVE / UPCOMING MATCHES ── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-4 mb-6 pl-2">
          <h2 className="font-display text-3xl tracking-widest text-[var(--text-primary)] leading-none">
            {liveMatches.length > 0 ? t('live_matches', settings.language) : t('upcoming_matches', settings.language)}
          </h2>
          {liveMatches.length > 0 && <IKFBadge variant="live" label={t('live', settings.language)} />}
        </div>

        {displayMatches.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border-default)] rounded-2xl">
            <p className="text-lg font-medium tracking-widest uppercase">{t('no_matches_scheduled_yet', settings.language)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {displayMatches.map(match => (
              <IKFCard key={match.id} glowColor="red" interactive onClick={() => router.push(match.status === "in-progress" ? "/tv" : "/rounds")} className="relative pb-0 pt-0 px-0 overflow-hidden flex flex-col justify-between h-[280px]">
                <div className="px-8 pt-6 pb-4 flex-1 flex flex-col">
                  <div className="text-center mb-4">
                    <span className="inline-block px-4 py-1.5 bg-[rgba(212,160,23,0.1)] border border-[rgba(212,160,23,0.3)] rounded-full text-[11px] font-bold tracking-widest text-[var(--ikf-gold)]">
                      {t('mat', settings.language)} 0{match.matNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-auto">
                    <div className="text-left w-[42%]">
                      <p className="font-display text-3xl text-[var(--corner-red)] truncate">{match.redCornerName.split(" ").pop()?.toUpperCase()}</p>
                    </div>
                    <div className="text-center w-[16%]">
                      <span className="text-xs font-bold text-[var(--text-muted)] tracking-widest">{t('vs', settings.language)}</span>
                    </div>
                    <div className="text-right w-[42%]">
                      <p className="font-display text-3xl text-[var(--corner-blue)] truncate">{match.blueCornerName.split(" ").pop()?.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center space-y-3 mt-4 mb-6">
                    <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--text-secondary)]">
                      {match.round} · {formatMatchCategory(match.ageGroup, match.weightCategory, match.gender)}
                    </span>
                    {match.status === "in-progress" ? (
                      <LiveTimer initialSeconds={activeMatch?.id === match.id ? roundTimer : match.roundDurationSeconds} />
                    ) : (
                      <span className="font-mono text-lg text-[var(--text-muted)] tracking-widest">
                        {format(new Date(match.scheduledTime || 0), "HH:mm")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full flex relative z-10">
                  <div className="h-full w-1/2 bg-[var(--corner-red)] shadow-[0_0_15px_rgba(200,16,46,1)]" />
                  <div className="h-full w-1/2 bg-[var(--corner-blue)] shadow-[0_0_15px_rgba(0,87,184,1)]" />
                </div>
              </IKFCard>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── LOWER SECTION ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <IKFCard padding="lg" className="flex flex-col min-h-[400px]">
          <SectionDivider label={t('today_schedule', settings.language)} accent="blue" className="mt-0 mb-6" icon={<Calendar size={14} />} />
          <div className="flex-1 space-y-1">
            {scheduledMatches.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-sm">{t('no_scheduled_matches', settings.language)}</div>
            ) : scheduledMatches.slice(0, 8).map((m, i) => (
              <div key={m.id} onClick={() => router.push('/rounds')} className={`flex items-center gap-4 p-3.5 rounded-lg transition-colors border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)] group cursor-pointer ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}>
                <div className="text-sm font-mono text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors w-14">
                  {format(new Date(m.scheduledTime || 0), "HH:mm")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-[var(--corner-red)] text-sm truncate">{m.redCornerName}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold px-1">{t('vs', settings.language)}</span>
                    <span className="font-semibold text-[var(--corner-blue)] text-sm truncate">{m.blueCornerName}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">{formatMatchCategory(m.ageGroup, m.weightCategory, m.gender)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest bg-[var(--bg-primary)] px-2.5 py-1 rounded border border-[var(--border-default)]">{t('mat', settings.language)} {m.matNumber}</span>
                  <IKFBadge variant="pending" label={t('scheduled', settings.language)} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </IKFCard>

        <IKFCard padding="lg" className="flex flex-col min-h-[400px]">
          <SectionDivider label={t('recent_results', settings.language)} accent="gold" className="mt-0 mb-6" icon={<Trophy size={14} />} />
          <div className="flex-1 space-y-1">
            {completedMatches.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-sm">{t('no_results_yet', settings.language)}</div>
            ) : completedMatches.slice(0, 8).map((m, i) => (
              <div key={m.id} onClick={() => router.push('/reports')} className={`flex items-center gap-4 p-3.5 rounded-lg transition-colors border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)] group cursor-pointer ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}>
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  <Trophy size={16} className="text-[var(--ikf-gold)] flex-shrink-0" />
                  <span className="font-bold text-[var(--text-primary)] text-sm truncate">{m.result?.winnerName ?? "—"}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold px-1">{t('def', settings.language)}</span>
                  <span className="text-sm text-[var(--text-muted)] truncate">
                    {m.result?.winnerCorner === "RED" ? m.blueCornerName : m.redCornerName}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs font-mono text-[var(--text-secondary)] font-medium">
                    {m.result?.redTotalScore} – {m.result?.blueTotalScore}
                  </span>
                  <IKFBadge variant="win" label={m.result?.method ? m.result.method.replace(/-/g, " ").toUpperCase() : t('win', settings.language)} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </IKFCard>
      </motion.div>

      {/* ── QUICK STATS ── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
          <button onClick={() => router.push('/brackets')}><StatCard label={t('total_matches', settings.language)} value={matches.length.toString()} accentColor="blue" className="!p-5" /></button>
          <button onClick={() => router.push('/reports')}><StatCard label={t('completed', settings.language)} value={completedMatches.length.toString()} accentColor="green" className="!p-5" /></button>
          <button onClick={() => router.push('/statistics')}><StatCard label={t('ko_tko', settings.language)} value={kos.toString()} accentColor="red" className="!p-5" /></button>
          <button onClick={() => router.push('/statistics')}><StatCard label={t('disqualifications', settings.language)} value={disqs.toString()} accentColor="red" className="!p-5" /></button>
          <button onClick={() => router.push('/weighin')}><StatCard label={t('pending_weigh_in', settings.language)} value={approvedAthletes.filter(a => a.weighInStatus === "Pending").length.toString()}
            accentColor="gold" icon={<AlertTriangle size={16} />} className="!p-5 border-[rgba(212,160,23,0.3)] shadow-[0_0_20px_rgba(212,160,23,0.15)] bg-[rgba(212,160,23,0.03)]" /></button>
        </div>
      </motion.div>
    </motion.div>
  );
}

