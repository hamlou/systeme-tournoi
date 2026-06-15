/* eslint-disable */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Zap, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTournamentStore } from "@/store/tournamentStore";
import { IKFButton } from "@/components/ui";
import toast from "react-hot-toast";
import { t } from "@/lib/i18n";

export default function ChiefRefereeDashboard() {
  const { 
    activeMatch, matches, currentRound, judgeScores, referees, validateResult, overrideResult, settings, setActiveMatch
  } = useTournamentStore();

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideWinner, setOverrideWinner] = useState<"RED" | "BLUE">("RED");
  const [showResult, setShowResult] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  useEffect(() => {
    if (!activeMatch) {
      const nextMatch = matches.find(m => m.status === "in-progress") ?? matches.find(m => m.status === "scheduled");
      if (nextMatch) setActiveMatch({ ...nextMatch, status: nextMatch.status === "scheduled" ? "in-progress" : nextMatch.status });
    }
  }, [activeMatch, matches, setActiveMatch]);

  const activeJudgeScores = useMemo(() => {
    if (!activeMatch) return [];
    return judgeScores.filter(s => s.matchId === activeMatch.id);
  }, [judgeScores, activeMatch]);

  const aggregateTotals = useMemo(() => {
    let red = 0, blue = 0;
    activeJudgeScores.forEach(s => {
      if (s.submitted) {
        red += s.redScore;
        blue += s.blueScore;
      }
    });
    return { red, blue };
  }, [activeJudgeScores]);

  const matchWinner = activeMatch?.result?.winnerCorner || null;
  const matchEndReason = activeMatch?.result?.method || null;

  const computedWinner: "RED" | "BLUE" | null = matchWinner || (
    aggregateTotals.red > aggregateTotals.blue ? "RED" :
    aggregateTotals.blue > aggregateTotals.red ? "BLUE" : null
  );

  const assignedJudgeIds = activeMatch?.assignedJudgeIds || [];
  const expectedScores = assignedJudgeIds.length * (activeMatch?.totalRounds ?? 0);
  const submittedScores = activeJudgeScores.filter(s => s.submitted).length;
  const canValidate = Boolean(activeMatch) && activeMatch?.status !== "completed" && assignedJudgeIds.length > 0 && submittedScores >= expectedScores;

  const handleValidate = () => {
    if (!activeMatch) return;
    if (!canValidate) {
      toast.error(`Cannot validate yet: ${submittedScores}/${expectedScores || 0} required judge scores submitted.`);
      setShowReviewPanel(true);
      return;
    }
    validateResult(activeMatch.id, assignedJudgeIds);
    setShowResult(true);
  };

  const handleOverrideConfirm = () => {
    if (!activeMatch || !overrideReason.trim()) return;
    overrideResult(
      activeMatch.id,
      overrideWinner === "RED" ? activeMatch.redCornerId : activeMatch.blueCornerId,
      overrideWinner === "RED" ? activeMatch.redCornerName : activeMatch.blueCornerName,
      overrideWinner,
      overrideReason
    );
    setShowOverrideModal(false);
    setShowResult(true);
  };

  if (!activeMatch) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center text-[var(--text-muted)]">
        <p className="font-display text-4xl tracking-widest">{t('no_active_match_loaded', settings.language)}</p>
      </div>
    );
  }

  const assignedJudges = assignedJudgeIds.map(id => referees.find(r => r.id === id)).filter(Boolean) || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#050508] text-white overflow-hidden">

      {/* TOP BANNER */}
      <div className="bg-[var(--bg-elevated)] border-b-2 border-[var(--border-active)] py-5 px-8 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{t('chief_referee_dashboard', settings.language)}</div>
          <div className="font-display text-3xl text-white">{t('match_number', settings.language).replace('#', '')} #{activeMatch.matchNumber}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-[var(--text-muted)] mb-1">{activeMatch.category} • Mat {activeMatch.matNumber}</div>
          <div className="font-display text-5xl flex gap-16">
            <span className="text-[var(--ikf-red)]">{activeMatch.redCornerName}</span>
            <span className="text-[var(--text-muted)] text-3xl mt-3">vs</span>
            <span className="text-[var(--corner-blue)]">{activeMatch.blueCornerName}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{t('current_round_uc', settings.language)}</div>
          <div className="font-display text-5xl text-[var(--ikf-gold)]">{currentRound}</div>
        </div>
      </div>

      {/* JUDGE PANELS GRID */}
      <div className="flex-1 px-8 py-8">
        <div className={`grid gap-6 ${assignedJudges.length <= 3 ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {assignedJudges.map(judge => {
            if (!judge) return null;
            const currentScore = activeJudgeScores.find(s => s.judgeId === judge.id && s.round === currentRound);
            const isSubmitted = currentScore?.submitted;
            const judgeScoresForMatch = activeJudgeScores.filter(s => s.judgeId === judge.id);
            const redTotal = judgeScoresForMatch.reduce((acc, s) => acc + (s.submitted ? s.redScore : 0), 0);
            const blueTotal = judgeScoresForMatch.reduce((acc, s) => acc + (s.submitted ? s.blueScore : 0), 0);

            return (
              <div key={judge.id} className={`bg-[var(--bg-card)] rounded-2xl border-2 overflow-hidden transition-all ${isSubmitted ? 'border-[var(--status-win)] shadow-[0_0_20px_rgba(46,204,113,0.15)]' : 'border-[var(--border-default)]'}`}>
                {/* Judge Label */}
                <div className="bg-[var(--bg-elevated)] px-6 py-3 flex justify-between items-center border-b border-[var(--border-default)]">
                  <span className="font-bold text-sm tracking-widest uppercase text-white">{judge.name}</span>
                  {isSubmitted 
                    ? <CheckCircle2 size={20} className="text-[var(--status-win)]" />
                    : <Clock size={20} className="text-[var(--ikf-gold)] animate-pulse" />
                  }
                </div>

                {/* Current Round Score */}
                <div className="px-6 py-4 flex justify-around border-b border-[rgba(255,255,255,0.05)]">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-[var(--ikf-red)] tracking-widest uppercase mb-2">RED</div>
                    <div className="font-display text-5xl text-white">{isSubmitted ? currentScore?.redScore : "?"}</div>
                  </div>
                  <div className="text-[var(--text-muted)] self-center font-bold">–</div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-[var(--corner-blue)] tracking-widest uppercase mb-2">BLUE</div>
                    <div className="font-display text-5xl text-white">{isSubmitted ? currentScore?.blueScore : "?"}</div>
                  </div>
                </div>

                {/* Round History Scorecard */}
                <div className="px-4 py-4">
                  <div className="text-[9px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">{t('scorecard', settings.language)}</div>
                  <div className={`grid gap-1 text-center text-[10px] font-bold mb-1 text-[var(--text-muted)]`} style={{ gridTemplateColumns: `repeat(${activeMatch.totalRounds + 1}, minmax(0, 1fr))` }}>
                    {Array.from({ length: activeMatch.totalRounds }, (_, idx) => <div key={idx}>R{idx + 1}</div>)}<div>{t('tot', settings.language)}</div>
                  </div>
                  <div className="grid gap-1 text-center mb-1" style={{ gridTemplateColumns: `repeat(${activeMatch.totalRounds + 1}, minmax(0, 1fr))` }}>
                    {Array.from({ length: activeMatch.totalRounds }, (_, idx) => idx + 1).map(r => {
                      const s = judgeScoresForMatch.find(x => x.round === r);
                      return (
                        <div key={r} className={`rounded py-1 text-xs font-bold ${s?.submitted && s.redScore > s.blueScore ? 'bg-[var(--ikf-red)] text-white' : s?.submitted ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
                          {s?.submitted ? s.redScore : "—"}
                        </div>
                      );
                    })}
                    <div className="rounded py-1 text-xs font-bold bg-[rgba(200,16,46,0.2)] text-[var(--ikf-red)]">{redTotal}</div>
                  </div>
                  <div className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${activeMatch.totalRounds + 1}, minmax(0, 1fr))` }}>
                    {Array.from({ length: activeMatch.totalRounds }, (_, idx) => idx + 1).map(r => {
                      const s = judgeScoresForMatch.find(x => x.round === r);
                      return (
                        <div key={r} className={`rounded py-1 text-xs font-bold ${s?.submitted && s.blueScore > s.redScore ? 'bg-[var(--corner-blue)] text-white' : s?.submitted ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
                          {s?.submitted ? s.blueScore : "—"}
                        </div>
                      );
                    })}
                    <div className="rounded py-1 text-xs font-bold bg-[rgba(0,102,204,0.2)] text-[var(--corner-blue)]">{blueTotal}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AGGREGATE SCORE DISPLAY */}
        <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 flex items-center justify-between shadow-card">
          <div className="flex items-center gap-10">
            <div className="text-center">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{t('red_total', settings.language)}</div>
              <div className={`font-display text-[80px] leading-none transition-colors ${computedWinner === "RED" ? 'text-[var(--ikf-gold)] drop-shadow-[0_0_20px_rgba(212,160,23,0.6)]' : 'text-[var(--ikf-red)]'}`}>
                {aggregateTotals.red}
              </div>
              {computedWinner === "RED" && <div className="mt-2 text-xs font-bold tracking-widest text-[var(--ikf-gold)] uppercase animate-pulse">{t('leading', settings.language)}</div>}
            </div>

            <div className="text-center px-10">
              <div className="text-[var(--text-muted)] font-bold text-4xl">VS</div>
            </div>

            <div className="text-center">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{t('blue_total', settings.language)}</div>
              <div className={`font-display text-[80px] leading-none transition-colors ${computedWinner === "BLUE" ? 'text-[var(--ikf-gold)] drop-shadow-[0_0_20px_rgba(212,160,23,0.6)]' : 'text-[var(--corner-blue)]'}`}>
                {aggregateTotals.blue}
              </div>
              {computedWinner === "BLUE" && <div className="mt-2 text-xs font-bold tracking-widest text-[var(--ikf-gold)] uppercase animate-pulse">{t('leading', settings.language)}</div>}
            </div>
          </div>

          {/* Decision Controls */}
          <div className="flex flex-col gap-4 min-w-[280px]">
            <button 
              onClick={handleValidate}
              disabled={activeMatch.status === "completed" || !canValidate}
              className="h-16 w-full rounded-xl font-display text-2xl tracking-widest bg-[var(--ikf-gold)] text-black hover:bg-[#b58814] shadow-[0_0_20px_rgba(212,160,23,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {activeMatch.status === "completed" ? t('validated', settings.language) : t('validate_result', settings.language)}
            </button>
            <button 
              onClick={() => setShowReviewPanel(current => !current)}
              className="h-14 w-full rounded-xl font-bold text-sm tracking-widest bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-white text-white transition-all flex items-center justify-center gap-2"
            >
              <ClipboardList size={16} /> {t('review', settings.language)} {submittedScores}/{expectedScores || 0}
            </button>
            <button 
              onClick={() => setShowOverrideModal(true)}
              disabled={activeMatch.status === "completed"}
              className="h-14 w-full rounded-xl font-bold text-sm tracking-widest bg-[rgba(200,16,46,0.1)] border border-[var(--ikf-red)] text-[var(--ikf-red)] hover:bg-[var(--ikf-red)] hover:text-white transition-all disabled:opacity-40"
            >
              {t('override', settings.language)}
            </button>
          </div>
        </div>

        {showReviewPanel && (
          <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Validation readiness</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assignedJudges.map(judge => {
                if (!judge) return null;
                const count = activeJudgeScores.filter(s => s.judgeId === judge.id && s.submitted).length;
                const ready = count >= activeMatch.totalRounds;
                return (
                  <div key={judge.id} className={`rounded-xl border p-4 ${ready ? "border-[var(--status-win)] bg-[rgba(46,204,113,0.08)]" : "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.08)]"}`}>
                    <div className="font-bold text-white">{judge.name}</div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">{count}/{activeMatch.totalRounds} rounds submitted</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* OVERRIDE MODAL */}
      <AnimatePresence>
        {showOverrideModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <div className="bg-[var(--bg-card)] border-2 border-[var(--ikf-red)] rounded-3xl p-10 max-w-xl w-full shadow-[0_0_40px_rgba(200,16,46,0.2)]">
              <div className="flex items-center gap-4 mb-6">
                <AlertTriangle size={40} className="text-[var(--ikf-red)]" />
                <h2 className="font-display text-4xl text-white">{t('override_decision', settings.language)}</h2>
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-8">{t('override_warning', settings.language)}</p>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">{t('override_winner', settings.language)}</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setOverrideWinner("RED")}
                    className={`h-16 rounded-xl font-display text-2xl transition-all border-4 ${overrideWinner === "RED" ? 'bg-[var(--ikf-red)] border-[var(--ikf-red)] text-white' : 'border-[var(--border-default)] text-[var(--text-muted)]'}`}
                  >
                    {t('red_corner', settings.language)}
                  </button>
                  <button 
                    onClick={() => setOverrideWinner("BLUE")}
                    className={`h-16 rounded-xl font-display text-2xl transition-all border-4 ${overrideWinner === "BLUE" ? 'bg-[var(--corner-blue)] border-[var(--corner-blue)] text-white' : 'border-[var(--border-default)] text-[var(--text-muted)]'}`}
                  >
                    {t('blue_corner', settings.language)}
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">{t('reason_for_override', settings.language)}</label>
                <textarea 
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={t('enter_reason_placeholder', settings.language)}
                  className="w-full bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] focus:border-[var(--ikf-red)] rounded-xl p-4 text-white outline-none resize-none h-28 font-body text-sm transition-colors"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowOverrideModal(false)} className="flex-1 h-14 rounded-xl font-bold border-2 border-[var(--border-default)] text-white hover:bg-[rgba(255,255,255,0.05)] transition-all">
                  {t('cancel', settings.language)}
                </button>
                <button 
                  onClick={handleOverrideConfirm}
                  disabled={!overrideReason.trim()}
                  className="flex-1 h-14 rounded-xl font-bold bg-[var(--ikf-red)] text-white hover:bg-[#a80d29] disabled:opacity-40 transition-all"
                >
                  {t('confirm_override', settings.language)}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CINEMATIC RESULT MODAL */}
      <AnimatePresence>
        {showResult && computedWinner && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "radial-gradient(ellipse at center, #0a0000 0%, #000 100%)" }}
          >
            {/* Light beam animations */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i}
                  className="absolute bottom-0 left-1/2 w-[2px] opacity-20"
                  style={{
                    height: "120%",
                    background: `linear-gradient(to top, ${computedWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)"}, transparent)`,
                    transform: `translateX(-50%) rotate(${(i - 6) * 12}deg)`,
                    transformOrigin: "bottom center",
                    animation: `pulse-live ${1 + i * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>

            {/* Winner Strip */}
            <div 
              className="absolute top-0 left-0 right-0 h-3"
              style={{ background: computedWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)" }}
            />
            <div 
              className="absolute bottom-0 left-0 right-0 h-3"
              style={{ background: computedWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)" }}
            />

            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-center z-10 px-8"
            >
              <div className="flex items-center justify-center gap-4 mb-4">
                <Zap size={40} style={{ color: computedWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)" }} />
                <div className="text-sm font-bold text-[var(--text-muted)] tracking-[0.4em] uppercase">
                  {matchEndReason ? matchEndReason : t('by_decision', settings.language)}
                </div>
                <Zap size={40} style={{ color: computedWinner === "RED" ? "var(--ikf-red)" : "var(--corner-blue)" }} />
              </div>

              <div className="font-display text-[120px] leading-none tracking-widest text-white mb-2 drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                {t('winner', settings.language)}
              </div>

              <div 
                className="font-display text-[160px] leading-none tracking-wide drop-shadow-[0_0_60px_rgba(212,160,23,0.8)]"
                style={{ color: "var(--ikf-gold)" }}
              >
                {computedWinner === "RED" ? activeMatch.redCornerName : activeMatch.blueCornerName}
              </div>

              <div className="mt-6 text-3xl font-bold text-[var(--text-secondary)]">
                {t('score_label', settings.language)} {computedWinner === "RED" ? `${aggregateTotals.red} — ${aggregateTotals.blue}` : `${aggregateTotals.blue} — ${aggregateTotals.red}`}
              </div>

              <div className="mt-16 flex gap-6 justify-center">
                <button 
                  onClick={() => setShowResult(false)}
                  className="px-12 h-16 rounded-xl font-bold text-sm tracking-widest border-2 border-white text-white hover:bg-white hover:text-black transition-all"
                >
                  {t('close' as any, settings.language)}
                </button>
                <button 
                  onClick={() => {
                    toast.success("Result is ready on the TV display.");
                    setShowResult(false);
                  }}
                  className="px-12 h-16 rounded-xl font-display text-2xl tracking-widest bg-[var(--ikf-gold)] text-black hover:bg-[#b58814] shadow-[0_0_30px_rgba(212,160,23,0.4)] transition-all"
                >
                  {t('announce_result', settings.language)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

