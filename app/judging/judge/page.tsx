/* eslint-disable */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ShieldAlert, Swords, Trophy, Minus, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { useTournamentStore } from "@/store/tournamentStore";
import { IKFBadge } from "@/components/ui";
import { t } from "@/lib/i18n";
import { formatMatchCategory, isYouthAgeGroup } from "@/lib/ageCategories";
import { deriveLiveMatchTimers, FirebaseMatchState, useFirebaseMatchState } from "@/hooks/useFirebaseMatchSync";
import { saveJudgeScoreToDatabase, saveJudgingEventToDatabase, StoredJudgingEvent, useFirebaseJudgingData } from "@/hooks/useFirebaseJudgingSync";
import { getStoredRoleSession } from "@/components/auth/AuthGate";

type MethodEventType = "decision" | "ko-tko" | "ippon-result" | "disqualification" | "draw";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function MethodButton({
  label,
  corner,
  disabled,
  active,
  onClick,
}: {
  label: string;
  corner?: "RED" | "BLUE";
  disabled: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const color = corner === "RED" ? "var(--ikf-red)" : corner === "BLUE" ? "var(--corner-blue)" : "var(--ikf-gold)";
  const bg = corner === "RED" ? "rgba(200,16,46,0.08)" : corner === "BLUE" ? "rgba(0,102,204,0.08)" : "rgba(212,160,23,0.1)";
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      animate={active ? { scale: [1, 1.06, 1], boxShadow: [`0 0 0 ${color}`, `0 0 24px ${color}`, `0 0 0 ${color}`] } : { scale: 1 }}
      transition={{ duration: 0.45 }}
      className="relative h-10 rounded-lg border text-[10px] font-black uppercase tracking-widest disabled:opacity-35 disabled:cursor-not-allowed overflow-hidden"
      style={{ color, borderColor: active ? color : corner === "BLUE" ? "rgba(0,102,204,0.35)" : corner === "RED" ? "rgba(200,16,46,0.35)" : "rgba(212,160,23,0.45)", background: active ? "rgba(255,255,255,0.12)" : bg }}
    >
      {active && <motion.span className="absolute inset-0 bg-white/20" initial={{ x: "-100%" }} animate={{ x: "120%" }} transition={{ duration: 0.55 }} />}
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

function ScoreButton({
  label, sublabel, onClick, disabled, active, color = "red", size = "lg"
}: {
  label: string; sublabel?: string; onClick: () => void; disabled: boolean;
  active?: boolean; color?: "red" | "blue" | "gold" | "green"; size?: "lg" | "sm";
}) {
  const colorMap = {
    red:   { bg: "rgba(200,16,46,0.12)",   border: "var(--ikf-red)",    activeBg: "var(--ikf-red)",    text: "var(--ikf-red)",    shadow: "rgba(200,16,46,0.5)" },
    blue:  { bg: "rgba(0,102,204,0.12)",   border: "var(--corner-blue)", activeBg: "var(--corner-blue)", text: "var(--corner-blue)", shadow: "rgba(0,102,204,0.5)" },
    gold:  { bg: "rgba(212,160,23,0.12)",  border: "var(--ikf-gold)",   activeBg: "var(--ikf-gold)",   text: "var(--ikf-gold)",   shadow: "rgba(212,160,23,0.5)" },
    green: { bg: "rgba(46,204,113,0.12)",  border: "var(--status-win)", activeBg: "var(--status-win)", text: "var(--status-win)", shadow: "rgba(46,204,113,0.5)" },
  };
  const c = colorMap[color];
  const h = size === "lg" ? "h-24" : "h-16";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${h} rounded-2xl font-display tracking-wider transition-all border-2 flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed`}
      style={{
        background: active ? c.activeBg : c.bg,
        borderColor: c.border,
        color: active ? "#fff" : c.text,
        boxShadow: active ? `0 0 24px ${c.shadow}` : "none",
      }}
    >
      <span className={size === "lg" ? "text-2xl" : "text-base"}>{label}</span>
      {sublabel && <span className="text-[10px] font-bold tracking-widest opacity-70">{sublabel}</span>}
    </button>
  );
}

export default function JudgeTabletView() {
  const { 
    matches, currentRound, roundTimer, timerMode, roundEvents,
    judgeScores, setJudgeScore, submitJudgeScore, referees, settings, addRoundEvent, addReferee
  } = useTournamentStore();

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [methodFeedback, setMethodFeedback] = useState<{
    id: string;
    label: string;
    corner?: "RED" | "BLUE";
    officialName: string;
    type: MethodEventType;
  } | null>(null);
  const [fallbackAnchor, setFallbackAnchor] = useState({ mode: "idle", source: 0, startedAt: Date.now() });
  const [session, setSession] = useState<ReturnType<typeof getStoredRoleSession>>(null);
  const [profileName, setProfileName] = useState("");
  const [profileCountry, setProfileCountry] = useState("");

  useEffect(() => {
    setSession(getStoredRoleSession());
  }, []);

  const isRefereeSession = session?.role === "central-referee" || session?.role === "corner-referee";
  const lockedRefereeId = isRefereeSession ? session?.refereeId ?? "__unlinked_referee__" : undefined;

  const selectableMatches = useMemo(() => matches
    .filter(match =>
      match.status !== "completed" &&
      !match.isBye &&
      Boolean(match.redCornerId) &&
      Boolean(match.blueCornerId) &&
      Boolean(match.assignedRefereeId) &&
      (match.assignedJudgeIds?.length ?? 0) > 0 &&
      (!lockedRefereeId || match.assignedRefereeId === lockedRefereeId || match.assignedJudgeIds?.includes(lockedRefereeId))
    )
    .sort((a, b) => a.matchNumber - b.matchNumber),
  [lockedRefereeId, matches]);

  const activeMatch = useMemo(
    () => matches.find(match => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  const assignedOfficials = useMemo(() => {
    if (!activeMatch) return [];
    const ids = [activeMatch.assignedRefereeId, ...(activeMatch.assignedJudgeIds ?? [])].filter(Boolean) as string[];
    const officials = ids.map(id => referees.find(referee => referee.id === id)).filter(Boolean);
    return lockedRefereeId ? officials.filter(official => official!.id === lockedRefereeId) : officials;
  }, [activeMatch, lockedRefereeId, referees]);

  // Firebase sync for timer (cross-device)
  const [fbState, setFbState] = useState<FirebaseMatchState | null>(null);
  const [databaseEvents, setDatabaseEvents] = useState<StoredJudgingEvent[]>([]);
  const [timerTick, setTimerTick] = useState(0);
  useFirebaseMatchState((state) => {
    if (selectedMatchId && state.matchId === selectedMatchId) {
      setFbState(state);
    }
  });
  const rawLiveMode = fbState?.timerMode ?? timerMode;
  const fallbackSourceTimer = rawLiveMode === "rest" ? (fbState?.restTimer ?? 60) : rawLiveMode === "passivity" ? (fbState?.woskTimeLeft ?? 10) : (fbState?.roundTimer ?? roundTimer);
  const forceRunningFromIdle = rawLiveMode === "idle"
    && activeMatch?.status === "in-progress"
    && fallbackSourceTimer > 0
    && fallbackSourceTimer < (fbState?.maxTime ?? activeMatch.roundDurationSeconds ?? roundTimer);
  const liveMode = forceRunningFromIdle ? "round" : rawLiveMode;
  const derivedTimers = useMemo(() => deriveLiveMatchTimers(fbState), [fbState, timerTick]);
  useEffect(() => {
    setFallbackAnchor({ mode: liveMode, source: fallbackSourceTimer, startedAt: Date.now() });
  }, [fallbackSourceTimer, liveMode, selectedMatchId]);
  const fallbackDerivedTimer = useMemo(() => {
    const elapsed = ["round", "rest", "passivity"].includes(fallbackAnchor.mode)
      ? Math.floor((Date.now() - fallbackAnchor.startedAt) / 1000)
      : 0;
    return Math.max(0, fallbackAnchor.source - elapsed);
  }, [fallbackAnchor, timerTick]);
  const liveTimer = liveMode === "rest"
    ? (forceRunningFromIdle ? fallbackDerivedTimer : derivedTimers?.restTimer ?? fallbackDerivedTimer)
    : liveMode === "passivity"
      ? (forceRunningFromIdle ? fallbackDerivedTimer : derivedTimers?.woskTimeLeft ?? fallbackDerivedTimer)
      : (forceRunningFromIdle ? fallbackDerivedTimer : derivedTimers?.roundTimer ?? fallbackDerivedTimer);
  const liveRound = fbState?.currentRound ?? currentRound;

  useEffect(() => {
    setSelectedJudgeId("");
    setFbState(null);
    setDatabaseEvents([]);
  }, [selectedMatchId]);

  useEffect(() => {
    if (assignedOfficials.length === 1) {
      setSelectedJudgeId(assignedOfficials[0]!.id);
    } else if (lockedRefereeId) {
      setSelectedJudgeId("");
    }
  }, [assignedOfficials, lockedRefereeId]);

  useEffect(() => {
    const id = window.setInterval(() => setTimerTick(tick => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useFirebaseJudgingData(selectedMatchId || null, ({ scores, events }) => {
    scores.forEach(score => setJudgeScore(score));
    setDatabaseEvents(events);
  });

  const pendingSelfProfile = isRefereeSession
    ? referees.find(referee => referee.accountId === session?.accountId)
    : null;

  const submitRefereeProfile = () => {
    if (!session || !isRefereeSession) return;
    const name = profileName.trim();
    if (name.length < 2) {
      toast.error("Enter your referee name before submitting.");
      return;
    }
    addReferee({
      id: uuidv4(),
      name,
      role: session.role === "corner-referee" ? "Corner Judge" : "Central Referee",
      country: profileCountry.trim() || "Pending country",
      grade: "Submitted Official",
      status: "Available",
      approvalStatus: "Pending",
      accountId: session.accountId,
    });
    setProfileName("");
    setProfileCountry("");
    toast.success("Referee profile submitted. The chief admin must approve it before judging access is active.");
  };

  if (isRefereeSession && !session?.refereeId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "linear-gradient(135deg, #050508 0%, #0a0015 100%)" }}>
        <div className="w-full max-w-2xl rounded-3xl border border-[rgba(212,160,23,0.3)] bg-[rgba(255,255,255,0.04)] p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-[rgba(212,160,23,0.1)] border border-[rgba(212,160,23,0.3)] flex items-center justify-center">
              <ShieldAlert size={30} className="text-[var(--ikf-gold)]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--ikf-gold)] mb-1">Referee Access</div>
              <h1 className="font-display text-4xl text-white">Submit Your Official Profile</h1>
            </div>
          </div>

          {pendingSelfProfile ? (
            <div className="rounded-2xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.08)] p-5">
              <div className="text-sm font-bold text-white">{pendingSelfProfile.name}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-widest text-[var(--ikf-gold)]">
                Status: {pendingSelfProfile.approvalStatus ?? "Pending"}
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Waiting for the chief admin to approve this referee profile. After approval, sign in again and your assigned match profile will be locked to this account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Full Name</span>
                <input value={profileName} onChange={event => setProfileName(event.target.value)} className="w-full rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/25 px-5 py-4 text-white outline-none focus:border-[var(--ikf-gold)]" placeholder="Official referee name" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Country</span>
                <input value={profileCountry} onChange={event => setProfileCountry(event.target.value)} className="w-full rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/25 px-5 py-4 text-white outline-none focus:border-[var(--ikf-gold)]" placeholder="Country" />
              </label>
              <button type="button" onClick={submitRefereeProfile} className="h-14 w-full rounded-2xl bg-[var(--ikf-gold)] text-black font-black uppercase tracking-widest">
                Submit For Chief Admin Approval
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeMatch) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "linear-gradient(135deg, #050508 0%, #0a0015 100%)" }}>
        <div className="w-full max-w-3xl rounded-3xl border border-[rgba(212,160,23,0.3)] bg-[rgba(255,255,255,0.04)] p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-[rgba(212,160,23,0.1)] border border-[rgba(212,160,23,0.3)] flex items-center justify-center">
              <ClipboardList size={30} className="text-[var(--ikf-gold)]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--ikf-gold)] mb-1">Electronic Judging</div>
              <h1 className="font-display text-4xl text-white">Select Match First</h1>
            </div>
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Match</label>
          <select
            value={selectedMatchId}
            onChange={event => setSelectedMatchId(event.target.value)}
            className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] rounded-2xl px-5 py-4 text-white text-base font-bold outline-none focus:border-[var(--ikf-gold)]"
          >
            <option value="">Choose assigned match...</option>
            {selectableMatches.map(match => (
              <option key={match.id} value={match.id}>
                Match #{match.matchNumber} - {formatMatchCategory(match.ageGroup, match.weightCategory, match.gender)} - {match.redCornerName} vs {match.blueCornerName}
              </option>
            ))}
          </select>

          {selectableMatches.length === 0 && (
            <div className="mt-6 rounded-2xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.08)] p-4 flex items-center gap-3 text-[var(--ikf-red)]">
              <AlertCircle size={18} />
              <span className="text-sm font-bold">No assigned matches found. Assign officials in Referee Management first.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const judge = referees.find(r => r.id === selectedJudgeId);
  const isChildren = isYouthAgeGroup(activeMatch.ageGroup);

  const currentScore = judgeScores.find(s => s.matchId === activeMatch.id && s.round === liveRound && s.judgeId === selectedJudgeId) 
    || { redScore: 0, blueScore: 0, submitted: false };

  const handleSetScore = (red: number, blue: number) => {
    if (currentScore.submitted || !judge) return;
    const score = {
      matchId: activeMatch.id,
      judgeId: judge.id,
      judgeName: judge.name,
      round: liveRound,
      redScore: red,
      blueScore: blue,
      submitted: false,
    };
    setJudgeScore(score);
    saveJudgeScoreToDatabase(score);
  };

  const handleWinRound = (winner: "RED" | "BLUE") => {
    if (winner === "RED") handleSetScore(10, 9);
    else handleSetScore(9, 10);
  };

  const handleDeduction = (points: number, corner: "RED" | "BLUE") => {
    const currentRed = currentScore.redScore || 10;
    const currentBlue = currentScore.blueScore || 10;
    if (corner === "RED") handleSetScore(Math.max(0, currentRed - points), currentBlue);
    else handleSetScore(currentRed, Math.max(0, currentBlue - points));
    recordJudgingEvent("deduction", corner, `${points} point deduction`);
  };

  const handleSpecial = (type: "IPPON" | "WAZA_ARI" | "YUKO", corner: "RED" | "BLUE") => {
    const pts = type === "IPPON" ? 10 : type === "WAZA_ARI" ? 2 : 1;
    const currentRed = currentScore.redScore || 10;
    const currentBlue = currentScore.blueScore || 10;
    if (corner === "RED") handleSetScore(currentRed + pts, currentBlue);
    else handleSetScore(currentRed, currentBlue + pts);
    recordJudgingEvent(type === "IPPON" ? "ippon" : type === "WAZA_ARI" ? "waza-ari" : "yuko", corner, type.replace("_", " "));
  };

  const handleDraw = () => handleSetScore(10, 10);

  const recordJudgingEvent = (
    type: "yellow-card" | "red-card" | "deduction" | "ippon" | "waza-ari" | "yuko" | "decision" | "ko-tko" | "ippon-result" | "disqualification" | "draw",
    corner: "RED" | "BLUE" | undefined,
    label: string,
  ) => {
    if (!judge) return;
    const details = `Match #${activeMatch.matchNumber} - ${label}${corner ? ` for ${corner} corner` : ""} by ${judge.name}`;
    addRoundEvent({ type, corner, details });
    saveJudgingEventToDatabase({
      matchId: activeMatch.id,
      type,
      corner,
      details,
      officialId: judge.id,
      officialName: judge.name,
    });
  };

  const recordMatchDecision = (
    type: MethodEventType,
    corner: "RED" | "BLUE" | undefined,
    label: string,
  ) => {
    if (!judge) return;
    const winnerName = corner === "RED" ? activeMatch.redCornerName : corner === "BLUE" ? activeMatch.blueCornerName : "No winner";
    recordJudgingEvent(type, corner, type === "draw" ? "DRAW declared" : `${winnerName} - ${label}`);
    const id = `${type}-${corner ?? "DRAW"}-${Date.now()}`;
    setMethodFeedback({ id, label, corner, officialName: judge.name, type });
    window.setTimeout(() => {
      setMethodFeedback(current => current?.id === id ? null : current);
    }, 2200);
  };

  const attemptSubmit = () => {
    if (currentScore.redScore === 0 && currentScore.blueScore === 0) return;
    setShowConfirm(true);
  };

  const confirmSubmit = () => {
    if (judge) {
      saveJudgeScoreToDatabase({
        matchId: activeMatch.id,
        judgeId: judge.id,
        judgeName: judge.name,
        round: liveRound,
        redScore: currentScore.redScore,
        blueScore: currentScore.blueScore,
        submitted: true,
      });
      submitJudgeScore(judge.id, liveRound, currentScore.redScore, currentScore.blueScore, activeMatch.id, judge.name);
    }
    setShowConfirm(false);
  };

  const getCornerTotal = (corner: "RED" | "BLUE") => {
    return judgeScores
      .filter(s => s.matchId === activeMatch.id && s.judgeId === selectedJudgeId && s.submitted)
      .reduce((acc, s) => acc + (corner === "RED" ? s.redScore : s.blueScore), 0);
  };

  const isRedWinner  = currentScore.redScore  > currentScore.blueScore;
  const isBlueWinner = currentScore.blueScore > currentScore.redScore;
  const isDraw       = currentScore.redScore === currentScore.blueScore && currentScore.redScore > 0;

  const timerColor = liveMode === "round" ? "#2ecc71" : liveMode === "rest" ? "var(--ikf-gold)" : liveMode === "passivity" ? "#f1c40f" : "rgba(255,255,255,0.3)";
  const visibleEvents = Array.from(new Map([
    ...roundEvents.filter(event => event.details?.toLowerCase().includes(`match #${activeMatch.matchNumber}`)),
    ...databaseEvents.filter(event => event.matchId === activeMatch.id),
  ].map((event: any) => [`${event.id}-${event.type}-${event.corner}-${event.details}`, event])).values());
  const countCards = (corner: "RED" | "BLUE", type: "yellow-card" | "red-card") =>
    visibleEvents.filter(event => event.corner === corner && event.type === type).length;
  const redYellowCards = countCards("RED", "yellow-card");
  const redRedCards = countCards("RED", "red-card");
  const blueYellowCards = countCards("BLUE", "yellow-card");
  const blueRedCards = countCards("BLUE", "red-card");
  const isActiveMethod = (type: string, corner?: "RED" | "BLUE") => methodFeedback?.type === type && methodFeedback?.corner === corner;

  return (
    <div className="flex flex-col h-screen text-white select-none overflow-hidden"
      style={{ background: "linear-gradient(160deg, #08020c 0%, #05080f 50%, #020508 100%)" }}>

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.07)]"
        style={{ background: "linear-gradient(90deg, rgba(200,16,46,0.08) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,102,204,0.08) 100%)" }}>
        
        {/* Judge selector */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(212,160,23,0.15)] border border-[rgba(212,160,23,0.4)] flex items-center justify-center">
            <span className="text-[var(--ikf-gold)] text-xs font-bold">J</span>
          </div>
          <select 
            value={selectedJudgeId}
            onChange={e => setSelectedJudgeId(e.target.value)}
            className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-2.5 text-sm font-bold text-white tracking-wider outline-none focus:border-[var(--ikf-gold)] transition-colors min-w-[220px]"
          >
            <option value="" disabled>{t('select_judge_profile', settings.language)}</option>
            {assignedOfficials.map(official => (
              <option key={official!.id} value={official!.id}>{official!.name} - {official!.role}</option>
            ))}
          </select>
        </div>

        {/* Match info center */}
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--ikf-gold)] mb-0.5">Electronic Judging · IKF Kenshido</div>
          <div className="text-base font-display tracking-widest text-white">
            Match #{activeMatch.matchNumber} · {formatMatchCategory(activeMatch.ageGroup, activeMatch.weightCategory, activeMatch.gender)}
          </div>
        </div>

        {/* Live timer */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: timerColor }}>
              Round {liveRound} / {activeMatch.totalRounds}
            </div>
            <div className="font-mono text-2xl font-bold transition-all" style={{ color: timerColor }}>
              {formatTime(liveTimer)}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${liveMode === "round" ? "bg-green-400 animate-pulse" : "bg-[rgba(255,255,255,0.2)]"}`} />
        </div>
      </div>

      {!judge && (
        <div className="bg-[rgba(212,160,23,0.1)] border-b border-[rgba(212,160,23,0.3)] px-6 py-2.5 text-center text-[var(--ikf-gold)] text-xs font-bold uppercase tracking-widest">
          ⚠ Select your judge profile to enable scoring
        </div>
      )}

      {/* ── MAIN SCORING AREA ── */}
      <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.06)] bg-black/25">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Decision", "decision"],
              ["KO / TKO", "ko-tko"],
              ["Ippon (Kids)", "ippon-result"],
              ["Disqualification", "disqualification"],
            ].map(([label, type]) => (
              <MethodButton
                key={`red-${type}`}
                label={label}
                corner="RED"
                disabled={!judge}
                onClick={() => recordMatchDecision(type as any, "RED", label)}
                active={isActiveMethod(type, "RED")}
              />
            ))}
          </div>
          <MethodButton
            label="DRAW"
            disabled={!judge}
            onClick={() => recordMatchDecision("draw", undefined, "DRAW")}
            active={isActiveMethod("draw")}
          />
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Decision", "decision"],
              ["KO / TKO", "ko-tko"],
              ["Ippon (Kids)", "ippon-result"],
              ["Disqualification", "disqualification"],
            ].map(([label, type]) => (
              <MethodButton
                key={`blue-${type}`}
                label={label}
                corner="BLUE"
                disabled={!judge}
                onClick={() => recordMatchDecision(type as any, "BLUE", label)}
                active={isActiveMethod(type, "BLUE")}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {methodFeedback && (
          <motion.div
            key={methodFeedback.id}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="mx-4 mt-2 rounded-2xl border px-4 py-3 flex items-center justify-between shadow-2xl"
            style={{
              borderColor: methodFeedback.corner === "RED" ? "rgba(200,16,46,0.7)" : methodFeedback.corner === "BLUE" ? "rgba(0,102,204,0.7)" : "rgba(212,160,23,0.75)",
              background: methodFeedback.corner === "RED" ? "rgba(200,16,46,0.16)" : methodFeedback.corner === "BLUE" ? "rgba(0,102,204,0.16)" : "rgba(212,160,23,0.16)",
            }}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--ikf-gold)]">Saved live method decision</div>
              <div className="mt-1 text-sm font-bold text-white">
                {methodFeedback.label} {methodFeedback.corner ? `for ${methodFeedback.corner} corner` : ""} by {methodFeedback.officialName}
              </div>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              className="w-8 h-8 rounded-full bg-[var(--status-win)] text-black flex items-center justify-center font-black"
            >
              OK
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex gap-3 p-3 overflow-hidden">

        {/* RED CORNER PANEL */}
        <div className="flex-1 rounded-3xl flex flex-col overflow-hidden relative"
          style={{ 
            background: "linear-gradient(180deg, rgba(200,16,46,0.14) 0%, rgba(200,16,46,0.04) 100%)",
            border: "1.5px solid rgba(200,16,46,0.3)",
            boxShadow: isRedWinner ? "0 0 40px rgba(200,16,46,0.2)" : "none"
          }}>

          {/* Red header */}
          <div className="p-6 border-b border-[rgba(200,16,46,0.2)]"
            style={{ background: "linear-gradient(180deg, rgba(200,16,46,0.15) 0%, transparent 100%)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-[var(--ikf-red)] border border-[rgba(200,16,46,0.4)] px-2 py-0.5 rounded bg-[rgba(200,16,46,0.1)]">🔴 RED CORNER</span>
              {isRedWinner && <span className="text-[10px] font-black tracking-widest text-[var(--ikf-gold)]">▲ LEADING</span>}
            </div>
            <h2 className="font-display text-4xl text-white leading-tight mt-2">{activeMatch.redCornerName}</h2>
            <div className="flex items-center gap-2 mt-3">
              <span className="w-5 h-7 rounded-sm bg-[#f1c40f] shadow-[0_0_10px_rgba(241,196,15,0.55)]" />
              <span className="text-xs font-black text-white">{redYellowCards}</span>
              <span className="w-5 h-7 rounded-sm bg-[var(--ikf-red)] shadow-[0_0_10px_rgba(200,16,46,0.65)] ml-2" />
              <span className="text-xs font-black text-white">{redRedCards}</span>
            </div>
            <div className="flex items-end gap-6 mt-4">
              <div>
                <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Round {liveRound}</div>
                <div className="font-display text-[80px] leading-none" style={{ color: isRedWinner ? "var(--ikf-red)" : "rgba(255,255,255,0.85)", textShadow: isRedWinner ? "0 0 20px rgba(200,16,46,0.5)" : "none" }}>
                  {currentScore.redScore || "—"}
                </div>
              </div>
              <div className="pb-3">
                <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total</div>
                <div className="font-display text-5xl text-[var(--text-secondary)]">{getCornerTotal("RED")}</div>
              </div>
            </div>
          </div>

          {/* Red action buttons */}
          <div className="flex-1 p-5 flex flex-col gap-3">
            <ScoreButton
              label={t('red_wins_round_10', settings.language)}
              sublabel="10 — 9"
              onClick={() => handleWinRound("RED")}
              disabled={currentScore.submitted || !judge}
              active={isRedWinner}
              color="red"
            />

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="col-span-2 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center border-t border-[rgba(255,255,255,0.06)] pt-3">
                Deductions
              </div>
              <ScoreButton label={t('knockdown_1', settings.language)} sublabel="-1 pt" onClick={() => handleDeduction(1, "RED")} disabled={currentScore.submitted || !judge} color="red" size="sm" />
              <ScoreButton label={t('double_kd_2', settings.language)} sublabel="-2 pts" onClick={() => handleDeduction(2, "RED")} disabled={currentScore.submitted || !judge} color="red" size="sm" />
              <ScoreButton label="Yellow Card" sublabel="warning" onClick={() => recordJudgingEvent("yellow-card", "RED", "yellow card")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
              <ScoreButton label="Red Card" sublabel="serious" onClick={() => recordJudgingEvent("red-card", "RED", "red card")} disabled={currentScore.submitted || !judge} color="red" size="sm" />
            </div>

            {isChildren && (
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="col-span-3 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center">Special Results</div>
                <ScoreButton label={t('ippon', settings.language)} sublabel="+10" onClick={() => handleSpecial("IPPON", "RED")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
                <ScoreButton label={t('waza_ari', settings.language)} sublabel="+2" onClick={() => handleSpecial("WAZA_ARI", "RED")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
                <ScoreButton label={t('yuko', settings.language)} sublabel="+1" onClick={() => handleSpecial("YUKO", "RED")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="w-[140px] flex flex-col items-center justify-between py-4 gap-3">
          {/* Draw button */}
          <button
            onClick={handleDraw}
            disabled={currentScore.submitted || !judge}
            className="w-24 h-24 rounded-full font-display text-xl flex items-center justify-center gap-1 flex-col transition-all disabled:opacity-40 border-2"
            style={{
              background: isDraw ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              borderColor: isDraw ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
              boxShadow: isDraw ? "0 0 20px rgba(255,255,255,0.1)" : "none"
            }}
          >
            <Minus size={18} />
            <span className="text-xs">{t('draw', settings.language)}</span>
          </button>

          {/* Round scorecard mini */}
          <div className="flex-1 w-full flex flex-col justify-center gap-2">
            {Array.from({ length: activeMatch.totalRounds }, (_, idx) => idx + 1).map(round => {
              const s = judgeScores.find(x => x.matchId === activeMatch.id && x.round === round && x.judgeId === selectedJudgeId);
              const isCurrentRound = round === liveRound;
              return (
                <div key={round} className={`rounded-xl p-2 text-center border transition-all ${isCurrentRound ? "border-[rgba(212,160,23,0.5)] bg-[rgba(212,160,23,0.05)]" : "border-[rgba(255,255,255,0.06)] bg-transparent"}`}>
                  <div className="text-[9px] font-bold text-[var(--text-muted)] tracking-widest mb-1">R{round}</div>
                  {s?.submitted ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-bold text-xs" style={{ color: s.redScore > s.blueScore ? "var(--ikf-red)" : "rgba(255,255,255,0.5)" }}>{s.redScore}</span>
                      <span className="text-[var(--text-muted)] text-[10px]">-</span>
                      <span className="font-bold text-xs" style={{ color: s.blueScore > s.redScore ? "var(--corner-blue)" : "rgba(255,255,255,0.5)" }}>{s.blueScore}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--text-muted)]">—</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit button */}
          <button
            onClick={attemptSubmit}
            disabled={currentScore.submitted || (currentScore.redScore === 0 && currentScore.blueScore === 0) || !judge}
            className="w-full py-4 rounded-2xl font-display text-sm tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed border-2 flex flex-col items-center gap-1"
            style={{
              background: currentScore.submitted ? "rgba(46,204,113,0.15)" : "rgba(46,204,113,0.2)",
              borderColor: currentScore.submitted ? "var(--status-win)" : "var(--status-win)",
              color: "var(--status-win)",
              boxShadow: currentScore.submitted ? "none" : "0 0 20px rgba(46,204,113,0.2)"
            }}
          >
            {currentScore.submitted ? (
              <><CheckCircle2 size={20} /><span className="text-[10px]">SUBMITTED</span></>
            ) : (
              <><Trophy size={18} /><span className="text-[10px]">SUBMIT</span></>
            )}
          </button>
        </div>

        {/* BLUE CORNER PANEL */}
        <div className="flex-1 rounded-3xl flex flex-col overflow-hidden relative"
          style={{
            background: "linear-gradient(180deg, rgba(0,102,204,0.14) 0%, rgba(0,102,204,0.04) 100%)",
            border: "1.5px solid rgba(0,102,204,0.3)",
            boxShadow: isBlueWinner ? "0 0 40px rgba(0,102,204,0.2)" : "none"
          }}>

          {/* Blue header */}
          <div className="p-6 border-b border-[rgba(0,102,204,0.2)]"
            style={{ background: "linear-gradient(180deg, rgba(0,102,204,0.15) 0%, transparent 100%)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-[var(--corner-blue)] border border-[rgba(0,102,204,0.4)] px-2 py-0.5 rounded bg-[rgba(0,102,204,0.1)]">🔵 BLUE CORNER</span>
              {isBlueWinner && <span className="text-[10px] font-black tracking-widest text-[var(--ikf-gold)]">▲ LEADING</span>}
            </div>
            <h2 className="font-display text-4xl text-white leading-tight mt-2">{activeMatch.blueCornerName}</h2>
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-xs font-black text-white">{blueYellowCards}</span>
              <span className="w-5 h-7 rounded-sm bg-[#f1c40f] shadow-[0_0_10px_rgba(241,196,15,0.55)]" />
              <span className="text-xs font-black text-white ml-2">{blueRedCards}</span>
              <span className="w-5 h-7 rounded-sm bg-[var(--ikf-red)] shadow-[0_0_10px_rgba(200,16,46,0.65)]" />
            </div>
            <div className="flex items-end gap-6 mt-4">
              <div>
                <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Round {liveRound}</div>
                <div className="font-display text-[80px] leading-none" style={{ color: isBlueWinner ? "var(--corner-blue)" : "rgba(255,255,255,0.85)", textShadow: isBlueWinner ? "0 0 20px rgba(0,102,204,0.5)" : "none" }}>
                  {currentScore.blueScore || "—"}
                </div>
              </div>
              <div className="pb-3">
                <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total</div>
                <div className="font-display text-5xl text-[var(--text-secondary)]">{getCornerTotal("BLUE")}</div>
              </div>
            </div>
          </div>

          {/* Blue action buttons */}
          <div className="flex-1 p-5 flex flex-col gap-3">
            <ScoreButton
              label={t('blue_wins_round_10', settings.language)}
              sublabel="9 — 10"
              onClick={() => handleWinRound("BLUE")}
              disabled={currentScore.submitted || !judge}
              active={isBlueWinner}
              color="blue"
            />

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="col-span-2 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center border-t border-[rgba(255,255,255,0.06)] pt-3">
                Deductions
              </div>
              <ScoreButton label={t('knockdown_1', settings.language)} sublabel="-1 pt" onClick={() => handleDeduction(1, "BLUE")} disabled={currentScore.submitted || !judge} color="blue" size="sm" />
              <ScoreButton label={t('double_kd_2', settings.language)} sublabel="-2 pts" onClick={() => handleDeduction(2, "BLUE")} disabled={currentScore.submitted || !judge} color="blue" size="sm" />
              <ScoreButton label="Yellow Card" sublabel="warning" onClick={() => recordJudgingEvent("yellow-card", "BLUE", "yellow card")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
              <ScoreButton label="Red Card" sublabel="serious" onClick={() => recordJudgingEvent("red-card", "BLUE", "red card")} disabled={currentScore.submitted || !judge} color="blue" size="sm" />
            </div>

            {isChildren && (
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="col-span-3 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center">Special Results</div>
                <ScoreButton label={t('ippon', settings.language)} sublabel="+10" onClick={() => handleSpecial("IPPON", "BLUE")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
                <ScoreButton label={t('waza_ari', settings.language)} sublabel="+2" onClick={() => handleSpecial("WAZA_ARI", "BLUE")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
                <ScoreButton label={t('yuko', settings.language)} sublabel="+1" onClick={() => handleSpecial("YUKO", "BLUE")} disabled={currentScore.submitted || !judge} color="gold" size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION OVERLAY */}
      {showConfirm && currentScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="rounded-3xl p-10 max-w-2xl w-full text-center shadow-2xl border"
            style={{ background: "linear-gradient(160deg, #0a050f 0%, #050a0f 100%)", borderColor: "rgba(212,160,23,0.3)" }}>
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-[rgba(212,160,23,0.1)] border border-[rgba(212,160,23,0.4)]">
              <AlertCircle size={40} className="text-[var(--ikf-gold)]" />
            </div>
            <h2 className="font-display text-4xl mb-2 text-white">{t('confirm_round_score', settings.language).replace('{round}', String(liveRound))}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-8">Judge: <strong className="text-white">{judge?.name}</strong></p>
            
            <div className="flex justify-center items-center gap-16 my-8">
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--ikf-red)] tracking-widest uppercase mb-2">{activeMatch.redCornerName}</div>
                <div className="font-display text-[80px] leading-none" style={{ color: currentScore.redScore > currentScore.blueScore ? "var(--ikf-red)" : "white" }}>
                  {currentScore.redScore}
                </div>
              </div>
              <div className="text-[var(--text-muted)] font-bold text-3xl">vs</div>
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--corner-blue)] tracking-widest uppercase mb-2">{activeMatch.blueCornerName}</div>
                <div className="font-display text-[80px] leading-none" style={{ color: currentScore.blueScore > currentScore.redScore ? "var(--corner-blue)" : "white" }}>
                  {currentScore.blueScore}
                </div>
              </div>
            </div>

            <p className="text-lg font-bold mb-8" style={{ color: currentScore.redScore > currentScore.blueScore ? "var(--ikf-red)" : currentScore.blueScore > currentScore.redScore ? "var(--corner-blue)" : "rgba(255,255,255,0.6)" }}>
              {currentScore.redScore > currentScore.blueScore 
                ? `🔴 ${activeMatch.redCornerName} wins Round ${liveRound}`
                : currentScore.blueScore > currentScore.redScore 
                  ? `🔵 ${activeMatch.blueCornerName} wins Round ${liveRound}`
                  : "Round is a DRAW (10-10)"}
            </p>

            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 h-14 rounded-xl font-bold text-base border border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.05)] transition-all">
                {t('cancel', settings.language)}
              </button>
              <button onClick={confirmSubmit} className="flex-1 h-14 rounded-xl font-display text-base tracking-widest text-black transition-all"
                style={{ background: "var(--status-win)", boxShadow: "0 0 20px rgba(46,204,113,0.3)" }}>
                {t('confirm_and_submit', settings.language)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
