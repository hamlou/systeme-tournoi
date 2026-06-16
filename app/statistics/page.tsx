/* eslint-disable */
"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, useInView } from "framer-motion";
import { BarChart3, Bot, FileText, GitBranch } from "lucide-react";
import { PageHeader, IKFButton, IKFCard, SectionDivider } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";
import { formatMatchCategory } from "@/lib/ageCategories";
import { StoredJudgingBundle, useFirebaseAllJudgingData } from "@/hooks/useFirebaseJudgingSync";

const RED = "#c8102e";
const GOLD = "#d4a017";
const BLUE = "#0066cc";
const GREEN = "#2ecc71";
const PURPLE = "#9b59b6";
const TEAL = "#1abc9c";
const MUTED = "rgba(255,255,255,0.08)";
const TEXT = "rgba(255,255,255,0.45)";

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#08090e]/95 border border-[rgba(212,160,23,0.24)] rounded-2xl px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] min-w-[150px] backdrop-blur-xl">
      {label && <div className="text-xs font-bold text-[rgba(255,255,255,0.4)] mb-1.5 uppercase tracking-wider">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill || RED }} />
            <span className="text-xs text-[rgba(255,255,255,0.65)]">{p.name || p.dataKey}</span>
          </span>
          <span className="text-sm font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Sparkline = ({ data, color = RED }: { data: number[]; color?: string }) => {
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const points = data.map((value, index) => {
    const x = data.length === 1 ? 100 : (index / (data.length - 1)) * 100;
    const y = 28 - ((value - min) / range) * 24;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="w-full h-8 overflow-visible" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay }}>
      {children}
    </motion.div>
  );
}

function HeroStat({ label, value, trend, color = RED, delta }: { label: string; value: number; trend: number[]; color?: string; delta?: string }) {
  return (
    <IKFCard padding="lg" className="flex flex-col justify-between">
      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">{label}</div>
      <div className="font-display text-5xl text-white mb-1">{value}</div>
      {delta && <div className="text-xs font-semibold" style={{ color }}>{delta}</div>}
      <div className="mt-3"><Sparkline data={trend} color={color} /></div>
    </IKFCard>
  );
}

function MedalDots({ gold, silver, bronze }: { gold: number; silver: number; bronze: number }) {
  return (
    <div className="flex items-center gap-3 text-sm font-bold">
      <span style={{ color: GOLD }}>G:{gold}</span>
      <span style={{ color: "#b0b0b0" }}>S:{silver}</span>
      <span style={{ color: "#b46432" }}>B:{bronze}</span>
    </div>
  );
}

export default function StatisticsPage() {
  const router = useRouter();
  const { matches, athletes, referees, settings, roundEvents } = useTournamentStore();
  const [judgingBundles, setJudgingBundles] = useState<StoredJudgingBundle[]>([]);

  useFirebaseAllJudgingData(setJudgingBundles);

  const completedMatches = matches.filter(m => m.status === "completed");

  const combinedRoundEvents = useMemo(() => {
    const merged = new Map<string, any>();
    roundEvents.forEach(event => merged.set(`${event.id}-${event.timestamp}-${event.type}-${event.details}`, event));
    judgingBundles.flatMap(bundle => bundle.events).forEach(event => {
      merged.set(`${event.id}-${event.timestamp}-${event.type}-${event.details}`, event);
    });
    return Array.from(merged.values());
  }, [judgingBundles, roundEvents]);

  const combinedJudgeScores = useMemo(() => {
    const merged = new Map<string, any>();
    judgingBundles.flatMap(bundle => bundle.scores).forEach(score => {
      merged.set(`${score.matchId}-${score.judgeId}-${score.round}`, score);
    });
    return Array.from(merged.values());
  }, [judgingBundles]);

  const RESULT_PIE = useMemo(() => {
    let decision = 0, ko = 0, ippon = 0, dq = 0, draw = 0;
    const methodEventTypes = new Set(["decision", "ko-tko", "ippon-result", "disqualification", "draw"]);
    const resultEvents = combinedRoundEvents.filter(event => methodEventTypes.has(event.type));
    resultEvents.forEach(event => {
      if (event.type === "decision") decision++;
      if (event.type === "ko-tko") ko++;
      if (event.type === "ippon-result") ippon++;
      if (event.type === "disqualification") dq++;
      if (event.type === "draw") draw++;
    });
    completedMatches.forEach(m => {
      const hasStoredMethodEvent = resultEvents.some(event => event.matchId === m.id || event.details?.toLowerCase().includes(`match #${m.matchNumber}`));
      if (hasStoredMethodEvent) return;
      const reason = m.result?.method?.toLowerCase() || "";
      if (reason.includes("decision") || reason.includes("override")) decision++;
      else if (reason.includes("ko") || reason.includes("tko")) ko++;
      else if (reason.includes("ippon")) ippon++;
      else if (reason.includes("dq") || reason.includes("disqualification")) dq++;
      else if (reason.includes("draw")) draw++;
      else decision++;
    });
    return [
      { name: t("decision", settings.language), value: decision, color: BLUE },
      { name: t("ko_tko", settings.language), value: ko, color: RED },
      { name: t("ippon_kids", settings.language), value: ippon, color: GOLD },
      { name: t("disqualification", settings.language), value: dq, color: PURPLE },
      { name: t("draw", settings.language), value: draw, color: TEAL },
    ];
  }, [combinedRoundEvents, completedMatches, settings.language]);

  const TOTAL_MATCHES = RESULT_PIE.reduce((a, b) => a + b.value, 0);

  const CATEGORY_BARS = useMemo(() => {
    const counts: Record<string, number> = {};
    matches.forEach(m => {
      const key = formatMatchCategory(m.ageGroup, m.weightCategory, m.gender);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([cat, count]) => ({ cat, matches: count })).sort((a, b) => b.matches - a.matches);
  }, [matches]);

  const COUNTRIES = useMemo(() => {
    const stats: Record<string, { gold: number; silver: number; bronze: number; wins: number; bouts: number }> = {};
    athletes.forEach(a => {
      if (!stats[a.country]) stats[a.country] = { gold: 0, silver: 0, bronze: 0, wins: 0, bouts: 0 };
    });
    completedMatches.forEach(m => {
      const red = athletes.find(a => a.id === m.redCornerId);
      const blue = athletes.find(a => a.id === m.blueCornerId);
      const winner = athletes.find(a => a.id === m.result?.winnerId);
      const loser = m.result?.winnerCorner === "RED" ? blue : red;
      if (red) stats[red.country].bouts++;
      if (blue) stats[blue.country].bouts++;
      if (winner) {
        stats[winner.country].wins++;
        stats[winner.country].gold++;
      }
      if (loser) stats[loser.country].silver++;
    });
    return Object.entries(stats)
      .map(([country, s]) => ({
        country,
        gold: s.gold,
        silver: s.silver,
        bronze: Math.max(0, s.bouts - s.wins - s.silver),
        wins: s.wins,
        rate: s.bouts > 0 ? Math.round((s.wins / s.bouts) * 100) : 0,
      }))
      .filter(c => c.wins > 0 || c.silver > 0 || c.bronze > 0)
      .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.wins - a.wins)
      .map((c, i) => ({ ...c, rank: i + 1 }))
      .slice(0, 8);
  }, [athletes, completedMatches]);

  const GOLD_BARS = COUNTRIES.slice(0, 6).map(c => ({ country: c.country.split(" ")[0], gold: c.gold }));

  const TIMELINE = useMemo(() => {
    const buckets = new Map<string, number>();
    completedMatches.forEach((match) => {
      const rawTime = match.result?.validatedAt ?? match.scheduledTime;
      if (!rawTime) return;
      const label = `${String(new Date(rawTime).getHours()).padStart(2, "0")}:00`;
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([time, matches]) => ({ time, matches }));
  }, [completedMatches]);

  const REFEREES_DATA = useMemo(() => referees.map(r => {
    const assignedMatches = matches.filter(m => m.assignedJudgeIds?.includes(r.id) || m.assignedRefereeId === r.id);
    const officialEvents = combinedRoundEvents.filter(e => e.officialId === r.id || e.officialName === r.name);
    const submittedScorecards = combinedJudgeScores.filter(score => score.judgeId === r.id && score.submitted).length;
    const methodCalls = officialEvents.filter(e => ["decision", "ko-tko", "ippon-result", "disqualification", "draw"].includes(e.type)).length;
    const lastActivity = [...officialEvents].sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())[0];
    return {
      id: r.id,
      name: r.name,
      role: r.role,
      matches: assignedMatches.length,
      submittedScorecards,
      yellow: officialEvents.filter(e => e.type === "yellow-card").length,
      red: officialEvents.filter(e => e.type === "red-card").length,
      methodCalls,
      lastActivity: lastActivity?.timestamp ? new Date(lastActivity.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No activity",
    };
  }).sort((a, b) => b.matches - a.matches || b.submittedScorecards - a.submittedScorecards || a.name.localeCompare(b.name)), [combinedJudgeScores, combinedRoundEvents, matches, referees]);

  const buildTrend = (current: number) => current === 0
    ? [0, 0, 0, 0, 0, 0, 0]
    : [0.1, 0.25, 0.4, 0.6, 0.8, 0.95, 1].map(factor => Math.floor(current * factor));

  const SPARKLINES = {
    athletes: buildTrend(athletes.length),
    matches: buildTrend(matches.length),
    kos: buildTrend(RESULT_PIE.find(p => p.name === t("ko_tko", settings.language))?.value || 0),
    decisions: buildTrend(RESULT_PIE.find(p => p.name === t("decision", settings.language))?.value || 0),
    ippons: buildTrend(RESULT_PIE.find(p => p.name === t("ippon_kids", settings.language))?.value || 0),
    disquals: buildTrend(RESULT_PIE.find(p => p.name === t("disqualification", settings.language))?.value || 0),
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-20">
      <PageHeader
        category={t("analytics" as any, settings.language)}
        title={t("tournament_statistics", settings.language)}
        subtitle={t("complete_performance_data", settings.language)}
        categoryIcon={<BarChart3 size={16} />}
        actions={
          <>
            <IKFButton variant="ghost" leftIcon={<GitBranch size={16} />} onClick={() => router.push("/brackets")}>Brackets</IKFButton>
            <IKFButton variant="secondary" leftIcon={<FileText size={16} />} onClick={() => router.push("/reports")}>Reports</IKFButton>
            <IKFButton variant="gold" leftIcon={<Bot size={16} />} onClick={() => router.push("/ai")}>AI Insights</IKFButton>
          </>
        }
      />

      <AnimatedSection>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
          <HeroStat label={t("total_athletes" as any, settings.language)} value={athletes.length} trend={SPARKLINES.athletes} color={RED} delta="live registry" />
          <HeroStat label={t("total_matches", settings.language)} value={matches.length} trend={SPARKLINES.matches} color={BLUE} delta="live schedule" />
          <HeroStat label={t("kos_tkos", settings.language)} value={SPARKLINES.kos[6]} trend={SPARKLINES.kos} color={RED} delta="-" />
          <HeroStat label={t("stats_decisions", settings.language)} value={SPARKLINES.decisions[6]} trend={SPARKLINES.decisions} color={TEAL} delta="-" />
          <HeroStat label={t("ippons_kids", settings.language)} value={SPARKLINES.ippons[6]} trend={SPARKLINES.ippons} color={GOLD} delta="-" />
          <HeroStat label={t("disqualifications", settings.language)} value={SPARKLINES.disquals[6]} trend={SPARKLINES.disquals} color={PURPLE} delta="-" />
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <SectionDivider label={t("results_breakdown", settings.language)} accent="red" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <IKFCard padding="lg">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t("result_distribution", settings.language)}</h3>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie data={RESULT_PIE} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {RESULT_PIE.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3 flex-1">
                {RESULT_PIE.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-sm font-medium text-[var(--text-secondary)]">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white text-sm mr-2">{entry.value}</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">{TOTAL_MATCHES > 0 ? ((entry.value / TOTAL_MATCHES) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </IKFCard>

          <IKFCard padding="lg">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t("matches_per_weight_category", settings.language)}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={CATEGORY_BARS} layout="vertical" margin={{ left: 8, right: 36 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MUTED} horizontal={false} />
                <XAxis type="number" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="cat" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<DarkTooltip />} cursor={false} />
                <Bar dataKey="matches" fill={RED} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="matches" position="right" style={{ fill: TEXT, fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </IKFCard>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <IKFCard padding="lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">Completed Matches Timeline</h3>
            <span className="text-xs text-[var(--text-muted)]">Real data from validated match times</span>
          </div>
          {TIMELINE.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-[var(--text-muted)] border border-dashed border-[var(--border-default)] rounded-xl">No completed match timing data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={TIMELINE} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={false} />
                <Line type="monotone" dataKey="matches" name="Completed matches" stroke={GOLD} strokeWidth={4} dot={{ r: 4, strokeWidth: 2, stroke: "#050508", fill: GOLD }} activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2, fill: RED }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </IKFCard>
      </AnimatedSection>

      {COUNTRIES.length > 0 && (
        <AnimatedSection delay={0.05}>
          <SectionDivider label={t("country_performance", settings.language)} accent="gold" />
          <div className="mt-6 space-y-6">
            <IKFCard padding="none" className="overflow-hidden">
              <div className="grid grid-cols-[48px_1fr_auto_auto_auto] gap-x-6 px-6 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                <div>#</div><div>{t("country", settings.language)}</div><div className="text-right">{t("medals", settings.language)}</div><div className="text-right">{t("wins", settings.language)}</div><div className="text-right">{t("win_pct", settings.language)}</div>
              </div>
              {COUNTRIES.map(c => (
                <div key={c.rank} className="grid grid-cols-[48px_1fr_auto_auto_auto] gap-x-6 px-6 py-4 border-b border-[rgba(255,255,255,0.03)] items-center hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <div className="font-display text-2xl" style={{ color: c.rank === 1 ? GOLD : c.rank === 2 ? "#b0b0b0" : c.rank === 3 ? "#b46432" : "rgba(255,255,255,0.3)" }}>{c.rank}</div>
                  <div className="font-semibold text-white">{c.country}</div>
                  <div><MedalDots gold={c.gold} silver={c.silver} bronze={c.bronze} /></div>
                  <div className="text-right font-mono font-bold text-white">{c.wins}</div>
                  <div className="text-right"><span className="font-mono font-bold text-sm" style={{ color: c.rate >= 80 ? GREEN : c.rate >= 65 ? GOLD : TEXT }}>{c.rate}%</span></div>
                </div>
              ))}
            </IKFCard>

            <IKFCard padding="lg">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t("gold_medals_by_country", settings.language)}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={GOLD_BARS} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={MUTED} vertical={false} />
                  <XAxis dataKey="country" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} cursor={false} />
                  <Bar dataKey="gold" fill={GOLD} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="gold" position="top" style={{ fill: GOLD, fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </IKFCard>
          </div>
        </AnimatedSection>
      )}

      <AnimatedSection delay={0.05}>
        <SectionDivider label={t("match_activity_timeline", settings.language)} accent="red" />
        <IKFCard padding="lg" className="mt-6">
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t("matches_completed_today", settings.language)}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TIMELINE} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={MUTED} vertical={false} />
              <XAxis dataKey="time" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} cursor={false} />
              <Line type="monotone" dataKey="matches" name="Matches" stroke={RED} strokeWidth={4} dot={{ fill: RED, r: 4, strokeWidth: 0 }} activeDot={{ r: 7, fill: GOLD, stroke: "#050508", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </IKFCard>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <SectionDivider label={t("referee_performance", settings.language)} accent="gold" />
        <IKFCard padding="none" className="mt-6 overflow-hidden">
          <div className="grid grid-cols-[1.35fr_150px_90px_120px_120px_120px_120px] gap-x-4 px-6 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            <div>{t("referee", settings.language)}</div>
            <div>Role</div>
            <div className="text-center">{t("matches_uc" as any, settings.language)}</div>
            <div className="text-center">Scorecards</div>
            <div className="text-center">{t("cards_yr", settings.language)}</div>
            <div className="text-center">Methods</div>
            <div className="text-right">Last activity</div>
          </div>
          {REFEREES_DATA.map(r => (
            <div key={r.id} className="grid grid-cols-[1.35fr_150px_90px_120px_120px_120px_120px] gap-x-4 px-6 py-4 border-b border-[rgba(255,255,255,0.03)] items-center hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="font-semibold text-white">{r.name}</div>
              <div className="text-xs text-[var(--text-secondary)] font-bold">{r.role}</div>
              <div className="text-center font-mono font-bold text-white">{r.matches}</div>
              <div className="text-center font-mono font-bold text-[var(--corner-blue)]">{r.submittedScorecards}</div>
              <div className="text-center flex items-center justify-center gap-3">
                <span className="text-[var(--ikf-gold)] font-bold text-sm">Y:{r.yellow}</span>
                <span className="text-[var(--ikf-red)] font-bold text-sm">R:{r.red}</span>
              </div>
              <div className="text-center font-mono font-bold text-[var(--ikf-gold)]">{r.methodCalls}</div>
              <div className="text-right text-xs text-[var(--text-muted)] font-mono">{r.lastActivity}</div>
            </div>
          ))}
        </IKFCard>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <SectionDivider label={t("weight_category_breakdown", settings.language)} accent="red" />
        <IKFCard padding="lg" className="mt-6">
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t("participation_per_weight_category", settings.language)}</h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={CATEGORY_BARS.map(c => ({ category: c.cat, value: c.matches }))} cx="50%" cy="50%" outerRadius={160}>
              <PolarGrid stroke={MUTED} />
              <PolarAngleAxis dataKey="category" tick={{ fill: TEXT, fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, Math.max(1, ...CATEGORY_BARS.map(c => c.matches))]} tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} />
              <Radar name="Matches" dataKey="value" stroke={RED} fill={RED} fillOpacity={0.18} strokeWidth={2} dot={{ r: 4, fill: RED, strokeWidth: 0 }} activeDot={{ r: 6, fill: GOLD, strokeWidth: 0 }} />
              <Tooltip content={<DarkTooltip />} cursor={false} />
            </RadarChart>
          </ResponsiveContainer>
        </IKFCard>
      </AnimatedSection>
    </div>
  );
}
