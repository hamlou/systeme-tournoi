/* eslint-disable */
"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, User } from "lucide-react";
import { useTournamentStore } from "@/store/tournamentStore";
import { IKFBadge } from "@/components/ui";
import { t } from "@/lib/i18n";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function JudgeTabletView() {
  const { 
    activeMatch, currentRound, roundTimer, timerMode, 
    judgeScores, setJudgeScore, submitJudgeScore, referees, settings
  } = useTournamentStore();

  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Auto-select first assigned judge if none selected
    if (activeMatch?.assignedJudgeIds && !selectedJudgeId) {
      setSelectedJudgeId(activeMatch.assignedJudgeIds[0] || "");
    }
  }, [activeMatch, selectedJudgeId]);

  if (!activeMatch) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center text-[var(--text-muted)] flex-col gap-4">
        <AlertCircle size={48} className="text-[var(--text-muted)] opacity-50" />
        <p className="text-xl font-medium tracking-widest uppercase">{t('waiting_for_match_assignment', settings.language)}</p>
      </div>
    );
  }

  const judge = referees.find(r => r.id === selectedJudgeId);
  const isChildren = activeMatch.ageGroup.startsWith("U");

  const currentScore = judgeScores.find(s => s.matchId === activeMatch.id && s.round === currentRound && s.judgeId === selectedJudgeId) 
    || { redScore: 0, blueScore: 0, submitted: false };

  const handleSetScore = (red: number, blue: number) => {
    if (currentScore.submitted || !judge) return;
    setJudgeScore({
      matchId: activeMatch.id,
      judgeId: judge.id,
      judgeName: judge.name,
      round: currentRound,
      redScore: red,
      blueScore: blue,
      submitted: false,
    });
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
  };

  const handleSpecial = (type: "IPPON" | "WAZA_ARI" | "YUKO", corner: "RED" | "BLUE") => {
    // In a real system, Ippon might instantly submit and flag for chief referee.
    // For demo, we just give points.
    const pts = type === "IPPON" ? 10 : type === "WAZA_ARI" ? 2 : 1;
    const currentRed = currentScore.redScore || 10;
    const currentBlue = currentScore.blueScore || 10;
    if (corner === "RED") handleSetScore(currentRed + pts, currentBlue);
    else handleSetScore(currentRed, currentBlue + pts);
  };

  const handleDraw = () => handleSetScore(10, 10);

  const attemptSubmit = () => {
    if (currentScore.redScore === 0 && currentScore.blueScore === 0) return;
    setShowConfirm(true);
  };

  const confirmSubmit = () => {
    if (judge) {
      submitJudgeScore(judge.id, currentRound, currentScore.redScore, currentScore.blueScore, activeMatch.id, judge.name);
    }
    setShowConfirm(false);
  };

  const getCornerTotal = (corner: "RED" | "BLUE") => {
    return judgeScores
      .filter(s => s.matchId === activeMatch.id && s.judgeId === selectedJudgeId && s.submitted)
      .reduce((acc, s) => acc + (corner === "RED" ? s.redScore : s.blueScore), 0);
  };

  const isRedWinner = currentScore.redScore > currentScore.blueScore;
  const isBlueWinner = currentScore.blueScore > currentScore.redScore;

  return (
    <div className="flex flex-col h-screen text-white select-none bg-[#050508]">
      
      {/* TOP BAR */}
      <div className="bg-[var(--bg-elevated)] h-14 flex items-center justify-between px-6 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-4">
          <select 
            value={selectedJudgeId}
            onChange={e => setSelectedJudgeId(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-bold text-[var(--text-muted)] tracking-widest outline-none focus:border-white transition-colors"
          >
            <option value="" disabled>{t('select_judge_profile', settings.language)}</option>
            {activeMatch.assignedJudgeIds?.map(id => {
              const r = referees.find(x => x.id === id);
              return <option key={id} value={id}>{r?.name || id}</option>;
            })}
          </select>
        </div>
        <div className="text-sm font-semibold tracking-wider text-[var(--text-secondary)]">
          {t('match_number', settings.language).replace('#', '')} #{activeMatch.matchNumber} <span className="mx-2 text-[var(--text-muted)]">|</span> {activeMatch.category} <span className="mx-2 text-[var(--text-muted)]">|</span> {t('round', settings.language)} {currentRound}
        </div>
        <div className="flex items-center gap-4">
          <IKFBadge variant={timerMode === "round" ? "live" : "pending"} label={timerMode.toUpperCase()} size="sm" />
          <div className={`font-mono text-xl font-bold ${timerMode === "round" ? "text-[var(--status-win)] animate-pulse" : "text-white"}`}>
            {formatTime(roundTimer)}
          </div>
        </div>
      </div>

      {/* MAIN SCORING PANELS */}
      <div className="flex-1 flex">
        
        {/* RED CORNER */}
        <div className="flex-1 border-r-4 border-[#050508] bg-[rgba(200,16,46,0.05)] flex flex-col relative">
          <div className="p-8 border-b-2 border-[rgba(200,16,46,0.2)] text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(200,16,46,0.1)] to-transparent pointer-events-none" />
            <h2 className="font-display text-6xl text-[var(--ikf-red)] leading-none relative z-10">{activeMatch.redCornerName}</h2>
            <div className="mt-4 flex items-center justify-center gap-12 relative z-10">
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('round', settings.language)} {currentRound}</div>
                <div className="font-display text-[100px] leading-none text-white drop-shadow-[0_0_15px_rgba(200,16,46,0.5)]">
                  {currentScore.redScore || "-"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Total</div>
                <div className="font-display text-[60px] leading-none text-[var(--text-secondary)]">
                  {getCornerTotal("RED")}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col gap-4 justify-center">
            <button 
              onClick={() => handleWinRound("RED")}
              disabled={currentScore.submitted || !judge}
              className={`h-32 text-3xl font-display tracking-widest rounded-2xl transition-all border-4 ${
                isRedWinner 
                  ? "bg-[var(--ikf-red)] border-[var(--ikf-red)] text-white shadow-[0_0_30px_rgba(200,16,46,0.6)]" 
                  : "bg-[rgba(200,16,46,0.1)] border-[var(--ikf-red)] text-[var(--ikf-red)] hover:bg-[rgba(200,16,46,0.2)]"
              } disabled:opacity-50`}
            >
              {t('red_wins_round_10', settings.language)}
            </button>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="text-center col-span-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{t('deductions', settings.language)}</div>
              <button 
                onClick={() => handleDeduction(1, "RED")}
                disabled={currentScore.submitted || currentScore.redScore === 0 || !judge}
                className="h-16 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] hover:border-white rounded-xl text-lg font-bold text-white disabled:opacity-50 transition-colors"
              >
                {t('knockdown_1', settings.language)}
              </button>
              <button 
                onClick={() => handleDeduction(2, "RED")}
                disabled={currentScore.submitted || currentScore.redScore === 0 || !judge}
                className="h-16 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] hover:border-white rounded-xl text-lg font-bold text-white disabled:opacity-50 transition-colors"
              >
                {t('double_kd_2', settings.language)}
              </button>
            </div>

            {isChildren && (
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center col-span-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Special Results (Kids)</div>
                <button 
                  onClick={() => handleSpecial("IPPON", "RED")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[rgba(212,160,23,0.1)] border-2 border-[var(--ikf-gold)] hover:bg-[var(--ikf-gold)] hover:text-black rounded-xl text-sm font-bold text-[var(--ikf-gold)] transition-colors disabled:opacity-50"
                >
                  {t('ippon', settings.language)}
                </button>
                <button 
                  onClick={() => handleSpecial("WAZA_ARI", "RED")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-white rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                >
                  {t('waza_ari', settings.language)}
                </button>
                <button 
                  onClick={() => handleSpecial("YUKO", "RED")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-white rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                >
                  {t('yuko', settings.language)}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BLUE CORNER */}
        <div className="flex-1 border-l-4 border-[#050508] bg-[rgba(0,102,204,0.05)] flex flex-col relative">
          <div className="p-8 border-b-2 border-[rgba(0,102,204,0.2)] text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,102,204,0.1)] to-transparent pointer-events-none" />
            <h2 className="font-display text-6xl text-[var(--corner-blue)] leading-none relative z-10">{activeMatch.blueCornerName}</h2>
            <div className="mt-4 flex items-center justify-center gap-12 relative z-10">
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('total_rounds', settings.language)}</div>
                <div className="font-display text-[60px] leading-none text-[var(--text-secondary)]">
                  {getCornerTotal("BLUE")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('round', settings.language)} {currentRound}</div>
                <div className="font-display text-[100px] leading-none text-white drop-shadow-[0_0_15px_rgba(0,102,204,0.5)]">
                  {currentScore.blueScore || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col gap-4 justify-center">
            <button 
              onClick={() => handleWinRound("BLUE")}
              disabled={currentScore.submitted || !judge}
              className={`h-32 text-3xl font-display tracking-widest rounded-2xl transition-all border-4 ${
                isBlueWinner 
                  ? "bg-[var(--corner-blue)] border-[var(--corner-blue)] text-white shadow-[0_0_30px_rgba(0,102,204,0.6)]" 
                  : "bg-[rgba(0,102,204,0.1)] border-[var(--corner-blue)] text-[var(--corner-blue)] hover:bg-[rgba(0,102,204,0.2)]"
              } disabled:opacity-50`}
            >
              {t('blue_wins_round_10', settings.language)}
            </button>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="text-center col-span-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{t('deductions', settings.language)}</div>
              <button 
                onClick={() => handleDeduction(1, "BLUE")}
                disabled={currentScore.submitted || currentScore.blueScore === 0 || !judge}
                className="h-16 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] hover:border-white rounded-xl text-lg font-bold text-white disabled:opacity-50 transition-colors"
              >
                {t('knockdown_1', settings.language)}
              </button>
              <button 
                onClick={() => handleDeduction(2, "BLUE")}
                disabled={currentScore.submitted || currentScore.blueScore === 0 || !judge}
                className="h-16 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] hover:border-white rounded-xl text-lg font-bold text-white disabled:opacity-50 transition-colors"
              >
                {t('double_kd_2', settings.language)}
              </button>
            </div>

            {isChildren && (
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center col-span-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Special Results (Kids)</div>
                <button 
                  onClick={() => handleSpecial("IPPON", "BLUE")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[rgba(212,160,23,0.1)] border-2 border-[var(--ikf-gold)] hover:bg-[var(--ikf-gold)] hover:text-black rounded-xl text-sm font-bold text-[var(--ikf-gold)] transition-colors disabled:opacity-50"
                >
                  {t('ippon', settings.language)}
                </button>
                <button 
                  onClick={() => handleSpecial("WAZA_ARI", "BLUE")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-white rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                >
                  {t('waza_ari', settings.language)}
                </button>
                <button 
                  onClick={() => handleSpecial("YUKO", "BLUE")}
                  disabled={currentScore.submitted || !judge}
                  className="h-16 bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-white rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                >
                  {t('yuko', settings.language)}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CENTER ACTIONS */}
      <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
        <button 
          onClick={handleDraw}
          disabled={currentScore.submitted || !judge}
          className="w-24 h-24 rounded-full bg-[var(--bg-elevated)] border-4 border-[var(--border-default)] text-white font-display text-xl hover:border-white transition-all disabled:opacity-50 flex items-center justify-center shadow-xl"
        >
          {t('draw', settings.language)}
        </button>
      </div>

      <div className="absolute left-1/2 bottom-[150px] -translate-x-1/2 z-20">
        <button 
          onClick={attemptSubmit}
          disabled={currentScore.submitted || (currentScore.redScore === 0 && currentScore.blueScore === 0) || !judge}
          className="px-16 h-20 rounded-full font-display text-3xl tracking-widest bg-[var(--status-win)] text-black hover:bg-[#27ae60] shadow-[0_0_30px_rgba(46,204,113,0.4)] disabled:opacity-30 transition-all disabled:shadow-none flex items-center gap-4"
        >
          {currentScore.submitted ? <><CheckCircle2 /> {t('submitted', settings.language)}</> : t('submit_score', settings.language)}
        </button>
      </div>

      {/* ROUND SCORECARD */}
      <div className="h-[100px] bg-[var(--bg-card)] border-t border-[var(--border-default)] flex px-8 relative z-10">
        <div className="flex-1 flex flex-col justify-center gap-2 border-r border-[var(--border-default)] pr-8">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-[var(--ikf-red)]">RED ({activeMatch.redCornerName})</span>
            <span className="text-white text-lg">{getCornerTotal("RED")}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-[var(--corner-blue)]">BLUE ({activeMatch.blueCornerName})</span>
            <span className="text-white text-lg">{getCornerTotal("BLUE")}</span>
          </div>
        </div>
        
        <div className="flex-1 flex px-8 gap-8 items-center justify-around">
          {[1,2,3].map(round => {
            const s = judgeScores.find(x => x.matchId === activeMatch.id && x.round === round && x.judgeId === selectedJudgeId);
            return (
              <div key={round} className="flex flex-col gap-1 items-center">
                <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest mb-1">R{round}</div>
                <div className={`w-12 h-8 flex items-center justify-center font-bold text-sm rounded ${s?.submitted && s.redScore > s.blueScore ? 'bg-[var(--ikf-red)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {s?.submitted ? s.redScore : "-"}
                </div>
                <div className={`w-12 h-8 flex items-center justify-center font-bold text-sm rounded ${s?.submitted && s.blueScore > s.redScore ? 'bg-[var(--corner-blue)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {s?.submitted ? s.blueScore : "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONFIRMATION OVERLAY */}
      {showConfirm && currentScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-10 max-w-2xl w-full text-center shadow-2xl">
            <AlertCircle size={64} className="text-[var(--ikf-gold)] mx-auto mb-6" />
            <h2 className="font-display text-5xl mb-4 text-white">{t('confirm_round_score', settings.language).replace('{round}', String(currentRound))}</h2>
            
            <div className="flex justify-center items-center gap-12 my-10">
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--ikf-red)] tracking-widest uppercase mb-2">{t('red_corner', settings.language)}</div>
                <div className="font-display text-[80px] leading-none text-white">{currentScore.redScore}</div>
              </div>
              <div className="text-[var(--text-muted)] font-bold text-2xl">{t('vs', settings.language)}</div>
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--corner-blue)] tracking-widest uppercase mb-2">{t('blue_corner', settings.language)}</div>
                <div className="font-display text-[80px] leading-none text-white">{currentScore.blueScore}</div>
              </div>
            </div>

            <p className="text-xl font-bold text-[var(--text-secondary)] mb-10">
              {currentScore.redScore > currentScore.blueScore 
                ? t('red_corner_wins_round', settings.language)
                : currentScore.blueScore > currentScore.redScore 
                  ? t('blue_corner_wins_round', settings.language) 
                  : t('round_is_draw', settings.language)}
            </p>

            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 h-16 rounded-xl font-bold text-lg border-2 border-[var(--border-default)] text-white hover:bg-[rgba(255,255,255,0.05)] transition-all">
                {t('cancel', settings.language)}
              </button>
              <button onClick={confirmSubmit} className="flex-1 h-16 rounded-xl font-bold text-lg bg-[var(--status-win)] text-black hover:bg-[#27ae60] shadow-[0_0_20px_rgba(46,204,113,0.3)] transition-all">
                {t('confirm_and_submit', settings.language)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

