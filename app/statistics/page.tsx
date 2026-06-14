/* eslint-disable */
"use client";

import React, { useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
} from "recharts";
import { motion, useInView } from "framer-motion";
import { BarChart3, Bot, FileText, GitBranch, Star } from "lucide-react";
import { PageHeader, IKFButton, IKFCard, SectionDivider } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";

// ── Color Tokens ────────────────────────────────────────────────────────────
const RED    = "#c8102e";
const GOLD   = "#d4a017";
const BLUE   = "#0066cc";
const GREEN  = "#2ecc71";
const PURPLE = "#9b59b6";
const TEAL   = "#1abc9c";
const MUTED  = "rgba(255,255,255,0.08)";
const TEXT   = "rgba(255,255,255,0.45)";

// ── Custom dark tooltip ──────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 shadow-2xl min-w-[140px]">
      {label && <div className="text-xs font-bold text-[rgba(255,255,255,0.4)] mb-1.5 uppercase tracking-wider">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill || RED }} />
            <span className="text-xs text-[rgba(255,255,255,0.6)]">{p.name || p.dataKey}</span>
          </span>
          <span className="text-sm font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Sparkline component ──────────────────────────────────────────────────────
const Sparkline = ({ data, color = RED }: { data: number[]; color?: string }) => {
  const points = data.map((v, i) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Animated section wrapper ─────────────────────────────────────────────────
function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Hero StatCard with sparkline ─────────────────────────────────────────────
interface HeroStatProps { label: string; value: number; trend: number[]; color?: string; delta?: string; }
function HeroStat({ label, value, trend, color = RED, delta }: HeroStatProps) {
  return (
    <IKFCard padding="lg" className="flex flex-col justify-between">
      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">{label}</div>
      <div className="font-display text-5xl text-white mb-1">{value}</div>
      {delta && <div className="text-xs font-semibold" style={{ color }}>{delta}</div>}
      <div className="mt-3">
        <Sparkline data={trend} color={color} />
      </div>
    </IKFCard>
  );
}

const RANK_STYLE: Record<number, string> = {
  1: "bg-[rgba(212,160,23,0.08)] border-l-4 border-[var(--ikf-gold)]",
  2: "bg-[rgba(180,180,180,0.06)] border-l-4 border-[rgba(180,180,180,0.5)]",
  3: "bg-[rgba(180,100,50,0.07)] border-l-4 border-[rgba(180,100,50,0.5)]",
};
const RANK_DOT: Record<number, string> = { 1: "#d4a017", 2: "#b0b0b0", 3: "#b46432" };

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} fill={i <= n ? GOLD : "none"} stroke={i <= n ? GOLD : "rgba(255,255,255,0.2)"} />
      ))}
    </div>
  );
}

function MedalDots({ gold, silver, bronze }: { gold: number; silver: number; bronze: number }) {
  return (
    <div className="flex items-center gap-3 text-sm font-bold">
      <span style={{ color: GOLD }}>●{gold}</span>
      <span style={{ color: "#b0b0b0" }}>●{silver}</span>
      <span style={{ color: "#b46432" }}>●{bronze}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const router = useRouter();
  const { matches, athletes, referees, settings, roundEvents } = useTournamentStore();

  const completedMatches = matches.filter(m => m.status === "completed");

  const RESULT_PIE = useMemo(() => {
    let decision = 0, ko = 0, ippon = 0, dq = 0, draw = 0;
    completedMatches.forEach(m => {
      const reason = m.result?.method?.toLowerCase() || "";
      if (reason.includes("decision") || reason.includes("override")) decision++;
      else if (reason.includes("ko") || reason.includes("tko")) ko++;
      else if (reason.includes("ippon")) ippon++;
      else if (reason.includes("dq") || reason.includes("disqualification")) dq++;
      else if (reason.includes("draw")) draw++;
      else decision++; // fallback
    });

    return [
      { name: t('decision', settings.language), value: decision, color: BLUE },
      { name: t('ko_tko', settings.language), value: ko, color: RED },
      { name: t('ippon_kids', settings.language), value: ippon, color: GOLD },
      { name: t('disqualification', settings.language), value: dq, color: PURPLE },
      { name: t('draw', settings.language), value: draw, color: TEAL },
    ];
  }, [completedMatches, settings.language]);

  const TOTAL_MATCHES = RESULT_PIE.reduce((a, b) => a + b.value, 0);

  const CATEGORY_BARS = useMemo(() => {
    const counts: Record<string, number> = {};
    matches.forEach(m => {
      const key = `${m.ageGroup} ${m.weightCategory}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([cat, count]) => ({ cat, matches: count })).sort((a,b) => b.matches - a.matches);
  }, [matches]);

  const COUNTRIES = useMemo(() => {
    const stats: Record<string, { gold: number, silver: number, bronze: number, wins: number, bouts: number }> = {};
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
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, matches]) => ({ time, matches }));
  }, [completedMatches]);

  const REFEREES_DATA = referees.map(r => {
    const assignedMatches = matches.filter(m => m.assignedJudgeIds?.includes(r.id) || m.assignedRefereeId === r.id);
    const refereeEvents = roundEvents.filter(e => assignedMatches.some(m => e.details?.toLowerCase().includes(`match #${m.matchNumber}`)));
    const yellow = refereeEvents.filter(e => e.type === "yellow-card").length;
    const red = refereeEvents.filter(e => e.type === "red-card").length;
    const completedAssigned = assignedMatches.filter(m => m.status === "completed").length;
    const rating = completedAssigned >= 5 ? 5 : completedAssigned >= 3 ? 4 : completedAssigned >= 1 ? 3 : 2;
    return {
      name: r.name,
      matches: assignedMatches.length,
      yellow,
      red,
      protests: "0 sustained / 0 rejected",
      rating,
    };
  }).sort((a,b) => b.matches - a.matches || b.rating - a.rating).slice(0, 5);

  const buildTrend = (current: number) => [0, 0, 0, 0, 0, 0, current];
  const SPARKLINES = {
    athletes: buildTrend(athletes.length),
    matches: buildTrend(matches.length),
    kos: buildTrend(RESULT_PIE.find(p=>p.name===t('ko_tko', settings.language))?.value||0),
    decisions: buildTrend(RESULT_PIE.find(p=>p.name===t('decision', settings.language))?.value||0),
    ippons: buildTrend(RESULT_PIE.find(p=>p.name===t('ippon_kids', settings.language))?.value||0),
    disquals: buildTrend(RESULT_PIE.find(p=>p.name===t('disqualification', settings.language))?.value||0),
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-20">
      <PageHeader
        category={t('analytics', settings.language)}
        title={t('tournament_statistics', settings.language)}
        subtitle={t('complete_performance_data', settings.language)}
        categoryIcon={<BarChart3 size={16} />}
        actions={
          <>
            <IKFButton variant="ghost" leftIcon={<GitBranch size={16} />} onClick={() => router.push('/brackets')}>Brackets</IKFButton>
            <IKFButton variant="secondary" leftIcon={<FileText size={16} />} onClick={() => router.push('/reports')}>Reports</IKFButton>
            <IKFButton variant="gold" leftIcon={<Bot size={16} />} onClick={() => router.push('/ai')}>AI Insights</IKFButton>
          </>
        }
      />

      {/* ── HERO STATS ────────────────────────────────────────────────────── */}
      <AnimatedSection>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
          <HeroStat label={t('total_athletes', settings.language)}   value={athletes.length} trend={SPARKLINES.athletes}  color={RED}    delta="live registry" />
          <HeroStat label={t('total_matches', settings.language)}    value={matches.length} trend={SPARKLINES.matches}   color={BLUE}   delta="live schedule" />
          <HeroStat label={t('kos_tkos', settings.language)}       value={SPARKLINES.kos[6]}  trend={SPARKLINES.kos}       color={RED}    delta="-" />
          <HeroStat label={t('decisions', settings.language)}        value={SPARKLINES.decisions[6]} trend={SPARKLINES.decisions} color={TEAL}   delta="-" />
          <HeroStat label={t('ippons_kids', settings.language)}    value={SPARKLINES.ippons[6]}  trend={SPARKLINES.ippons}    color={GOLD}   delta="-" />
          <HeroStat label={t('disqualifications', settings.language)} value={SPARKLINES.disquals[6]}  trend={SPARKLINES.disquals}  color={PURPLE} delta="-" />
        </div>
      </AnimatedSection>

      {/* ── SECTION 1: RESULTS BREAKDOWN ───────────────────────────────────── */}
      <AnimatedSection delay={0.05}>
        <SectionDivider label={t('results_breakdown', settings.language)} accent="red" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">

          {/* Donut */}
          <IKFCard padding="lg">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t('result_distribution', settings.language)}</h3>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie data={RESULT_PIE} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {RESULT_PIE.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3 flex-1">
                {RESULT_PIE.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-sm font-medium text-[var(--text-secondary)]">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white text-sm mr-2">{entry.value}</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {TOTAL_MATCHES > 0 ? ((entry.value / TOTAL_MATCHES) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </IKFCard>

          {/* Horizontal bar — matches per category */}
          <IKFCard padding="lg">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t('matches_per_weight_category', settings.language)}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={CATEGORY_BARS} layout="vertical" margin={{ left: 8, right: 36 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MUTED} horizontal={false} />
                <XAxis type="number" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="cat" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="matches" fill={RED} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="matches" position="right" style={{ fill: TEXT, fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </IKFCard>
        </div>
      </AnimatedSection>

      {/* ── SECTION 1B: REAL MATCH TIMELINE CURVE ─────────────────────────── */}
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
              <AreaChart data={TIMELINE} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="matchesCurve" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                    <stop offset="70%" stopColor={RED} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: GOLD, strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="matches" name="Completed matches" stroke={GOLD} strokeWidth={3} fill="url(#matchesCurve)" dot={{ r: 4, strokeWidth: 2, stroke: "#050508", fill: GOLD }} activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2, fill: RED }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </IKFCard>
      </AnimatedSection>

      {/* ── SECTION 2: COUNTRY PERFORMANCE ─────────────────────────────────── */}
      {COUNTRIES.length > 0 && (
      <AnimatedSection delay={0.05}>
        <SectionDivider label={t('country_performance', settings.language)} accent="gold" />
        <div className="mt-6 space-y-6">
          <IKFCard padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[48px_1fr_auto_auto_auto] gap-x-6 px-6 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              <div>#</div>
              <div>{t('country', settings.language)}</div>
              <div className="text-right">{t('medals', settings.language)}</div>
              <div className="text-right">{t('wins', settings.language)}</div>
              <div className="text-right">{t('win_pct', settings.language)}</div>
            </div>
            {COUNTRIES.map(c => (
              <div
                key={c.rank}
                className={`grid grid-cols-[48px_1fr_auto_auto_auto] gap-x-6 px-6 py-4 border-b border-[rgba(255,255,255,0.03)] items-center ${RANK_STYLE[c.rank] || "hover:bg-[rgba(255,255,255,0.02)]"}`}
              >
                <div className="font-display text-2xl" style={{ color: RANK_DOT[c.rank] ?? "rgba(255,255,255,0.3)" }}>
                  {c.rank}
                </div>
                <div className="font-semibold text-white">{c.country}</div>
                <div><MedalDots gold={c.gold} silver={c.silver} bronze={c.bronze} /></div>
                <div className="text-right font-mono font-bold text-white">{c.wins}</div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm" style={{ color: c.rate >= 80 ? GREEN : c.rate >= 65 ? GOLD : TEXT }}>
                    {c.rate}%
                  </span>
                </div>
              </div>
            ))}
          </IKFCard>

          {/* Gold medals bar chart */}
          <IKFCard padding="lg">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">{t('gold_medals_by_country', settings.language)}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={GOLD_BARS} margin={{ left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MUTED} vertical={false} />
                <XAxis dataKey="country" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="gold" fill={GOLD} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="gold" position="top" style={{ fill: GOLD, fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </IKFCard>
        </div>
      </AnimatedSection>
      )}

      {/* ── SECTION 3: MATCH ACTIVITY TIMELINE ─────────────────────────────── */}
      <AnimatedSection delay={0.05}>
        <SectionDivider label={t('match_activity_timeline', settings.language)} accent="red" />
        <IKFCard padding="lg" className="mt-6">
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">
            {t('matches_completed_today', settings.language)}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={TIMELINE} margin={{ left: 0, right: 12 }}>
              <defs>
                <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RED} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={MUTED} vertical={false} />
              <XAxis dataKey="time" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: GOLD, strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area
                type="monotone" dataKey="matches" name="Matches"
                stroke={RED} strokeWidth={2.5}
                fill="url(#redGradient)"
                dot={{ fill: RED, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: GOLD, stroke: "none" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </IKFCard>
      </AnimatedSection>

      {/* ── SECTION 4: REFEREE PERFORMANCE ─────────────────────────────────── */}
      <AnimatedSection delay={0.05}>
        <SectionDivider label={t('referee_performance', settings.language)} accent="gold" />
        <IKFCard padding="none" className="mt-6 overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_120px_200px_100px] gap-x-4 px-6 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            <div>{t('referee', settings.language)}</div>
            <div className="text-center">{t('matches_uc', settings.language)}</div>
            <div className="text-center">{t('cards_yr', settings.language)}</div>
            <div>{t('protests', settings.language)}</div>
            <div className="text-right">{t('rating', settings.language)}</div>
          </div>
          {REFEREES_DATA.map((r, i) => (
            <div
              key={r.name}
              className="grid grid-cols-[1fr_80px_120px_200px_100px] gap-x-4 px-6 py-4 border-b border-[rgba(255,255,255,0.03)] items-center hover:bg-[rgba(255,255,255,0.02)] transition-colors"
            >
              <div className="font-semibold text-white">{r.name}</div>
              <div className="text-center font-mono font-bold text-white">{r.matches}</div>
              <div className="text-center flex items-center justify-center gap-3">
                <span className="text-[var(--ikf-gold)] font-bold text-sm">Y:{r.yellow}</span>
                <span className="text-[var(--ikf-red)] font-bold text-sm">R:{r.red}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono">{r.protests}</div>
              <div className="flex justify-end"><Stars n={r.rating} /></div>
            </div>
          ))}
        </IKFCard>
      </AnimatedSection>

      {/* ── SECTION 5: WEIGHT CATEGORY RADAR ───────────────────────────────── */}
      <AnimatedSection delay={0.05}>
        <SectionDivider label={t('weight_category_breakdown', settings.language)} accent="red" />
        <IKFCard padding="lg" className="mt-6">
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">
            {t('participation_per_weight_category', settings.language)}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={CATEGORY_BARS.map(c => ({ category: c.cat, value: c.matches }))} cx="50%" cy="50%" outerRadius={160}>
              <PolarGrid stroke={MUTED} />
              <PolarAngleAxis dataKey="category" tick={{ fill: TEXT, fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, Math.max(1, ...CATEGORY_BARS.map(c => c.matches))]} tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} />
              <Radar
                name="Matches" dataKey="value"
                stroke={RED} fill={RED} fillOpacity={0.18}
                strokeWidth={2}
                dot={{ r: 4, fill: RED, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: GOLD, strokeWidth: 0 }}
              />
              <Tooltip content={<DarkTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </IKFCard>
      </AnimatedSection>

    </div>
  );
}

