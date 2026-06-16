/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useTournamentStore, useLiveAggregateScore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";
import { formatMatchCategory } from "@/lib/ageCategories";
import { deriveLiveMatchTimers, useFirebaseLiveMatchStates, useFirebaseMatchState, FirebaseMatchState } from "@/hooks/useFirebaseMatchSync";
import { StoredJudgeScore, StoredJudgingEvent, useFirebaseJudgingData } from "@/hooks/useFirebaseJudgingSync";
import type { RoundEvent } from "@/types/tournament";

// ── Hexagonal SVG background pattern ───────────────────────────────────────
function HexBackground() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" x="0" y="0" width="56" height="100" patternUnits="userSpaceOnUse">
          <polygon points="28,2 54,16 54,44 28,58 2,44 2,16" fill="none" stroke="#ffffff" strokeWidth="0.8"/>
          <polygon points="28,52 54,66 54,94 28,108 2,94 2,66" fill="none" stroke="#ffffff" strokeWidth="0.8"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  );
}

// ── Particle system for winner animation ─────────────────────────────────────
function Particles({ color }: { color: string }) {
  const particles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    left: `${((i * 37) % 100)}%`,
    duration: `${1.5 + ((i * 13) % 30) / 10}s`,
    delay: `${((i * 7) % 20) / 10}s`,
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full opacity-80"
          style={{
            backgroundColor: color,
            left: particle.left,
            top: "-10px",
            boxShadow: `0 0 6px ${color}`,
            animation: `particle-fall ${particle.duration} ease-in ${particle.delay} forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ── Corner card component ────────────────────────────────────────────────────
interface CornerCardProps {
  side: "RED" | "BLUE";
  name: string;
  club: string;
  country: string;
  score: number;
  label: string;
  yellowCards?: number;
  redCards?: number;
}

function CornerCard({ side, name, club, country, score, label, yellowCards = 0, redCards = 0 }: CornerCardProps) {
  const isRed = side === "RED";
  return (
    <div
      className="flex-1 relative flex flex-col justify-center overflow-hidden"
      style={{
        background: isRed
          ? "linear-gradient(to right, rgba(180,10,30,0.5) 0%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to left, rgba(0,60,160,0.5) 0%, rgba(0,0,0,0) 100%)",
      }}
    >
      {/* Edge accent stripe */}
      <div
        className="absolute top-0 bottom-0 w-2"
        style={{
          [isRed ? "left" : "right"]: 0,
          background: isRed ? "var(--ikf-red)" : "var(--corner-blue)",
          boxShadow: `0 0 40px 4px ${isRed ? "rgba(200,16,46,0.6)" : "rgba(0,102,204,0.6)"}`,
        }}
      />

      <div className={`flex flex-col ${isRed ? "items-start pl-14" : "items-end pr-14"}`}>
        {/* Corner Label */}
        <div
          className="text-sm font-bold tracking-[0.4em] uppercase mb-4 px-3 py-1 rounded"
          style={{
            color: isRed ? "var(--ikf-red)" : "var(--corner-blue)",
            background: isRed ? "rgba(200,16,46,0.15)" : "rgba(0,102,204,0.15)",
            border: `1px solid ${isRed ? "rgba(200,16,46,0.4)" : "rgba(0,102,204,0.4)"}`,
          }}
        >
          {isRed ? "🔴" : "🔵"} {label.toUpperCase()}
        </div>

        {/* Fighter Name */}
        <h1
          className="font-display leading-none mb-3 text-white"
          style={{ fontSize: "clamp(48px, 5.5vw, 96px)" }}
        >
          {name}
        </h1>

        {/* Club + Country */}
        <p className="text-2xl font-semibold text-[rgba(255,255,255,0.5)] mb-8">
          {[club, country].filter(Boolean).join(" · ") || "Awaiting athlete profile"}
        </p>

        {/* Score */}
        <div
          className="font-display leading-none transition-all duration-300"
          style={{
            fontSize: "clamp(100px, 14vw, 200px)",
            color: isRed ? "var(--ikf-red)" : "var(--corner-blue)",
            textShadow: isRed
              ? "0 0 60px rgba(200,16,46,0.5)"
              : "0 0 60px rgba(0,102,204,0.5)",
          }}
        >
          {score}
        </div>

        {/* Penalty cards */}
        {(yellowCards > 0 || redCards > 0) && (
          <div className={`flex gap-2 mt-4 ${isRed ? "" : "flex-row-reverse"}`}>
            {Array.from({ length: yellowCards }).map((_, i) => (
              <div
                key={`yellow-${i}`}
                className="w-5 h-7 rounded-sm"
                style={{ background: "#f1c40f", boxShadow: "0 0 10px rgba(241,196,15,0.6)" }}
              />
            ))}
            {Array.from({ length: redCards }).map((_, i) => (
              <div
                key={`red-${i}`}
                className="w-5 h-7 rounded-sm animate-pulse"
                style={{ background: "#c8102e", boxShadow: "0 0 14px rgba(200,16,46,0.85)" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Firebase connection indicator ────────────────────────────────────────────
function sameEventKey(event: RoundEvent | StoredJudgingEvent) {
  return `${event.id || event.timestamp}-${event.type}-${event.corner || ""}-${event.details}`;
}

const METHOD_EVENT_TYPES = new Set(["decision", "ko-tko", "ippon-result", "disqualification", "draw"]);

function methodLabel(type: string) {
  const labels: Record<string, string> = {
    decision: "Decision",
    "ko-tko": "KO / TKO",
    "ippon-result": "Ippon (Kids)",
    disqualification: "Disqualification",
    draw: "DRAW",
  };
  return labels[type] ?? type;
}

function SyncBadge({ synced }: { synced: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${synced ? "border-green-500 text-green-400 bg-green-500/10" : "border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.3)] bg-transparent"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${synced ? "bg-green-400 animate-pulse" : "bg-[rgba(255,255,255,0.3)]"}`} />
      {synced ? "LIVE SYNC" : "STANDBY"}
    </div>
  );
}

// ── Main TV Display ──────────────────────────────────────────────────────────
export default function TVDisplay() {
  const { 
    activeMatch, matches, athletes, currentRound, roundTimer, timerMode, roundEvents, settings, referees, judgeScores 
  } = useTournamentStore();

  const [now, setNow] = useState(new Date());
  const [showResult, setShowResult] = useState(false);
  const [databaseScores, setDatabaseScores] = useState<StoredJudgeScore[]>([]);
  const [databaseEvents, setDatabaseEvents] = useState<StoredJudgingEvent[]>([]);
  const [latestCard, setLatestCard] = useState<(RoundEvent | StoredJudgingEvent) | null>(null);
  const [latestMethod, setLatestMethod] = useState<(RoundEvent | StoredJudgingEvent) | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [liveMatchStates, setLiveMatchStates] = useState<Record<string, FirebaseMatchState>>({});
  const lastCardKeyRef = useRef("");
  const lastMethodKeyRef = useRef("");
  const tickerContentRef = useRef<HTMLDivElement>(null);

  // Firebase live state
  const [fbState, setFbState] = useState<FirebaseMatchState | null>(null);
  const [fbConnected, setFbConnected] = useState(false);

  useFirebaseMatchState((state) => {
    setFbState(state);
    setFbConnected(true);
    // Reset after 10s of no update
    setTimeout(() => setFbConnected(false), 10000);
  });
  useFirebaseLiveMatchStates(setLiveMatchStates);

  const { red: activeAggRed, blue: activeAggBlue } = useLiveAggregateScore();

  const availableMatches = useMemo(
    () => matches
      .filter(match =>
        match.status !== "completed" &&
        Boolean(match.redCornerId) &&
        Boolean(match.blueCornerId) &&
        !match.isBye
      )
      .sort((a, b) => {
        const aLive = a.status === "in-progress" || Boolean(liveMatchStates[a.id]);
        const bLive = b.status === "in-progress" || Boolean(liveMatchStates[b.id]);
        if (aLive !== bLive) return aLive ? -1 : 1;
        return a.matchNumber - b.matchNumber;
      }),
    [liveMatchStates, matches],
  );

  const syncedActiveMatch = activeMatch ? matches.find(m => m.id === activeMatch.id) ?? activeMatch : null;
  const displayMatch = selectedMatchId
    ? (matches.find(m => m.id === selectedMatchId) ?? null)
    : null;
  const selectedFbState = displayMatch
    ? (liveMatchStates[displayMatch.id] ?? (fbState?.matchId === displayMatch.id ? fbState : null))
    : null;

  // Determine which state to use: selected per-match Firebase state takes priority.
  const derivedTimers = deriveLiveMatchTimers(selectedFbState);
  const liveTimerMode = selectedFbState?.timerMode ?? (syncedActiveMatch?.id === displayMatch?.id ? timerMode : "idle");
  const liveRoundTimer = derivedTimers?.roundTimer ?? selectedFbState?.roundTimer ?? (syncedActiveMatch?.id === displayMatch?.id ? roundTimer : displayMatch?.roundDurationSeconds ?? 180);
  const liveCurrentRound = selectedFbState?.currentRound ?? (syncedActiveMatch?.id === displayMatch?.id ? currentRound : 1);
  const liveRestTimer = derivedTimers?.restTimer ?? selectedFbState?.restTimer ?? 60;
  const liveWoskTimeLeft = derivedTimers?.woskTimeLeft ?? selectedFbState?.woskTimeLeft ?? 10;
  const liveWoskCorner = selectedFbState?.woskCorner ?? null;
  const liveMaxTime = selectedFbState?.maxTime ?? displayMatch?.roundDurationSeconds ?? 180;
  const liveTotalRounds = selectedFbState?.totalRounds ?? displayMatch?.totalRounds ?? 3;

  useFirebaseJudgingData(displayMatch?.id ?? null, ({ scores, events }) => {
    setDatabaseScores(scores);
    setDatabaseEvents(events);
  });

  const redAthlete = athletes.find(a => a.id === displayMatch?.redCornerId);
  const blueAthlete = athletes.find(a => a.id === displayMatch?.blueCornerId);

  const combinedScores = useMemo(() => {
    const byRoundAndJudge = new Map<string, StoredJudgeScore | typeof judgeScores[number]>();
    judgeScores
      .filter(score => !displayMatch || score.matchId === displayMatch.id)
      .forEach(score => byRoundAndJudge.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));
    databaseScores.forEach(score => byRoundAndJudge.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));
    return Array.from(byRoundAndJudge.values());
  }, [databaseScores, displayMatch, judgeScores]);

  const scopedEvents = useMemo(() => {
    const localScoped = displayMatch
      ? roundEvents.filter(e => e.details?.toLowerCase().includes(`match #${displayMatch.matchNumber}`) || activeMatch?.id === displayMatch.id)
      : roundEvents;
    const databaseScoped = displayMatch ? databaseEvents.filter(event => event.matchId === displayMatch.id) : databaseEvents;
    const merged = new Map<string, RoundEvent | StoredJudgingEvent>();
    [...localScoped, ...databaseScoped].forEach(event => merged.set(sameEventKey(event), event));
    return Array.from(merged.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeMatch?.id, databaseEvents, displayMatch, roundEvents]);
  
  const displayScores = useMemo(() => {
    if (!displayMatch) return { red: 0, blue: 0 };
    const submitted = combinedScores.filter(s => s.matchId === displayMatch.id && s.submitted);
    if (submitted.length > 0) {
      return {
        red: submitted.reduce((sum, score) => sum + score.redScore, 0),
        blue: submitted.reduce((sum, score) => sum + score.blueScore, 0),
      };
    }
    // If Firebase state has scores from the same match, use them
    if (selectedFbState?.matchId === displayMatch.id) return { red: selectedFbState.redScore, blue: selectedFbState.blueScore };
    if (syncedActiveMatch?.id === displayMatch.id) return { red: activeAggRed, blue: activeAggBlue };
    if (displayMatch.result) return { red: displayMatch.result.redTotalScore, blue: displayMatch.result.blueTotalScore };
    return { red: 0, blue: 0 };
  }, [activeAggBlue, activeAggRed, syncedActiveMatch?.id, displayMatch, combinedScores, selectedFbState]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Trigger result when match is completed
  useEffect(() => {
    if (displayMatch?.status === "completed") {
      setShowResult(true);
      const timer = setTimeout(() => setShowResult(false), 15000);
      return () => clearTimeout(timer);
    } else {
      setShowResult(false);
    }
  }, [displayMatch?.status]);

  // Ticker animation
  useEffect(() => {
    const content = tickerContentRef.current;
    if (!content) return;
    let x = 0;
    const totalWidth = content.scrollWidth / 2;
    const id = setInterval(() => {
      x -= 1.5;
      if (Math.abs(x) >= totalWidth) x = 0;
      content.style.transform = `translateX(${x}px)`;
    }, 16);
    return () => clearInterval(id);
  }, [displayMatch?.id]);

  const cardEvents = useMemo(
    () => scopedEvents.filter(event => event.type === "yellow-card" || event.type === "red-card"),
    [scopedEvents],
  );
  const methodEvents = useMemo(
    () => scopedEvents.filter(event => METHOD_EVENT_TYPES.has(event.type)),
    [scopedEvents],
  );

  useEffect(() => {
    const newest = cardEvents[cardEvents.length - 1];
    if (!newest) return;
    const key = sameEventKey(newest);
    if (lastCardKeyRef.current === key) return;
    lastCardKeyRef.current = key;
    setLatestCard(newest);
    const timer = setTimeout(() => setLatestCard(null), 3600);
    return () => clearTimeout(timer);
  }, [cardEvents]);

  useEffect(() => {
    const newest = methodEvents[methodEvents.length - 1];
    if (!newest) return;
    const key = sameEventKey(newest);
    if (lastMethodKeyRef.current === key) return;
    lastMethodKeyRef.current = key;
    setLatestMethod(newest);
    const timer = setTimeout(() => setLatestMethod(null), 5200);
    return () => clearTimeout(timer);
  }, [methodEvents]);

  // Derived data
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  
  const circumference = 2 * Math.PI * 80;
  const progress = liveMaxTime > 0 ? (liveRoundTimer / liveMaxTime) : 1;
  const dashOffset = circumference * (1 - progress);

  let timerStatus = liveTimerMode.toUpperCase();
  if (liveTimerMode === "round") timerStatus = t('running_uc', settings.language);
  if (liveTimerMode === "idle" && liveRoundTimer < liveMaxTime) timerStatus = t('paused_uc', settings.language);
  if (liveTimerMode === "passivity") timerStatus = t('wosk_uc', settings.language);
  if (liveTimerMode === "rest") timerStatus = "REST";
  if (liveTimerMode === "medical") timerStatus = "MEDICAL";

  const actionBanner = liveTimerMode === "passivity" && liveWoskCorner
    ? { label: `WOSK STOP - ${liveWoskCorner}`, color: "#f1c40f" }
    : liveTimerMode === "medical"
      ? { label: "DOCTOR / MEDICAL PAUSE", color: "#0066cc" }
      : liveTimerMode === "rest"
        ? { label: "REST PERIOD", color: "var(--ikf-gold)" }
        : liveTimerMode === "idle" && displayMatch && liveRoundTimer < liveMaxTime
          ? { label: "MATCH PAUSED", color: "rgba(255,255,255,0.8)" }
          : null;

  // What time to show in the center ring?
  let displayTime = liveRoundTimer;
  if (liveTimerMode === "rest") displayTime = liveRestTimer;
  if (liveTimerMode === "passivity") displayTime = liveWoskTimeLeft;

  const matchWinner = displayMatch?.result?.winnerCorner || null;
  const winnerName = matchWinner === "RED"
    ? (displayMatch?.redCornerName ?? t('red_corner', settings.language).toUpperCase())
    : (displayMatch?.blueCornerName ?? t('blue_corner', settings.language).toUpperCase());
  const winnerColor = matchWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)";
  const winnerParticleColor = matchWinner === "RED" ? "#c8102e" : "#0066cc";

  // Build ticker text from recent events
  const tickerEvents = useMemo(() => {
    const recent = [...scopedEvents].reverse().slice(0, 10);
    if (recent.length === 0) return [t('waiting_for_events', settings.language), t('stay_tuned', settings.language)];
    return recent.map(e => {
      let prefix = "⚡ ";
      if (e.type === "yellow-card") prefix = "🟨 ";
      if (e.type === "red-card") prefix = "🟥 ";
      if (e.type === "doctor") prefix = "⚕️ ";
      if (e.type === "round-start") prefix = "⏱️ ";
      if (e.type === "match-end") prefix = "🏆 ";
      if (METHOD_EVENT_TYPES.has(e.type)) prefix = "[METHOD] ";
      const eventName = METHOD_EVENT_TYPES.has(e.type) ? `${methodLabel(e.type)} - ` : "";
      return `${prefix} ${eventName}${e.corner ? `${e.corner === 'RED' ? t('red_corner', settings.language) : t('blue_corner', settings.language)} - ` : ""}${e.details}`;
    });
  }, [scopedEvents, settings.language]);

  const tickerText = tickerEvents.join("   ·   ");

  const redWarnings = scopedEvents.filter(e => e.corner === "RED" && e.type === "yellow-card").length;
  const blueWarnings = scopedEvents.filter(e => e.corner === "BLUE" && e.type === "yellow-card").length;
  const redCards = scopedEvents.filter(e => e.corner === "RED" && e.type === "red-card").length;
  const blueCards = scopedEvents.filter(e => e.corner === "BLUE" && e.type === "red-card").length;

  const assignedOfficials = [
    displayMatch?.assignedRefereeId ? referees.find(r => r.id === displayMatch.assignedRefereeId) : null,
    ...(displayMatch?.assignedJudgeIds?.map(id => referees.find(r => r.id === id)) ?? []),
  ].filter(Boolean);

  // Timer ring color by mode
  const ringColor = liveTimerMode === "rest" ? "var(--ikf-gold)"
    : liveTimerMode === "medical" ? "#0066cc"
    : liveTimerMode === "passivity" ? "#f1c40f"
    : "var(--ikf-red)";

  if (!displayMatch) {
    return (
      <div className="min-h-[100dvh] bg-[#050508] text-white p-6 sm:p-10 overflow-y-auto">
        <HexBackground />
        <div className="relative z-10 max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.35em] text-[var(--ikf-gold)]">TV Output Display</div>
              <h1 className="mt-3 font-display text-5xl sm:text-7xl leading-none tracking-wide">Choose Match</h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-[rgba(255,255,255,0.55)]">
                Select the mat/match to show on the public TV. The display will stay locked to that match until you choose another one.
              </p>
            </div>
            <SyncBadge synced={fbConnected} />
          </div>

          {availableMatches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[rgba(255,255,255,0.14)] bg-white/[0.03] p-10 text-center text-[rgba(255,255,255,0.55)]">
              No current scheduled or live matches are available for TV display.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {availableMatches.map(match => {
                const liveState = liveMatchStates[match.id];
                const isLive = match.status === "in-progress" || Boolean(liveState);
                return (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => setSelectedMatchId(match.id)}
                    className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)] p-5 text-left shadow-2xl transition-all hover:-translate-y-0.5 hover:border-[var(--ikf-gold)] hover:bg-[rgba(212,160,23,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">Match #{match.matchNumber} - Mat {match.matNumber}</div>
                        <div className="mt-2 font-display text-3xl leading-none text-white">{formatMatchCategory(match.ageGroup, match.weightCategory, match.gender)}</div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isLive ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-[var(--ikf-gold)]/40 bg-[var(--ikf-gold)]/10 text-[var(--ikf-gold)]"}`}>
                        {isLive ? "Live" : "Ready"}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ikf-red)]">Red</div>
                        <div className="truncate text-lg font-bold text-white">{match.redCornerName}</div>
                      </div>
                      <div className="font-display text-xl text-[rgba(255,255,255,0.35)]">vs</div>
                      <div className="min-w-0 text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--corner-blue)]">Blue</div>
                        <div className="truncate text-lg font-bold text-white">{match.blueCornerName}</div>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-[rgba(255,255,255,0.07)] pt-4 text-xs font-bold uppercase tracking-widest text-[rgba(255,255,255,0.45)]">
                      <span>Round {liveState?.currentRound ?? 1} / {liveState?.totalRounds ?? match.totalRounds ?? 3}</span>
                      <span>{liveState ? formatTime(deriveLiveMatchTimers(liveState)?.roundTimer ?? liveState.roundTimer) : "Standby"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden relative flex flex-col select-none"
      style={{ background: "#000000", fontFamily: "var(--font-body)" }}
    >
      {/* Hex background */}
      <HexBackground />

      {/* Red ambient glow at top */}
      <div
        className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(200,16,46,0.18) 0%, transparent 100%)",
        }}
      />

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-10 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <div className="font-display text-2xl text-white tracking-[0.2em]">IKF KENSHIDO</div>
          <button
            type="button"
            onClick={() => setSelectedMatchId("")}
            className="rounded-full border border-[rgba(255,255,255,0.14)] bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[rgba(255,255,255,0.62)] transition-colors hover:border-[var(--ikf-gold)] hover:text-[var(--ikf-gold)]"
          >
            Change Match
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div
            className="font-display text-3xl tracking-[0.3em] text-center"
            style={{ color: "var(--ikf-gold)" }}
          >
            {t('world_championship', settings.language)}
          </div>
          <SyncBadge synced={fbConnected} />
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl text-white font-bold">{format(now, "HH:mm:ss")}</div>
          <div className="text-sm font-bold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mt-1">
            {format(now, "d MMMM yyyy")} · {t('mat_uc', settings.language)} {displayMatch?.matNumber ? String(displayMatch.matNumber).padStart(2, '0') : "—"}
          </div>
        </div>
      </div>

      {/* ── MAIN FIGHT DISPLAY ──────────────────────────────────────────── */}
      <AnimatePresence>
        {actionBanner && (
          <motion.div
            key={actionBanner.label}
            initial={{ opacity: 0, y: -28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            className="absolute top-[92px] left-1/2 -translate-x-1/2 z-30 px-8 py-3 rounded-full border font-display text-2xl tracking-[0.25em] uppercase"
            style={{
              color: actionBanner.color,
              borderColor: actionBanner.color,
              background: "rgba(0,0,0,0.72)",
              boxShadow: `0 0 36px ${actionBanner.color}`,
            }}
          >
            {actionBanner.label}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative z-10 flex items-center">

        {/* RED CORNER */}
        <CornerCard
          side="RED"
          name={selectedFbState?.matchId ? selectedFbState.redCornerName : (displayMatch?.redCornerName ?? "RED CORNER")}
          club={redAthlete?.clubName ?? ""}
          country={redAthlete?.country ?? ""}
          score={displayScores.red}
          label={t('red_corner', settings.language)}
          yellowCards={redWarnings}
          redCards={redCards}
        />

        {/* CENTER: Timer + VS */}
        <div className="flex flex-col items-center justify-center w-[320px] flex-shrink-0 relative">
          {/* Round label */}
          <div
            className="font-display text-xl tracking-widest mb-4"
            style={{ color: "var(--ikf-gold)" }}
          >
            {liveTimerMode === "rest" ? "REST PERIOD" : liveTimerMode === "medical" ? "MEDICAL" : `${t('round', settings.language).toUpperCase()} ${liveCurrentRound} / ${liveTotalRounds}`}
          </div>

          {/* SVG circular ring + timer */}
          <div className="relative w-[220px] h-[220px] flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="110" cy="110" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="110" cy="110" r="80"
                fill="none"
                stroke={ringColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="relative z-10 text-center">
              <div
                className={`font-display leading-none text-white transition-all duration-300 ${liveTimerMode === "passivity" ? "animate-pulse text-[#f1c40f]" : ""}`}
                style={{ fontSize: "clamp(56px, 6vw, 88px)", textShadow: "0 0 40px rgba(255,255,255,0.2)" }}
              >
                {formatTime(displayTime)}
              </div>
              <div
                className="text-xs font-bold tracking-[0.25em] uppercase mt-1"
                style={{ color: timerStatus === "RUNNING" ? "var(--status-win)" : liveTimerMode === "rest" ? "var(--ikf-gold)" : liveTimerMode === "passivity" ? "#f1c40f" : "rgba(255,255,255,0.3)" }}
              >
                {liveTimerMode === "passivity" && liveWoskCorner ? `WOSK — ${liveWoskCorner}` : timerStatus}
              </div>
            </div>
          </div>

          {/* VS divider */}
          <div className="mt-6 flex items-center gap-0 w-full">
            <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to right, transparent, var(--ikf-red))" }} />
            <div className="font-display text-3xl text-white px-4">{t('vs', settings.language)}</div>
            <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to left, transparent, var(--corner-blue))" }} />
          </div>
        </div>

        {/* BLUE CORNER */}
        <CornerCard
          side="BLUE"
          name={selectedFbState?.matchId ? selectedFbState.blueCornerName : (displayMatch?.blueCornerName ?? "BLUE CORNER")}
          club={blueAthlete?.clubName ?? ""}
          country={blueAthlete?.country ?? ""}
          score={displayScores.blue}
          label={t('blue_corner', settings.language)}
          yellowCards={blueWarnings}
          redCards={blueCards}
        />
      </div>

      {/* ── JUDGE SCORE PANEL ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-stretch border-t border-[rgba(255,255,255,0.06)] h-[90px]">
        {/* Individual judge scores */}
        {assignedOfficials.map((judge, i) => {
          if (!judge) return null;
          const scoreEntry = combinedScores.find(s => s.matchId === displayMatch?.id && s.round === liveCurrentRound && s.judgeId === judge.id);
          const submitted = scoreEntry?.submitted;
          const rScore = scoreEntry?.redScore;
          const bScore = scoreEntry?.blueScore;
          return (
            <div
              key={judge.id}
              className="flex-1 flex flex-col items-center justify-center border-r border-[rgba(255,255,255,0.06)] gap-1"
            >
              <div className="text-[10px] font-bold text-[rgba(255,255,255,0.3)] tracking-[0.3em] uppercase">{judge.name}</div>
              {submitted ? (
                <div className="flex gap-3 items-center">
                  <span className="font-display text-2xl" style={{ color: "var(--ikf-red)" }}>{rScore}</span>
                  <span className="text-xs text-[rgba(255,255,255,0.3)]">–</span>
                  <span className="font-display text-2xl" style={{ color: "var(--corner-blue)" }}>{bScore}</span>
                </div>
              ) : (
                <div className="text-xs text-[rgba(255,255,255,0.25)] animate-pulse tracking-widest">{t('deciding_uc', settings.language)}</div>
              )}
            </div>
          );
        })}

        {/* Aggregate center block */}
        <div className="w-[260px] flex flex-col items-center justify-center border-l border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]">
          <div className="text-[10px] font-bold text-[rgba(255,255,255,0.35)] tracking-[0.3em] uppercase mb-1">{t('aggregate_uc', settings.language)}</div>
          <div className="flex gap-4 items-center">
            <span
              className="font-display text-4xl transition-all duration-300"
              style={{
                color: "var(--ikf-red)",
                textShadow: displayScores.red > displayScores.blue ? "0 0 20px rgba(200,16,46,0.6)" : undefined,
              }}
            >
              {displayScores.red}
            </span>
            <span className="text-[rgba(255,255,255,0.3)] font-bold text-xl">–</span>
            <span
              className="font-display text-4xl transition-all duration-300"
              style={{
                color: "var(--corner-blue)",
                textShadow: displayScores.blue > displayScores.red ? "0 0 20px rgba(0,102,204,0.6)" : undefined,
              }}
            >
              {displayScores.blue}
            </span>
          </div>
        </div>
      </div>

      {/* ── SCROLLING EVENT TICKER ───────────────────────────────────────── */}
      <div
        className="relative z-10 h-[40px] flex items-center overflow-hidden"
        style={{ background: "rgba(200,16,46,0.12)", borderTop: "1px solid rgba(200,16,46,0.3)" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 flex items-center justify-center bg-[var(--ikf-red)] font-display tracking-widest text-sm text-white">
          {t('live_uc', settings.language)}
        </div>
        <div className="overflow-hidden flex-1 ml-24">
          <div ref={tickerContentRef} className="flex whitespace-nowrap will-change-transform">
            {[tickerText, tickerText].map((txt, i) => (
              <span key={i} className="font-semibold text-sm text-[rgba(255,255,255,0.75)] pr-16">{txt}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESULT OVERLAY ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {latestCard && (
          <motion.div
            key={sameEventKey(latestCard)}
            initial={{ opacity: 0, scale: 0.78, rotate: latestCard.corner === "RED" ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.15, y: -40 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className={`fixed z-40 pointer-events-none ${latestCard.corner === "BLUE" ? "right-10" : "left-10"} bottom-28`}
          >
            <div className="relative flex items-center gap-5 rounded-2xl border border-white/20 bg-black/80 px-5 py-4 shadow-2xl backdrop-blur">
              <div
                className="w-[72px] h-[104px] rounded-lg border-4 shadow-2xl"
                style={{
                  background: latestCard.type === "red-card" ? "#c8102e" : "#f1c40f",
                  borderColor: "rgba(255,255,255,0.7)",
                  boxShadow: latestCard.type === "red-card"
                    ? "0 0 80px rgba(200,16,46,0.9)"
                    : "0 0 80px rgba(241,196,15,0.85)",
                }}
              />
              <div className={latestCard.corner === "BLUE" ? "text-right" : "text-left"}>
                <div className="font-display text-3xl text-white tracking-[0.16em] uppercase">
                  {latestCard.type === "red-card" ? "RED CARD" : "YELLOW CARD"}
                </div>
                <div className="mt-1 text-lg font-bold tracking-[0.18em] uppercase" style={{ color: latestCard.corner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)" }}>
                  {latestCard.corner} CORNER
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {latestMethod && (
          <motion.div
            key={sameEventKey(latestMethod)}
            initial={{ opacity: 0, y: 80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-40 z-40 pointer-events-none"
          >
            <div
              className="relative overflow-hidden rounded-3xl border px-10 py-6 shadow-2xl backdrop-blur-xl min-w-[520px] text-center"
              style={{
                background: latestMethod.corner === "RED"
                  ? "linear-gradient(90deg, rgba(200,16,46,0.94), rgba(0,0,0,0.9))"
                  : latestMethod.corner === "BLUE"
                    ? "linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,102,204,0.94))"
                    : "linear-gradient(90deg, rgba(212,160,23,0.96), rgba(0,0,0,0.9), rgba(212,160,23,0.96))",
                borderColor: latestMethod.corner === "RED" ? "rgba(200,16,46,0.95)" : latestMethod.corner === "BLUE" ? "rgba(0,102,204,0.95)" : "rgba(212,160,23,0.95)",
                boxShadow: latestMethod.corner === "RED" ? "0 0 70px rgba(200,16,46,0.72)" : latestMethod.corner === "BLUE" ? "0 0 70px rgba(0,102,204,0.72)" : "0 0 70px rgba(212,160,23,0.72)",
              }}
            >
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-110%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
              <div className="relative z-10">
                <div className="text-xs font-black uppercase tracking-[0.42em] text-white/70">Live referee method</div>
                <div className="mt-2 font-display text-5xl text-white uppercase tracking-[0.16em]">
                  {methodLabel(latestMethod.type)}
                </div>
                <div className="mt-2 text-xl font-black uppercase tracking-[0.22em]" style={{ color: latestMethod.corner === "RED" ? "#ffd4dc" : latestMethod.corner === "BLUE" ? "#cfe5ff" : "#111" }}>
                  {latestMethod.corner ? `${latestMethod.corner} corner` : "Draw call"}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResult && matchWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.5 } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "#000" }}
          >
            {/* Colored background flash */}
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0"
              style={{ background: winnerColor }}
            />

            {/* Light beams */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 left-1/2 opacity-10"
                  style={{
                    width: "3px",
                    height: "130%",
                    background: `linear-gradient(to top, ${winnerParticleColor}, transparent)`,
                    transform: `translateX(-50%) rotate(${(i - 8) * 11.25}deg)`,
                    transformOrigin: "bottom center",
                    animation: `pulse-live ${1 + i * 0.07}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>

            {/* Corner color bars */}
            <motion.div
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5 }}
              className="absolute top-0 left-0 right-0 h-4"
              style={{ background: winnerColor, originX: 0.5 }}
            />
            <motion.div
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5 }}
              className="absolute bottom-0 left-0 right-0 h-4"
              style={{ background: winnerColor, originX: 0.5 }}
            />

            {/* Particles */}
            <Particles color={winnerParticleColor} />

            {/* Text content */}
            <div className="relative z-10 text-center px-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
                className="font-display text-white tracking-[0.3em]"
                style={{ fontSize: "clamp(80px, 10vw, 160px)", textShadow: "0 0 60px rgba(255,255,255,0.3)" }}
              >
                {t('winner', settings.language)}
              </motion.div>

              <motion.div
                initial={{ y: -120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 120, damping: 14 }}
                className="font-display leading-none"
                style={{
                  fontSize: "clamp(64px, 9vw, 150px)",
                  color: "var(--ikf-gold)",
                  textShadow: "0 0 80px rgba(212,160,23,0.8)",
                }}
              >
                {winnerName}
              </motion.div>

              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="font-display text-4xl text-[rgba(255,255,255,0.6)] mt-8 tracking-widest uppercase"
              >
                {displayMatch?.result?.method} — {displayMatch?.result?.redTotalScore} — {displayMatch?.result?.blueTotalScore}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for particle-fall keyframe */}
      <style jsx global>{`
        @keyframes particle-fall {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(110vh) scale(0.4) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
