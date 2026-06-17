/* eslint-disable */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ClipboardList, Clock, FileText, ShieldAlert, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { IKFBadge } from "@/components/ui";
import { getStoredRoleSession } from "@/components/auth/AuthGate";
import { deriveLiveMatchTimers, FirebaseMatchState, useFirebaseMatchState } from "@/hooks/useFirebaseMatchSync";
import {
  saveJudgeScoreToDatabase,
  saveJudgingEventToDatabase,
  StoredJudgingEvent,
  useFirebaseJudgingData,
} from "@/hooks/useFirebaseJudgingSync";
import { formatMatchCategory } from "@/lib/ageCategories";
import { isUnder14AgeGroup } from "@/lib/competitionRules";
import { NATIONAL_COUNTRY } from "@/lib/nationalCompetition";
import { useTournamentStore } from "@/store/tournamentStore";
import type { JudgeScore, Referee, RoundEvent, RoundEventType } from "@/types/tournament";

type Corner = "RED" | "BLUE";

type Feedback = {
  id: string;
  label: string;
  corner?: Corner;
  officialName: string;
};

const POINT_VALUES = [10, 9, 8, 7];
const CENTRAL_ACTIONS: Array<{ type: RoundEventType; label: string; cornerRequired?: boolean }> = [
  { type: "ko", label: "KO", cornerRequired: true },
  { type: "tko", label: "TKO", cornerRequired: true },
  { type: "disqualification", label: "Disqualification", cornerRequired: true },
  { type: "doctor", label: "Doctor Pause" },
];
const UNDER_14_ACTIONS: Array<{ type: RoundEventType; label: string }> = [
  { type: "immobilisation", label: "Immobilisation" },
  { type: "waza-ari", label: "Waza-ari" },
  { type: "yuko", label: "Yuko" },
  { type: "ippon", label: "Ippon" },
];
const CORNER_UNDER_14_ACTIONS: Array<{ type: RoundEventType; label: string }> = [
  { type: "waza-ari", label: "Waza-ari" },
  { type: "ippon", label: "Ippon" },
  { type: "immobilisation", label: "Immobilisation" },
  { type: "yuko", label: "Yuko" },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function eventKey(event: RoundEvent | StoredJudgingEvent) {
  return `${event.id || event.timestamp}-${event.type}-${event.corner || ""}-${event.officialId || ""}-${event.details}`;
}

function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function cornerColor(corner: Corner) {
  return corner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)";
}

function CornerPanel({
  corner,
  athleteName,
  score,
  submitted,
  disabled,
  yellowCards,
  redCards,
  onPoint,
  onYellow,
  onRed,
}: {
  corner: Corner;
  athleteName: string;
  score: number;
  submitted: boolean;
  disabled: boolean;
  yellowCards: number;
  redCards: number;
  onPoint: (points: number) => void;
  onYellow: () => void;
  onRed: () => void;
}) {
  const isRed = corner === "RED";
  return (
    <section className="rounded-3xl border bg-[rgba(255,255,255,0.035)] p-5 shadow-2xl" style={{ borderColor: `${cornerColor(corner)}55` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: cornerColor(corner) }}>{corner} corner</div>
          <h2 className="mt-2 font-display text-3xl leading-none text-white">{athleteName}</h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">Round Score</div>
          <div className="font-display text-7xl leading-none" style={{ color: cornerColor(corner), textShadow: `0 0 28px ${cornerColor(corner)}55` }}>{score}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {POINT_VALUES.map(points => (
          <motion.button
            key={`${corner}-${points}`}
            type="button"
            disabled={disabled || submitted}
            whileTap={{ scale: 0.94 }}
            onClick={() => onPoint(points)}
            className="h-20 rounded-2xl border-2 font-display text-3xl transition-all disabled:cursor-not-allowed disabled:opacity-35"
            style={{
              color: score === points ? "#fff" : cornerColor(corner),
              borderColor: cornerColor(corner),
              background: score === points ? cornerColor(corner) : isRed ? "rgba(200,16,46,0.08)" : "rgba(0,102,204,0.08)",
              boxShadow: score === points ? `0 0 26px ${cornerColor(corner)}77` : "none",
            }}
          >
            {points}
          </motion.button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          disabled={disabled}
          whileTap={{ scale: 0.96 }}
          onClick={onYellow}
          className="h-16 rounded-2xl border-2 border-[#f1c40f] bg-[rgba(241,196,15,0.12)] font-black uppercase tracking-[0.22em] text-[#f1c40f] disabled:opacity-35"
        >
          Yellow Card ({yellowCards})
        </motion.button>
        <motion.button
          type="button"
          disabled={disabled}
          whileTap={{ scale: 0.96 }}
          onClick={onRed}
          className="h-16 rounded-2xl border-2 border-[var(--ikf-red)] bg-[rgba(200,16,46,0.12)] font-black uppercase tracking-[0.22em] text-[var(--ikf-red)] disabled:opacity-35"
        >
          Red Card ({redCards})
        </motion.button>
      </div>

      <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25 px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">
        Two yellow cards become one red card for this official profile. One red card makes this athlete lose this round on this official scorecard only.
      </div>
    </section>
  );
}

function CentralActionButton({
  label,
  corner,
  disabled,
  onClick,
}: {
  label: string;
  corner?: Corner;
  disabled: boolean;
  onClick: () => void;
}) {
  const color = corner ? cornerColor(corner) : "var(--ikf-gold)";
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="relative min-h-16 overflow-hidden rounded-2xl border-2 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-35"
      style={{ color, borderColor: color, background: corner === "RED" ? "rgba(200,16,46,0.08)" : corner === "BLUE" ? "rgba(0,102,204,0.08)" : "rgba(212,160,23,0.1)" }}
    >
      {label}
    </motion.button>
  );
}

export default function JudgeTabletView() {
  const {
    matches,
    athletes,
    currentRound,
    roundTimer,
    timerMode,
    roundEvents,
    judgeScores,
    setJudgeScore,
    submitJudgeScore,
    referees,
    addRoundEvent,
    addReferee,
  } = useTournamentStore();

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedJudgeId, setSelectedJudgeId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [noteText, setNoteText] = useState("");
  const [session, setSession] = useState<ReturnType<typeof getStoredRoleSession>>(null);
  const [fbState, setFbState] = useState<FirebaseMatchState | null>(null);
  const [databaseEvents, setDatabaseEvents] = useState<StoredJudgingEvent[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    setSession(getStoredRoleSession());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTimerTick(tick => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isRefereeSession = session?.role === "central-referee" || session?.role === "corner-referee";
  const linkedReferee = useMemo(() => {
    if (!isRefereeSession) return null;
    return referees.find(referee =>
      referee.id === session?.refereeId ||
      referee.accountId === session?.accountId
    ) ?? null;
  }, [isRefereeSession, referees, session?.accountId, session?.refereeId]);
  const lockedRefereeId = isRefereeSession ? linkedReferee?.id ?? "__unlinked_referee__" : undefined;

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
    if (!activeMatch) return [] as Referee[];
    const ids = [activeMatch.assignedRefereeId, ...(activeMatch.assignedJudgeIds ?? [])].filter(Boolean) as string[];
    const officials = ids.map(id => referees.find(referee => referee.id === id)).filter(Boolean) as Referee[];
    return lockedRefereeId ? officials.filter(official => official.id === lockedRefereeId) : officials;
  }, [activeMatch, lockedRefereeId, referees]);

  const judge = useMemo(
    () => referees.find(referee => referee.id === selectedJudgeId) ?? null,
    [referees, selectedJudgeId],
  );

  useEffect(() => {
    setSelectedJudgeId("");
    setFbState(null);
    setDatabaseEvents([]);
    setNoteText("");
  }, [selectedMatchId]);

  useEffect(() => {
    if (assignedOfficials.length === 1) setSelectedJudgeId(assignedOfficials[0].id);
  }, [assignedOfficials]);

  useFirebaseMatchState((state) => {
    if (selectedMatchId && state.matchId === selectedMatchId) setFbState(state);
  });

  useFirebaseJudgingData(selectedMatchId || null, ({ scores, events }) => {
    scores.forEach(score => setJudgeScore(score));
    setDatabaseEvents(events);
  });

  const liveRound = fbState?.currentRound ?? currentRound;
  const liveTotalRounds = fbState?.totalRounds ?? activeMatch?.totalRounds ?? 2;
  const derivedTimers = useMemo(() => deriveLiveMatchTimers(fbState), [fbState, timerTick]);
  const liveMode = fbState?.timerMode ?? timerMode;
  const liveTimer = liveMode === "rest"
    ? derivedTimers?.restTimer ?? fbState?.restTimer ?? 60
    : liveMode === "passivity"
      ? derivedTimers?.woskTimeLeft ?? fbState?.woskTimeLeft ?? 10
      : derivedTimers?.roundTimer ?? fbState?.roundTimer ?? roundTimer;

  const redAthlete = athletes.find(athlete => athlete.id === activeMatch?.redCornerId);
  const blueAthlete = athletes.find(athlete => athlete.id === activeMatch?.blueCornerId);
  const isUnder14Match = Boolean(activeMatch) && (
    isUnder14AgeGroup(activeMatch?.ageGroup) ||
    [redAthlete, blueAthlete].some(athlete => {
      const age = ageFromDob(athlete?.dob);
      return age !== null && age <= 14;
    })
  );

  const combinedEvents = useMemo(() => {
    if (!activeMatch) return [] as Array<RoundEvent | StoredJudgingEvent>;
    const localEvents = roundEvents.filter(event =>
      event.matchId === activeMatch.id ||
      event.details?.toLowerCase().includes(`match #${activeMatch.matchNumber}`)
    );
    const merged = new Map<string, RoundEvent | StoredJudgingEvent>();
    [...localEvents, ...databaseEvents].forEach(event => merged.set(eventKey(event), event));
    return Array.from(merged.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeMatch, databaseEvents, roundEvents]);

  const currentScore = useMemo<JudgeScore>(() => {
    if (!activeMatch || !judge) {
      return { matchId: "", judgeId: "", judgeName: "", round: liveRound, redScore: 0, blueScore: 0, submitted: false };
    }
    return judgeScores.find(score =>
      score.matchId === activeMatch.id &&
      score.judgeId === judge.id &&
      score.round === liveRound
    ) ?? {
      matchId: activeMatch.id,
      judgeId: judge.id,
      judgeName: judge.name,
      round: liveRound,
      redScore: 0,
      blueScore: 0,
      submitted: false,
    };
  }, [activeMatch, judge, judgeScores, liveRound]);

  const roleReady = !isRefereeSession || Boolean(linkedReferee);
  const roleApproved = !isRefereeSession || (linkedReferee?.approvalStatus ?? "Approved") === "Approved";
  const isCornerReferee = judge?.role === "Corner Judge";
  const isCentralReferee = Boolean(judge) && judge?.role !== "Corner Judge";
  const canAct = Boolean(activeMatch && judge && roleReady && roleApproved);

  const triggerFeedback = (label: string, corner?: Corner) => {
    if (!judge) return;
    const item = { id: uuidv4(), label, corner, officialName: judge.name };
    setFeedback(item);
    window.setTimeout(() => setFeedback(current => current?.id === item.id ? null : current), 1600);
  };

  const persistEvent = (type: RoundEventType, label: string, corner?: Corner, detailsExtra?: string) => {
    if (!activeMatch || !judge) return;
    const targetName = corner === "RED"
      ? activeMatch.redCornerName
      : corner === "BLUE"
        ? activeMatch.blueCornerName
        : "match";
    const details = `Match #${activeMatch.matchNumber} - Round ${liveRound} - ${label}${corner ? ` for ${corner} corner (${targetName})` : ""} by ${judge.name}${detailsExtra ? ` - ${detailsExtra}` : ""}`;
    const eventPayload = {
      matchId: activeMatch.id,
      round: liveRound,
      type,
      corner,
      details,
      officialId: judge.id,
      officialName: judge.name,
    };
    addRoundEvent(eventPayload);
    saveJudgingEventToDatabase(eventPayload);
    triggerFeedback(label, corner);
  };

  const saveDraftScore = (redScore: number, blueScore: number) => {
    if (!activeMatch || !judge) return;
    const score: JudgeScore = {
      matchId: activeMatch.id,
      judgeId: judge.id,
      judgeName: judge.name,
      round: liveRound,
      redScore,
      blueScore,
      submitted: false,
    };
    setJudgeScore(score);
    saveJudgeScoreToDatabase(score);
  };

  const handlePoint = (corner: Corner, points: number) => {
    if (!activeMatch || !judge || currentScore.submitted) return;
    const nextRed = corner === "RED" ? points : currentScore.redScore;
    const nextBlue = corner === "BLUE" ? points : currentScore.blueScore;
    saveDraftScore(nextRed, nextBlue);
    persistEvent("score-input", `${points} points`, corner, `Score is RED ${nextRed} - BLUE ${nextBlue}`);
  };

  const applyRoundLoss = (corner: Corner) => {
    if (!activeMatch || !judge) return;
    if (corner === "RED") {
      saveDraftScore(7, Math.max(currentScore.blueScore, 10));
    } else {
      saveDraftScore(Math.max(currentScore.redScore, 10), 7);
    }
  };

  const countOfficialEvents = (type: RoundEventType, corner: Corner) => combinedEvents.filter(event =>
    event.type === type &&
    event.corner === corner &&
    event.round === liveRound &&
    ((event as StoredJudgingEvent).officialId === judge?.id || (event as StoredJudgingEvent).officialName === judge?.name)
  ).length;

  const recordCard = (corner: Corner, card: "yellow-card" | "red-card") => {
    if (!activeMatch || !judge) return;
    if (card === "yellow-card") {
      const existingYellow = countOfficialEvents("yellow-card", corner);
      const existingRed = countOfficialEvents("red-card", corner);
      persistEvent("yellow-card", "Yellow card", corner);
      if (existingYellow + 1 >= 2 && existingRed === 0) {
        persistEvent("red-card", "Automatic red card after two yellow cards", corner);
        applyRoundLoss(corner);
      }
      return;
    }
    persistEvent("red-card", "Red card", corner);
    applyRoundLoss(corner);
  };

  const submitCurrentScore = () => {
    if (!activeMatch || !judge) return;
    if (currentScore.redScore === 0 && currentScore.blueScore === 0) {
      toast.error("Select red and blue points before submitting this round.");
      return;
    }
    const submittedScore = { ...currentScore, submitted: true };
    setJudgeScore(submittedScore);
    saveJudgeScoreToDatabase(submittedScore);
    submitJudgeScore(judge.id, liveRound, currentScore.redScore, currentScore.blueScore, activeMatch.id, judge.name);
    persistEvent("score-input", "Round score submitted", undefined, `RED ${currentScore.redScore} - BLUE ${currentScore.blueScore}`);
  };

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
      country: NATIONAL_COUNTRY,
      grade: "Submitted Official",
      status: "Available",
      approvalStatus: "Pending",
      accountId: session.accountId,
    });
    setProfileName("");
    toast.success("Referee profile submitted. The chief admin must approve it before judging access is active.");
  };

  if (isRefereeSession && !linkedReferee) {
    return (
      <main className="min-h-screen bg-[#050508] p-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-[rgba(212,160,23,0.35)] bg-[rgba(255,255,255,0.04)] p-8 shadow-2xl">
            <ShieldAlert size={38} className="mb-5 text-[var(--ikf-gold)]" />
            <h1 className="font-display text-4xl">Submit referee profile</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              Your account exists, but it is not linked to an approved referee profile yet. Submit your profile and the chief admin will approve it.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="h-14 flex-1 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-black/30 px-5 font-semibold text-white outline-none focus:border-[var(--ikf-gold)]"
                placeholder="Official full name"
              />
              <button
                type="button"
                onClick={submitRefereeProfile}
                className="h-14 rounded-2xl bg-[var(--ikf-gold)] px-6 text-sm font-black uppercase tracking-widest text-black"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isRefereeSession && !roleApproved) {
    return (
      <main className="min-h-screen bg-[#050508] p-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-[rgba(212,160,23,0.35)] bg-[rgba(255,255,255,0.04)] p-8 text-center shadow-2xl">
            <Clock size={42} className="mx-auto mb-5 text-[var(--ikf-gold)]" />
            <h1 className="font-display text-4xl">Waiting for approval</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              The chief admin must approve this referee profile before it can judge matches.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] text-[var(--ikf-gold)]">
              <Trophy size={16} /> Electronic Judging
            </div>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl">Official Match Input</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <IKFBadge variant={liveMode === "round" ? "live" : "pending"} label={liveMode.toUpperCase()} />
            <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/30 px-5 py-3 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Timer</div>
              <div className="font-display text-4xl">{formatTime(liveTimer)}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">1. Select match first</span>
              <select
                value={selectedMatchId}
                onChange={(event) => setSelectedMatchId(event.target.value)}
                className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/35 px-4 text-sm font-bold text-white outline-none focus:border-[var(--ikf-red)]"
              >
                <option value="">Choose assigned match...</option>
                {selectableMatches.map(match => (
                  <option key={match.id} value={match.id}>
                    Match #{match.matchNumber} - {formatMatchCategory(match.ageGroup, match.weightCategory, match.gender)} - {match.redCornerName} vs {match.blueCornerName}
                  </option>
                ))}
              </select>
            </label>
            {selectableMatches.length === 0 && (
              <div className="mt-4 rounded-2xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.08)] p-4 text-sm font-bold text-[var(--ikf-red)]">
                No assigned matches found. Assign officials in Referee Management first.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">2. Select judge profile</span>
              <select
                value={selectedJudgeId}
                onChange={(event) => setSelectedJudgeId(event.target.value)}
                disabled={!activeMatch}
                className="h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/35 px-4 text-sm font-bold text-white outline-none disabled:opacity-40 focus:border-[var(--ikf-gold)]"
              >
                {!activeMatch ? (
                  <option value="">Select a match first</option>
                ) : (
                  <>
                    <option value="">Choose assigned official...</option>
                    {assignedOfficials.map(official => (
                      <option key={official.id} value={official.id}>{official.name} - {official.role}</option>
                    ))}
                  </>
                )}
              </select>
            </label>
            {activeMatch && assignedOfficials.length === 0 && (
              <div className="mt-4 rounded-2xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.08)] p-4 text-sm font-bold text-[var(--ikf-red)]">
                No assigned official profile is available for this account.
              </div>
            )}
          </div>
        </section>

        {activeMatch && (
          <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--ikf-red)]">Red</div>
                <div className="font-display text-4xl">{activeMatch.redCornerName}</div>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/35 px-6 py-4 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Round</div>
                <div className="font-display text-4xl text-[var(--ikf-gold)]">{liveRound} / {liveTotalRounds}</div>
                <div className="mt-1 text-xs font-bold text-[var(--text-muted)]">{formatMatchCategory(activeMatch.ageGroup, activeMatch.weightCategory, activeMatch.gender)}</div>
                {isUnder14Match && <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--ikf-gold)]">Under-14 central judging enabled</div>}
              </div>
              <div className="text-left lg:text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--corner-blue)]">Blue</div>
                <div className="font-display text-4xl">{activeMatch.blueCornerName}</div>
              </div>
            </div>
          </section>
        )}

        {!activeMatch ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border-2 border-dashed border-[rgba(255,255,255,0.12)] text-center text-[var(--text-muted)]">
            <div>
              <ClipboardList size={52} className="mx-auto mb-4 opacity-40" />
              <p className="font-display text-3xl text-white">Select a match to load its assigned officials.</p>
            </div>
          </div>
        ) : !judge ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-3xl border-2 border-dashed border-[rgba(255,255,255,0.12)] text-center text-[var(--text-muted)]">
            <div>
              <FileText size={48} className="mx-auto mb-4 opacity-40" />
              <p className="font-display text-3xl text-white">Choose your assigned profile to begin.</p>
            </div>
          </div>
        ) : isCornerReferee && isUnder14Match ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.06)] p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert size={22} className="text-[var(--ikf-gold)]" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--ikf-gold)]">Corner referee under-14 mode</div>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                    Point buttons are hidden for this age group. Save only Waza-ari, Ippon, Immobilisation, or Yuko for the selected athlete.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {(["RED", "BLUE"] as Corner[]).map(corner => (
                <div key={`corner-under14-${corner}`} className="rounded-3xl border bg-[rgba(255,255,255,0.035)] p-5 shadow-2xl" style={{ borderColor: `${cornerColor(corner)}55` }}>
                  <div className="mb-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: cornerColor(corner) }}>{corner} athlete</div>
                    <h2 className="mt-2 font-display text-3xl leading-none text-white">{corner === "RED" ? activeMatch.redCornerName : activeMatch.blueCornerName}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {CORNER_UNDER_14_ACTIONS.map(action => (
                      <CentralActionButton
                        key={`${corner}-corner-u14-${action.type}`}
                        label={action.label}
                        corner={corner}
                        disabled={!canAct}
                        onClick={() => persistEvent(action.type, action.label, corner)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : isCornerReferee ? (
          <section className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <CornerPanel
                corner="RED"
                athleteName={activeMatch.redCornerName}
                score={currentScore.redScore}
                submitted={currentScore.submitted}
                disabled={!canAct}
                yellowCards={countOfficialEvents("yellow-card", "RED")}
                redCards={countOfficialEvents("red-card", "RED")}
                onPoint={(points) => handlePoint("RED", points)}
                onYellow={() => recordCard("RED", "yellow-card")}
                onRed={() => recordCard("RED", "red-card")}
              />
              <CornerPanel
                corner="BLUE"
                athleteName={activeMatch.blueCornerName}
                score={currentScore.blueScore}
                submitted={currentScore.submitted}
                disabled={!canAct}
                yellowCards={countOfficialEvents("yellow-card", "BLUE")}
                redCards={countOfficialEvents("red-card", "BLUE")}
                onPoint={(points) => handlePoint("BLUE", points)}
                onYellow={() => recordCard("BLUE", "yellow-card")}
                onRed={() => recordCard("BLUE", "red-card")}
              />
            </div>
            <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Current official scorecard</div>
                  <div className="mt-2 flex items-center gap-5">
                    <span className="font-display text-5xl text-[var(--ikf-red)]">{currentScore.redScore}</span>
                    <span className="text-2xl text-[var(--text-muted)]">-</span>
                    <span className="font-display text-5xl text-[var(--corner-blue)]">{currentScore.blueScore}</span>
                    {currentScore.submitted && <IKFBadge variant="win" label="Submitted" />}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canAct || currentScore.submitted || (currentScore.redScore === 0 && currentScore.blueScore === 0)}
                  onClick={submitCurrentScore}
                  className="h-16 rounded-2xl bg-[var(--ikf-gold)] px-8 text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-[#f0c84c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit Round {liveRound}
                </button>
              </div>
            </div>
          </section>
        ) : isCentralReferee ? (
          <section className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              {(["RED", "BLUE"] as Corner[]).map(corner => (
                <div key={corner} className="rounded-3xl border bg-[rgba(255,255,255,0.035)] p-5" style={{ borderColor: `${cornerColor(corner)}55` }}>
                  <div className="mb-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: cornerColor(corner) }}>{corner} athlete</div>
                    <h2 className="mt-2 font-display text-3xl text-white">{corner === "RED" ? activeMatch.redCornerName : activeMatch.blueCornerName}</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {CENTRAL_ACTIONS.filter(action => action.cornerRequired).map(action => (
                      <CentralActionButton
                        key={`${corner}-${action.type}`}
                        label={action.label}
                        corner={corner}
                        disabled={!canAct}
                        onClick={() => persistEvent(action.type, action.label, corner)}
                      />
                    ))}
                  </div>
                  {isUnder14Match && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {UNDER_14_ACTIONS.map(action => (
                        <CentralActionButton
                          key={`${corner}-${action.type}`}
                          label={action.label}
                          corner={corner}
                          disabled={!canAct}
                          onClick={() => persistEvent(action.type, action.label, corner)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.06)] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--ikf-gold)]">Central actions</div>
                <div className="mt-4 grid gap-3">
                  {CENTRAL_ACTIONS.filter(action => !action.cornerRequired).map(action => (
                    <CentralActionButton
                      key={action.type}
                      label={action.label}
                      disabled={!canAct}
                      onClick={() => persistEvent(action.type, action.label)}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Central referee note</span>
                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    disabled={!canAct}
                    className="min-h-32 w-full resize-y rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black/35 p-4 text-sm font-semibold text-white outline-none disabled:opacity-40 focus:border-[var(--ikf-gold)]"
                    placeholder="Write the note that the admin will read in Instant Reports..."
                  />
                </label>
                <button
                  type="button"
                  disabled={!canAct || noteText.trim().length < 2}
                  onClick={() => {
                    persistEvent("note", "Central referee note", undefined, noteText.trim());
                    setNoteText("");
                  }}
                  className="mt-4 h-14 w-full rounded-2xl bg-[var(--ikf-gold)] text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-[#f0c84c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Note
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-3xl border border-[rgba(200,16,46,0.35)] bg-[rgba(200,16,46,0.08)] p-6 text-sm font-bold text-[var(--ikf-red)]">
            This profile role cannot judge this match.
          </div>
        )}

        {activeMatch && (
          <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Saved actions for this match</div>
                <h2 className="font-display text-3xl text-white">Live action log</h2>
              </div>
              <IKFBadge variant="pending" label={`${combinedEvents.length} events`} />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/25">
              {combinedEvents.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-[var(--text-muted)]">No saved judging action yet.</div>
              ) : [...combinedEvents].reverse().slice(0, 40).map(event => (
                <div key={eventKey(event)} className="grid gap-2 border-b border-[rgba(255,255,255,0.06)] p-4 text-sm sm:grid-cols-[90px_130px_120px_1fr]">
                  <div className="font-mono text-[var(--text-muted)]">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "--:--"}</div>
                  <div className="font-black uppercase tracking-widest" style={{ color: event.corner ? cornerColor(event.corner) : "var(--ikf-gold)" }}>{event.corner ?? "MATCH"}</div>
                  <div className="font-semibold text-white">{(event as StoredJudgingEvent).officialName ?? "Table"}</div>
                  <div className="text-[var(--text-secondary)]">{event.details}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-3xl border border-[rgba(46,204,113,0.55)] bg-black/90 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(46,204,113,0.14)] text-[var(--status-win)]">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--status-win)]">Saved to database</div>
                <div className="mt-1 font-display text-2xl text-white">{feedback.label}{feedback.corner ? ` - ${feedback.corner}` : ""}</div>
                <div className="text-xs font-semibold text-[var(--text-muted)]">Official: {feedback.officialName}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
