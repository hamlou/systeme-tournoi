/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef } from "react";
import { format as formatDate } from "date-fns";
import { Play, Pause, Square, AlertTriangle, Activity, FastForward, Info, Wifi } from "lucide-react";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Match } from "@/types/tournament";
import { PageHeader, IKFCard, IKFButton, SectionDivider, IKFBadge, IKFEmptyState } from "@/components/ui";
import toast from "react-hot-toast";
import { useLiveAggregateScore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";
import { UpcomingMatchAlert } from "@/components/UpcomingMatchAlert";
import { pushMatchState, useFirebaseMatchState, deriveLiveMatchTimers } from "@/hooks/useFirebaseMatchSync";
import { formatMatchCategory, getRoundDuration, totalRoundsForAgeGroup } from "@/lib/ageCategories";
import { getStoredRoleSession } from "@/components/auth/AuthGate";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function RoundManagementPage() {
  const { 
    matches, activeMatch, setActiveMatch, 
    currentRound, setCurrentRound,
    roundTimer, setRoundTimer,
    timerMode, setTimerMode,
    roundEvents, addRoundEvent,
    settings, updateMatch,
    judgeScores,
  } = useTournamentStore();
  const upcomingMatches = useMatchNotifications();

  const [woskTimeLeft, setWoskTimeLeft] = useState(10);
  const [woskCorner, setWoskCorner] = useState<"RED" | "BLUE" | null>(null);
  const [restTimeLeft, setRestTimeLeft] = useState(60);
  const [resumeMode, setResumeMode] = useState<"round" | "rest" | null>(null);
  const [firebaseSyncing, setFirebaseSyncing] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getStoredRoleSession>>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSession(getStoredRoleSession());
  }, []);

  // ── Resume timer state from Firebase on mount ──────────────────────────────
  const [fbMatchState, setFbMatchState] = useState<any>(null);
  useFirebaseMatchState((state) => setFbMatchState(state));

  useEffect(() => {
    if (!fbMatchState || !activeMatch || fbMatchState.matchId !== activeMatch.id) return;
    // Only resume if the page just mounted and timer is idle but Firebase says it's running
    if (timerMode === "idle" && fbMatchState.timerMode === "round") {
      const derived = deriveLiveMatchTimers(fbMatchState);
      if (derived) {
        setRoundTimer(derived.roundTimer);
        setTimerMode("round");
        if (fbMatchState.currentRound) setCurrentRound(fbMatchState.currentRound);
      }
    }
    if (timerMode === "idle" && fbMatchState.timerMode === "rest") {
      const derived = deriveLiveMatchTimers(fbMatchState);
      if (derived) {
        setRestTimeLeft(derived.restTimer);
        setTimerMode("rest");
      }
    }
    if (timerMode === "idle" && fbMatchState.timerMode === "passivity") {
      const derived = deriveLiveMatchTimers(fbMatchState);
      if (derived) {
        setWoskTimeLeft(derived.woskTimeLeft);
        setWoskCorner(fbMatchState.woskCorner as "RED" | "BLUE" | null);
        setTimerMode("passivity");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbMatchState]);

  const centralRefereeId = session?.role === "central-referee" ? session.refereeId ?? "__unlinked_referee__" : undefined;
  const activeMatches = matches.filter(m =>
    (m.status === "scheduled" || m.status === "in-progress") &&
    Boolean(m.assignedRefereeId) &&
    (m.assignedJudgeIds?.length ?? 0) === settings.defaultJudgesCount &&
    Boolean(m.redCornerId) &&
    Boolean(m.blueCornerId) &&
    !m.isBye &&
    (!centralRefereeId || m.assignedRefereeId === centralRefereeId)
  );

  const { red: redScore, blue: blueScore } = useLiveAggregateScore();

  const maxTime = activeMatch ? getRoundDuration(settings.roundDurations, activeMatch.ageGroup) : 180;
  const maxRounds = activeMatch?.totalRounds ?? 2;

  // ── Push state to Firebase on every meaningful change ──────────────────────
  const syncToFirebase = (overrides?: Partial<{
    timerMode: string; roundTimer: number; currentRound: number;
    woskTimeLeft: number; woskCorner: string | null; restTimeLeft: number;
  }>) => {
    if (!activeMatch) return;
    const state = {
      matchId: activeMatch.id,
      matchNumber: activeMatch.matchNumber,
      redCornerName: activeMatch.redCornerName,
      blueCornerName: activeMatch.blueCornerName,
      redScore,
      blueScore,
      roundTimer: overrides?.roundTimer ?? roundTimer,
      restTimer: overrides?.restTimeLeft ?? restTimeLeft,
      timerMode: overrides?.timerMode ?? timerMode,
      currentRound: overrides?.currentRound ?? currentRound,
      totalRounds: maxRounds,
      maxTime,
      woskTimeLeft: overrides?.woskTimeLeft ?? woskTimeLeft,
      woskCorner: overrides?.woskCorner !== undefined ? overrides.woskCorner : woskCorner,
      status: activeMatch.status,
        category: formatMatchCategory(activeMatch.ageGroup, activeMatch.weightCategory, activeMatch.gender),
      matNumber: activeMatch.matNumber,
      updatedAt: Date.now(),
    };
    setFirebaseSyncing(true);
    pushMatchState(state).finally(() => setFirebaseSyncing(false));
  };

  const getAggregateRoundWinner = (roundNumber: number): "RED" | "BLUE" | null => {
    if (!activeMatch) return null;
    const submittedScores = judgeScores.filter(score =>
      score.matchId === activeMatch.id &&
      score.round === roundNumber &&
      score.submitted
    );
    if (submittedScores.length === 0) return null;

    const redVotes = submittedScores.filter(score => score.redScore > score.blueScore).length;
    const blueVotes = submittedScores.filter(score => score.blueScore > score.redScore).length;
    if (redVotes > blueVotes) return "RED";
    if (blueVotes > redVotes) return "BLUE";

    const redTotal = submittedScores.reduce((sum, score) => sum + score.redScore, 0);
    const blueTotal = submittedScores.reduce((sum, score) => sum + score.blueScore, 0);
    if (redTotal > blueTotal) return "RED";
    if (blueTotal > redTotal) return "BLUE";
    return null;
  };

  // TICKER LOOP
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (timerMode === "round") {
        const next = Math.max(0, roundTimer - 1);
        setRoundTimer(next);
        syncToFirebase({ roundTimer: next });
      }
      if (timerMode === "rest") {
        setRestTimeLeft(prev => {
          const next = Math.max(0, prev - 1);
          syncToFirebase({ restTimeLeft: next });
          return next;
        });
      }
      if (timerMode === "passivity") {
        setWoskTimeLeft(prev => {
          const next = Math.max(0, prev - 1);
          syncToFirebase({ woskTimeLeft: next });
          return next;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerMode, roundTimer, setRoundTimer]);

  useEffect(() => {
    if (timerMode === "round" && roundTimer === 0) endRound();
  }, [timerMode, roundTimer]);

  useEffect(() => {
    if (timerMode === "rest" && restTimeLeft === 0) startNextRound();
  }, [timerMode, restTimeLeft]);

  useEffect(() => {
    if (timerMode === "passivity" && woskTimeLeft === 0) {
      setTimerMode(resumeMode ?? "round");
      addRoundEvent({ type: "deduction", corner: woskCorner || "RED", details: `Match #${activeMatch?.matchNumber ?? ""} — WOSK penalty applied after timeout` });
      setResumeMode(null);
      syncToFirebase({ timerMode: resumeMode ?? "round", woskTimeLeft: 0, woskCorner: null });
    }
  }, [timerMode, woskTimeLeft, resumeMode, woskCorner, activeMatch?.matchNumber]);


  const handleSelectMatch = (m: Match) => {
    if (timerMode === "round" || timerMode === "rest" || timerMode === "passivity") {
      toast.error("Pause or stop the current match before switching matches.");
      return;
    }
    const baseRounds = totalRoundsForAgeGroup(m.ageGroup);
    const totalRounds = m.totalRounds && m.totalRounds > baseRounds ? m.totalRounds : baseRounds;
    const selected = { ...m, totalRounds, status: m.status === "scheduled" ? "in-progress" : m.status } as Match;
    updateMatch(m.id, { ...(m.status === "scheduled" ? { status: "in-progress" as const } : {}), totalRounds });
    setActiveMatch(selected);
    setCurrentRound(1);
    setRoundTimer(getRoundDuration(settings.roundDurations, m.ageGroup));
    setTimerMode("idle");
    setRestTimeLeft(60);
    setWoskTimeLeft(10);
    setResumeMode(null);
    // Push initial state to Firebase
    setTimeout(() => {
      pushMatchState({
        matchId: m.id,
        matchNumber: m.matchNumber,
        redCornerName: m.redCornerName,
        blueCornerName: m.blueCornerName,
        redScore: 0,
        blueScore: 0,
        roundTimer: getRoundDuration(settings.roundDurations, m.ageGroup),
        restTimer: 60,
        timerMode: "idle",
        currentRound: 1,
        totalRounds,
        maxTime: getRoundDuration(settings.roundDurations, m.ageGroup),
        woskTimeLeft: 10,
        woskCorner: null,
        status: "in-progress",
        category: formatMatchCategory(m.ageGroup, m.weightCategory, m.gender),
        matNumber: m.matNumber,
        updatedAt: Date.now(),
      });
    }, 100);
  };

  const startTimer = () => {
    if (!activeMatch) return;
    if (roundTimer <= 0) setRoundTimer(maxTime);
    if (activeMatch.status === "scheduled") updateMatch(activeMatch.id, { status: "in-progress" });
    setTimerMode("round");
    addRoundEvent({ type: "round-start", details: `Match #${activeMatch.matchNumber} — Round ${currentRound} started` });
    syncToFirebase({ timerMode: "round", roundTimer: roundTimer <= 0 ? maxTime : roundTimer });
  };

  const pauseTimer = () => {
    if (!activeMatch) return;
    setResumeMode(timerMode === "rest" ? "rest" : timerMode === "round" ? "round" : resumeMode);
    setTimerMode("idle");
    addRoundEvent({ type: "wosk-stop", details: `Match #${activeMatch.matchNumber} — Timer paused` });
    syncToFirebase({ timerMode: "idle" });
  };

  const triggerWosk = (corner: "RED" | "BLUE") => {
    if (!activeMatch) return;
    setResumeMode(timerMode === "rest" ? "rest" : "round");
    setTimerMode("passivity");
    setWoskTimeLeft(10);
    setWoskCorner(corner);
    addRoundEvent({ type: "yellow-card", corner, details: `Match #${activeMatch.matchNumber} — WOSK passivity warning` });
    syncToFirebase({ timerMode: "passivity", woskTimeLeft: 10, woskCorner: corner });
  };

  const triggerMedical = () => {
    if (!activeMatch) return;
    setResumeMode(timerMode === "rest" ? "rest" : "round");
    setTimerMode("medical");
    addRoundEvent({ type: "doctor", details: `Match #${activeMatch.matchNumber} — Doctor requested to Mat` });
    syncToFirebase({ timerMode: "medical" });
  };

  const endRound = () => {
    if (!activeMatch || timerMode === "rest") return;
    setTimerMode("idle");
    addRoundEvent({ type: "round-end", details: `Match #${activeMatch.matchNumber} — Round ${currentRound} ended` });
    
    if (currentRound === 2 && maxRounds === 2) {
      const roundOneWinner = getAggregateRoundWinner(1);
      const roundTwoWinner = getAggregateRoundWinner(2);
      if (roundOneWinner && roundTwoWinner && roundOneWinner !== roundTwoWinner) {
        updateMatch(activeMatch.id, { totalRounds: 3 });
        setActiveMatch({ ...activeMatch, totalRounds: 3 });
        setCurrentRound(3);
        setRoundTimer(maxTime);
        setRestTimeLeft(0);
        setResumeMode(null);
        toast("Draw after two rounds. Round 3 tiebreak opened.", { icon: "!", duration: 5000 });
        addRoundEvent({ type: "round-start", details: `Match #${activeMatch.matchNumber} - Round 3 tiebreak opened because each athlete won one round` });
        syncToFirebase({ timerMode: "idle", currentRound: 3, roundTimer: maxTime, restTimeLeft: 0 });
        return;
      }
    }

    if (currentRound < maxRounds) {
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setRoundTimer(maxTime);
      setRestTimeLeft(0);
      setResumeMode(null);
      syncToFirebase({ timerMode: "idle", currentRound: nextRound, roundTimer: maxTime, restTimeLeft: 0 });
    } else {
      toast("Match Complete. Awaiting Judge Validation.", { icon: "🏁", duration: 5000 });
      addRoundEvent({ type: "match-end", details: `Match #${activeMatch.matchNumber} — All rounds completed. Awaiting chief referee validation.` });
      setResumeMode(null);
      syncToFirebase({ timerMode: "idle" });
    }
  };

  const startNextRound = () => {
    if (!activeMatch) return;
    const nextRound = Math.min(currentRound + 1, maxRounds);
    setCurrentRound(nextRound);
    setRoundTimer(maxTime);
    setTimerMode("round");
    setResumeMode(null);
    addRoundEvent({ type: "round-start", details: `Match #${activeMatch.matchNumber} — Round ${nextRound} started` });
    syncToFirebase({ timerMode: "round", currentRound: nextRound, roundTimer: maxTime });
  };

  const stopMatch = () => {
    if (activeMatch) addRoundEvent({ type: "match-end", details: `Match #${activeMatch.matchNumber} — Match stopped by table official` });
    setTimerMode("idle");
    setResumeMode(null);
    setActiveMatch(null);
    pushMatchState({
      matchId: null,
      matchNumber: null,
      redCornerName: "—",
      blueCornerName: "—",
      redScore: 0,
      blueScore: 0,
      roundTimer: 0,
      restTimer: 0,
      timerMode: "idle",
      currentRound: 1,
      totalRounds: 2,
      maxTime: 180,
      woskTimeLeft: 10,
      woskCorner: null,
      status: "idle",
      category: "—",
      matNumber: 0,
      updatedAt: Date.now(),
    });
  };

  const resumeTimer = () => {
    if (!activeMatch) return;
    setTimerMode(resumeMode ?? "round");
    addRoundEvent({ type: "round-start", details: `Match #${activeMatch.matchNumber} — Timer resumed` });
    setResumeMode(null);
    syncToFirebase({ timerMode: resumeMode ?? "round" });
  };

  // Status mapping
  let displayStatus = t('status_idle', settings.language);
  if (timerMode === "round") displayStatus = t('status_running', settings.language);
  if (timerMode === "idle" && activeMatch && roundTimer < maxTime) displayStatus = t('status_paused', settings.language);
  if (timerMode === "passivity") displayStatus = t('status_wosk', settings.language);
  if (timerMode === "medical") displayStatus = t('status_medical', settings.language);
  if (timerMode === "rest") displayStatus = t('status_rest', settings.language);

  const circumference = 2 * Math.PI * 120;
  let progressOffset = 0;
  if (timerMode === "rest") {
    progressOffset = circumference - (restTimeLeft / 60) * circumference;
  } else {
    progressOffset = circumference - (roundTimer / maxTime) * circumference;
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <UpcomingMatchAlert matches={upcomingMatches} />
      <PageHeader 
        category={t('live', settings.language)}
        title={t('round_management', settings.language).toUpperCase()}
        subtitle={t('round_management_desc', settings.language)}
        actions={
          <div className="flex items-center gap-2 text-xs font-bold">
            <Wifi size={14} className={firebaseSyncing ? "text-green-400 animate-pulse" : "text-[var(--text-muted)]"} />
            <span className={firebaseSyncing ? "text-green-400" : "text-[var(--text-muted)]"}>
              {firebaseSyncing ? "SYNCING TO TV..." : "TV SYNC READY"}
            </span>
          </div>
        }
      />

      {/* MATCH SELECTOR BAR */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {activeMatches.map(m => (
          <div 
            key={m.id} 
            onClick={() => handleSelectMatch(m)}
            className={`flex-shrink-0 w-[280px] p-4 rounded-xl border cursor-pointer transition-all ${
              activeMatch?.id === m.id 
                ? 'bg-[rgba(255,255,255,0.05)] border-[var(--ikf-red)] shadow-[0_0_15px_rgba(200,16,46,0.2)]' 
                : 'bg-[var(--bg-card)] border-[var(--border-default)] hover:border-[rgba(255,255,255,0.2)]'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white text-sm">{t('match_number', settings.language).replace('#', '')} #{m.matchNumber}</span>
              <IKFBadge variant="live" label={`${t('mat', settings.language).toUpperCase()} ${m.matNumber}`} size="sm" />
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono mb-2">{formatMatchCategory(m.ageGroup, m.weightCategory, m.gender)} • {m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-[var(--ikf-red)] truncate flex-1">{m.redCornerName}</span>
              <span className="text-[var(--text-muted)]">vs</span>
              <span className="text-[var(--corner-blue)] truncate flex-1 text-right">{m.blueCornerName}</span>
            </div>
          </div>
        ))}
      </div>

      {!activeMatch ? (
        <div className="h-[500px] flex items-center justify-center border-2 border-dashed border-[var(--border-default)] rounded-2xl text-[var(--text-muted)]">
          <p className="text-xl font-medium tracking-widest uppercase">{t('select_match_to_begin', settings.language)}</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* MAIN CONTROL PANEL */}
          <div className="bg-[#050508] border-2 border-[var(--border-active)] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
            
            {/* MATCH BANNER */}
            <div className="bg-[var(--bg-elevated)] p-4 border-b border-[var(--border-active)] flex items-center justify-between">
              <div className="font-display text-2xl text-[var(--text-muted)] tracking-wider w-48">{t('match_number', settings.language).replace('#', '')} #{activeMatch.matchNumber}</div>
              <div className="flex-1 flex justify-center items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{t('red_corner', settings.language)}</div>
                  <div className="font-display text-3xl text-[var(--ikf-red)] leading-none">{activeMatch.redCornerName}</div>
                </div>
                <div className="text-[var(--text-muted)] font-bold text-sm bg-[var(--bg-card)] px-4 py-1 rounded border border-[var(--border-default)]">{t('vs', settings.language)}</div>
                <div className="text-left">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{t('blue_corner', settings.language)}</div>
                  <div className="font-display text-3xl text-[var(--corner-blue)] leading-none">{activeMatch.blueCornerName}</div>
                </div>
              </div>
              <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right w-48">
                {formatMatchCategory(activeMatch.ageGroup, activeMatch.weightCategory, activeMatch.gender)}
              </div>
            </div>

            <div className="flex flex-col xl:flex-row">
              {/* LEFT SCORE */}
              <div className="w-48 bg-[rgba(200,16,46,0.02)] border-r border-[var(--border-active)] flex flex-col justify-center items-center py-12">
                <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4">{t('red_score', settings.language)}</div>
                <div className="font-display text-[120px] leading-none text-[var(--ikf-red)] drop-shadow-[0_0_20px_rgba(200,16,46,0.4)]">
                  {redScore}
                </div>
              </div>

              {/* CENTER TIMER */}
              <div className="flex-1 flex flex-col items-center justify-center py-16 relative">
                
                <div className="absolute top-6 left-6 text-xs text-[var(--text-muted)] font-mono flex items-center gap-2">
                  <Info size={14} /> {t('rules', settings.language)} {maxTime / 60} {t('min_rounds', settings.language)} ({maxRounds} {t('total_rounds', settings.language)})
                </div>
                
                <div className="absolute top-6 right-6">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border shadow-lg ${
                    displayStatus === t('status_running', settings.language) ? "bg-[rgba(46,204,113,0.1)] text-[var(--status-win)] border-[var(--status-win)] animate-pulse" :
                    displayStatus === t('status_paused', settings.language) ? "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-default)]" :
                    displayStatus === t('status_wosk', settings.language) ? "bg-[rgba(200,16,46,0.1)] text-[var(--ikf-red)] border-[var(--ikf-red)]" :
                    displayStatus === t('status_medical', settings.language) ? "bg-[rgba(0,102,204,0.1)] text-[#0066cc] border-[#0066cc]" :
                    displayStatus === t('status_rest', settings.language) ? "bg-[rgba(212,160,23,0.1)] text-[var(--ikf-gold)] border-[var(--ikf-gold)]" :
                    "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]"
                  }`}>
                    {displayStatus}
                  </div>
                </div>

                {/* SVG ROUND INDICATOR */}
                <div className="relative flex items-center justify-center w-[360px] h-[360px]">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle 
                      cx="180" cy="180" r="120" 
                      fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" 
                    />
                    <circle 
                      cx="180" cy="180" r="120" 
                      fill="none" 
                      stroke={displayStatus === t('status_rest', settings.language) ? "var(--ikf-gold)" : displayStatus === t('status_medical', settings.language) ? "#0066cc" : "var(--ikf-red)"} 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={progressOffset}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>

                  <div className="text-center z-10 flex flex-col items-center">
                    {displayStatus === t('status_medical', settings.language) ? (
                      <>
                        <Activity size={48} className="text-[#0066cc] mb-4 animate-pulse" />
                        <div className="font-display text-4xl text-[#0066cc] tracking-widest">{t('medical_pause', settings.language)}</div>
                      </>
                    ) : displayStatus === t('status_wosk', settings.language) ? (
                      <>
                        <div className="text-sm font-bold text-[var(--ikf-red)] tracking-widest uppercase mb-2">
                          {t('passivity', settings.language)} ({woskCorner})
                        </div>
                        <div className="font-display text-[140px] leading-none text-white drop-shadow-[0_0_30px_rgba(200,16,46,0.6)] animate-pulse">
                          {formatTime(woskTimeLeft)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`text-sm font-bold tracking-widest uppercase mb-2 ${displayStatus === t('status_rest', settings.language) ? "text-[var(--ikf-gold)]" : "text-[var(--text-secondary)]"}`}>
                          {displayStatus === t('status_rest', settings.language) ? t('rest_period', settings.language) : `${t('round', settings.language)} ${currentRound} / ${maxRounds}`}
                        </div>
                        <div className={`font-display text-[140px] leading-none tracking-tight ${displayStatus === t('status_rest', settings.language) ? "text-[var(--ikf-gold)]" : "text-white"} drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]`}>
                          {formatTime(displayStatus === t('status_rest', settings.language) ? restTimeLeft : roundTimer)}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar under timer */}
                <div className="w-[80%] max-w-md h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full mt-8 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-linear ${displayStatus === t('status_rest', settings.language) ? "bg-[var(--ikf-gold)]" : displayStatus === t('status_medical', settings.language) ? "bg-[#0066cc]" : "bg-[var(--ikf-red)]"}`}
                    style={{ width: `${displayStatus === t('status_rest', settings.language) ? (restTimeLeft/60)*100 : displayStatus === t('status_medical', settings.language) ? 100 : (roundTimer/maxTime)*100}%` }}
                  />
                </div>
              </div>

              {/* RIGHT SCORE */}
              <div className="w-48 bg-[rgba(0,102,204,0.02)] border-l border-[var(--border-active)] flex flex-col justify-center items-center py-12">
                <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4">{t('blue_score', settings.language)}</div>
                <div className="font-display text-[120px] leading-none text-[var(--corner-blue)] drop-shadow-[0_0_20px_rgba(0,102,204,0.4)]">
                  {blueScore}
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="bg-[var(--bg-elevated)] p-8 border-t border-[var(--border-active)] space-y-6">
              
              {/* Row 1 - Primary Controls */}
              <div className="flex gap-4">
                <button 
                  onClick={timerMode === "medical" || (timerMode === "idle" && resumeMode) ? resumeTimer : startTimer}
                  disabled={displayStatus === t('status_running', settings.language) || timerMode === "rest" || currentRound > maxRounds}
                  className={`flex-1 h-20 rounded-xl font-display text-3xl tracking-wider flex items-center justify-center gap-4 transition-all ${
                    displayStatus === t('status_running', settings.language) ? 'bg-[var(--bg-card)] text-[var(--text-muted)] border-2 border-[var(--border-default)] cursor-not-allowed' : 
                    'bg-[var(--ikf-gold)] text-black hover:bg-[#b58814] hover:shadow-[0_0_20px_rgba(212,160,23,0.4)]'
                  }`}
                >
                  <Play size={32} fill="currentColor" /> {timerMode === "medical" || resumeMode ? "RESUME" : t('start', settings.language)}
                </button>
                <button 
                  onClick={pauseTimer}
                  disabled={displayStatus !== t('status_running', settings.language) && displayStatus !== t('status_wosk', settings.language) && displayStatus !== t('status_rest', settings.language) && displayStatus !== t('status_medical', settings.language)}
                  className="flex-1 h-20 bg-[var(--bg-card)] border-2 border-[var(--border-default)] hover:border-white rounded-xl font-display text-3xl tracking-wider text-white flex items-center justify-center gap-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pause size={32} fill="currentColor" /> {t('pause', settings.language)}
                </button>
                <button 
                  onClick={stopMatch}
                  className="flex-1 h-20 bg-[rgba(200,16,46,0.1)] border-2 border-[var(--ikf-red)] hover:bg-[var(--ikf-red)] rounded-xl font-display text-3xl tracking-wider text-[var(--ikf-red)] hover:text-white flex items-center justify-center gap-4 transition-all"
                >
                  <Square size={32} fill="currentColor" /> {t('stop_match', settings.language)}
                </button>
              </div>

              {/* Row 2 - Secondary Controls */}
              <div className="flex gap-4">
                <button 
                  onClick={() => triggerWosk("RED")}
                  disabled={displayStatus === t('status_medical', settings.language) || displayStatus === t('status_rest', settings.language) || displayStatus === t('status_idle', settings.language)}
                  className="flex-1 h-16 border-2 border-dashed border-[var(--ikf-red)] hover:bg-[rgba(200,16,46,0.1)] rounded-xl font-bold text-sm tracking-widest text-[var(--ikf-red)] flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                >
                  <AlertTriangle size={16} /> {t('wosk_stop_red', settings.language)}
                </button>
                <button 
                  onClick={() => triggerWosk("BLUE")}
                  disabled={displayStatus === t('status_medical', settings.language) || displayStatus === t('status_rest', settings.language) || displayStatus === t('status_idle', settings.language)}
                  className="flex-1 h-16 border-2 border-dashed border-[var(--corner-blue)] hover:bg-[rgba(0,102,204,0.1)] rounded-xl font-bold text-sm tracking-widest text-[var(--corner-blue)] flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                >
                  <AlertTriangle size={16} /> {t('wosk_stop_blue', settings.language)}
                </button>
                <button 
                  onClick={triggerMedical}
                  disabled={displayStatus === t('status_medical', settings.language) || displayStatus === t('status_rest', settings.language) || displayStatus === t('status_idle', settings.language)}
                  className="flex-1 h-16 border-2 border-dashed border-white hover:bg-[rgba(255,255,255,0.1)] rounded-xl font-bold text-sm tracking-widest text-white flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                >
                  <Activity size={16} /> {t('doctor', settings.language)}
                </button>
                <button 
                  onClick={endRound}
                  disabled={displayStatus === t('status_rest', settings.language) || displayStatus === t('status_medical', settings.language) || !activeMatch}
                  className="flex-1 h-16 bg-[rgba(212,160,23,0.1)] border-2 border-[var(--ikf-gold)] hover:bg-[var(--ikf-gold)] hover:text-black rounded-xl font-bold text-sm tracking-widest text-[var(--ikf-gold)] flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                >
                  <FastForward size={16} /> {t('end_round', settings.language)}
                </button>
              </div>

            </div>
          </div>

          {/* MATCH EVENT LOG */}
          <div className="space-y-4">
            <SectionDivider label={t('match_event_log', settings.language)} accent="gold" />
            <IKFCard padding="none" className="max-h-[300px] overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                {[...roundEvents].reverse().map((log) => (
                  <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <div className="font-mono text-sm text-[var(--text-muted)] w-24">
                      {formatDate(new Date(log.timestamp), "HH:mm:ss")}
                    </div>
                    {log.corner && (
                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${
                        log.corner === "RED" ? "border-[var(--ikf-red)] text-[var(--ikf-red)] bg-[rgba(200,16,46,0.1)]" : "border-[#0066cc] text-[#0066cc] bg-[rgba(0,102,204,0.1)]"
                      }`}>
                        {log.corner}
                      </div>
                    )}
                    <div className={`font-semibold text-sm ${
                      log.type === "yellow-card" || log.type === "red-card" ? "text-[var(--ikf-red)]" : 
                      log.type === "doctor" ? "text-[#0066cc]" : 
                      log.type === "match-end" ? "text-[var(--ikf-gold)]" : "text-white"
                    }`}>
                      {log.details}
                    </div>
                  </div>
                ))}
                {roundEvents.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">{t('no_events_logged', settings.language)}</div>
                )}
              </div>
            </IKFCard>
          </div>

        </div>
      )}
    </div>
  );
}
