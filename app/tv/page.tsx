/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useTournamentStore, useLiveAggregateScore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";

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
  const particles = Array.from({ length: 40 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full opacity-80"
          style={{
            backgroundColor: color,
            left: `${Math.random() * 100}%`,
            top: "-10px",
            boxShadow: `0 0 6px ${color}`,
            animation: `particle-fall ${1.5 + Math.random() * 3}s ease-in ${Math.random() * 2}s forwards`,
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
  warnings?: number;
}

function CornerCard({ side, name, club, country, score, warnings = 0 }: CornerCardProps) {
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
          {isRed ? "🔴" : "🔵"} {side === 'RED' ? t('red_corner', settings?.language || 'en').toUpperCase() : t('blue_corner', settings?.language || 'en').toUpperCase()}
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
          {club} · {country}
        </p>

        {/* Score */}
        <div
          className="font-display leading-none"
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

        {/* Warning cards */}
        {warnings > 0 && (
          <div className={`flex gap-2 mt-4 ${isRed ? "" : "flex-row-reverse"}`}>
            {Array.from({ length: warnings }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-7 rounded-sm"
                style={{ background: "#f1c40f", boxShadow: "0 0 10px rgba(241,196,15,0.6)" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main TV Display ──────────────────────────────────────────────────────────
export default function TVDisplay() {
  const { 
    activeMatch, currentRound, roundTimer, timerMode, roundEvents, settings, referees, judgeScores 
  } = useTournamentStore();

  const [now, setNow] = useState(new Date());
  const [showResult, setShowResult] = useState(false);
  const tickerContentRef = useRef<HTMLDivElement>(null);

  const { red: aggRed, blue: aggBlue } = useLiveAggregateScore();

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Trigger result when match is completed
  useEffect(() => {
    if (activeMatch?.status === "completed") {
      setShowResult(true);
      const timer = setTimeout(() => setShowResult(false), 15000);
      return () => clearTimeout(timer);
    } else {
      setShowResult(false);
    }
  }, [activeMatch?.status]);

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
  }, [roundEvents]);

  // Derived data
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  
  const maxTime = activeMatch ? (settings.roundDurations[activeMatch.ageGroup] ?? 180) : 180;
  const maxRounds = activeMatch?.totalRounds ?? 3;
  const circumference = 2 * Math.PI * 80;
  const progress = maxTime > 0 ? (roundTimer / maxTime) : 1;
  const dashOffset = circumference * (1 - progress);

  let timerStatus = timerMode.toUpperCase();
  if (timerMode === "round") timerStatus = t('running_uc', settings.language);
  if (timerMode === "idle" && roundTimer < maxTime) timerStatus = t('paused_uc', settings.language);
  if (timerMode === "passivity") timerStatus = t('wosk_uc', settings.language);

  const matchWinner = activeMatch?.result?.winnerCorner || null;
  const winnerName = matchWinner === "RED"
    ? (activeMatch?.redCornerName ?? t('red_corner', settings.language).toUpperCase())
    : (activeMatch?.blueCornerName ?? t('blue_corner', settings.language).toUpperCase());
  const winnerColor = matchWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)";
  const winnerParticleColor = matchWinner === "RED" ? "#c8102e" : "#0066cc";

  // Build ticker text from recent events
  const tickerEvents = useMemo(() => {
    const recent = [...roundEvents].reverse().slice(0, 10);
    if (recent.length === 0) return [t('waiting_for_events', settings.language), t('stay_tuned', settings.language)];
    return recent.map(e => {
      let prefix = "⚡ ";
      if (e.type === "yellow-card") prefix = "🟨 ";
      if (e.type === "red-card") prefix = "🟥 ";
      if (e.type === "doctor") prefix = "⚕️ ";
      if (e.type === "round-start") prefix = "⏱️ ";
      if (e.type === "match-end") prefix = "🏆 ";
      return `${prefix} ${e.corner ? `${e.corner === 'RED' ? t('red_corner', settings.language) : t('blue_corner', settings.language)} - ` : ""}${e.details}`;
    });
  }, [roundEvents, settings.language]);

  const tickerText = tickerEvents.join("   ·   ");

  const redWarnings = roundEvents.filter(e => e.corner === "RED" && e.type === "yellow-card").length;
  const blueWarnings = roundEvents.filter(e => e.corner === "BLUE" && e.type === "yellow-card").length;

  const assignedJudges = activeMatch?.assignedJudgeIds?.map(id => referees.find(r => r.id === id)).filter(Boolean) || [];

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
        <div className="font-display text-2xl text-white tracking-[0.2em]">IKF KENSHIDO</div>
        <div
          className="font-display text-3xl tracking-[0.3em] text-center"
          style={{ color: "var(--ikf-gold)" }}
        >
          {t('world_championship', settings.language)}
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl text-white font-bold">{format(now, "HH:mm:ss")}</div>
          <div className="text-sm font-bold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mt-1">
            {format(now, "d MMMM yyyy")} · {t('mat_uc', settings.language)} {activeMatch?.matNumber ? String(activeMatch.matNumber).padStart(2, '0') : "01"}
          </div>
        </div>
      </div>

      {/* ── MAIN FIGHT DISPLAY ──────────────────────────────────────────── */}
      <div className="flex-1 relative z-10 flex items-center">

        {/* RED CORNER */}
        <CornerCard
          side="RED"
          name={activeMatch?.redCornerName ?? "RED CORNER"}
          club=""
          country=""
          score={aggRed}
          warnings={redWarnings}
        />

        {/* CENTER: Timer + VS */}
        <div className="flex flex-col items-center justify-center w-[320px] flex-shrink-0 relative">
          {/* Round label */}
          <div
            className="font-display text-xl tracking-widest mb-4"
            style={{ color: "var(--ikf-gold)" }}
          >
            {t('round', settings.language).toUpperCase()} {currentRound} / {maxRounds}
          </div>

          {/* SVG circular ring + timer */}
          <div className="relative w-[220px] h-[220px] flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="110" cy="110" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="110" cy="110" r="80"
                fill="none"
                stroke={timerMode === "rest" ? "var(--ikf-gold)" : "var(--ikf-red)"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="relative z-10 text-center">
              <div
                className="font-display leading-none text-white"
                style={{ fontSize: "clamp(56px, 6vw, 88px)", textShadow: "0 0 40px rgba(255,255,255,0.2)" }}
              >
                {formatTime(roundTimer)}
              </div>
              <div
                className="text-xs font-bold tracking-[0.25em] uppercase mt-1"
                style={{ color: timerStatus === "RUNNING" ? "var(--status-win)" : "rgba(255,255,255,0.3)" }}
              >
                {timerStatus}
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
          name={activeMatch?.blueCornerName ?? "BLUE CORNER"}
          club=""
          country=""
          score={aggBlue}
          warnings={blueWarnings}
        />
      </div>

      {/* ── JUDGE SCORE PANEL ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-stretch border-t border-[rgba(255,255,255,0.06)] h-[90px]">
        {/* Individual judge scores */}
        {assignedJudges.map((judge, i) => {
          if (!judge) return null;
          const scoreEntry = judgeScores.find(s => s.matchId === activeMatch?.id && s.round === currentRound && s.judgeId === judge.id);
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
              className="font-display text-4xl"
              style={{
                color: "var(--ikf-red)",
                textShadow: aggRed > aggBlue ? "0 0 20px rgba(200,16,46,0.6)" : undefined,
              }}
            >
              {aggRed}
            </span>
            <span className="text-[rgba(255,255,255,0.3)] font-bold text-xl">–</span>
            <span
              className="font-display text-4xl"
              style={{
                color: "var(--corner-blue)",
                textShadow: aggBlue > aggRed ? "0 0 20px rgba(0,102,204,0.6)" : undefined,
              }}
            >
              {aggBlue}
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
                {activeMatch?.result?.method} — {activeMatch?.result?.redTotalScore} — {activeMatch?.result?.blueTotalScore}
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

