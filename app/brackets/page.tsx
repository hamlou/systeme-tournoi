/* eslint-disable */
"use client";

import React, { useState, useMemo } from "react";
import { Printer, Shuffle, Settings2 } from "lucide-react";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Match, Bracket, BracketFormat, BracketOptions, AgeGroup } from "@/types/tournament";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";
import { UpcomingMatchAlert } from "@/components/UpcomingMatchAlert";
import { PageHeader, IKFButton, IKFCard, IKFBadge, IKFEmptyState } from "@/components/ui";
import { SingleEliminationBracket } from "@/components/brackets/SingleEliminationBracket";
import { DoubleEliminationBracket } from "@/components/brackets/DoubleEliminationBracket";
import { RoundRobinGrid } from "@/components/brackets/RoundRobinGrid";
import { PoolEliminationBracket } from "@/components/brackets/PoolEliminationBracket";
import { TeamBracket } from "@/components/brackets/TeamBracket";
import { MatchDetailModal } from "@/components/brackets/MatchDetailModal";
import toast from "react-hot-toast";

const FORMATS: { value: BracketFormat; label: string; desc: string }[] = [
  { value: "single-elimination", label: "Single Elimination", desc: "Lose once and you're out. BYEs auto-assigned for non power-of-2 counts." },
  { value: "double-elimination", label: "Double Elimination", desc: "Winners & Losers brackets. Lose twice to be eliminated." },
  { value: "round-robin", label: "Round Robin", desc: "Everyone fights everyone once. Ranked by points." },
  { value: "pool-elimination", label: "Pool + Elimination", desc: "Round robin pools, then top 2 per pool enter a knockout." },
  { value: "team", label: "Team Tournament", desc: "Clubs face off; fighters matched by weight category." },
];

export default function BracketsPage() {
  const { brackets, matches, athletes, generateBracket, generateFightOrder, deleteBracket } = useTournamentStore();
  const upcomingMatches = useMatchNotifications();

  const ageOptions: { value: AgeGroup; label: string }[] = [
    { value: "Mini", label: "Mini (6-11 years)" },
    { value: "Cadet", label: "Cadet (12-14 years)" },
    { value: "Junior", label: "Junior (15-17 years)" },
    { value: "Senior", label: "Senior (18+ years)" },
  ];
  const confirmed = useMemo(() => athletes.filter(a => a.registrationStatus === "Active"), [athletes]);
  const uniqueWeights = useMemo(() => Array.from(new Set(confirmed.map(a => a.weightCategory))).sort(), [confirmed]);

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup | "">("Senior");
  const [selectedWeightCategory, setSelectedWeightCategory] = useState(uniqueWeights[0] || "");
  const selectedCategory = selectedAgeGroup && selectedWeightCategory ? `${selectedAgeGroup} ${selectedWeightCategory}` : "";
  const [selectedFormat, setSelectedFormat] = useState<BracketFormat>("single-elimination");
  const [printMode, setPrintMode] = useState(false);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [pendingRegen, setPendingRegen] = useState<Bracket | null>(null);

  // Options
  const [seeding, setSeeding] = useState(false);
  const [pointsForWin, setPointsForWin] = useState(3);
  const [pointsForDraw, setPointsForDraw] = useState(1);
  const [athletesPerPool, setAthletesPerPool] = useState(4);
  const [matchByWeight, setMatchByWeight] = useState(true);

  const formatInfo = FORMATS.find(f => f.value === selectedFormat)!;

  const bracket = useMemo(
    () => brackets.find(b => b.categoryId === selectedCategory),
    [brackets, selectedCategory]
  );
  const bracketMatches = useMemo(
    () => matches.filter(m => bracket?.matchIds.includes(m.id)),
    [matches, bracket]
  );
  const categoryAthletes = useMemo(
    () => confirmed.filter(a => (!selectedAgeGroup || a.ageGroup === selectedAgeGroup) && (!selectedWeightCategory || a.weightCategory === selectedWeightCategory)),
    [confirmed, selectedAgeGroup, selectedWeightCategory]
  );
  const fightOrderMatches = useMemo(
    () => matches.filter(m => m.round === "Fight Order" && m.ageGroup === selectedAgeGroup && m.weightCategory === selectedWeightCategory).sort((a, b) => a.matchNumber - b.matchNumber),
    [matches, selectedAgeGroup, selectedWeightCategory]
  );

  const buildOptions = (): BracketOptions => ({
    seeding, pointsForWin, pointsForDraw, athletesPerPool, matchByWeight,
  });

  const doGenerate = (format: BracketFormat) => {
    if (categoryAthletes.length < 2) {
      toast.error("Not enough athletes — need at least 2 athletes in this age and weight category");
      return;
    }
    if (format === "pool-elimination" && categoryAthletes.length < 8) {
      if (!window.confirm("Minimum 8 athletes recommended for Pool + Elimination format. Continue anyway?")) return;
    }
    generateBracket(selectedCategory, format, categoryAthletes, buildOptions());
  };

  const handleFightOrder = () => {
    if (!selectedAgeGroup || !selectedWeightCategory) {
      toast.error("Select both age and weight category first");
      return;
    }
    if (fightOrderMatches.length > 0 && !window.confirm("This will delete existing matches for this category. Continue?")) return;
    generateFightOrder(selectedAgeGroup, selectedWeightCategory);
  };

  const clearFilters = () => {
    setSelectedAgeGroup("");
    setSelectedWeightCategory("");
  };

  const handleGenerate = () => {
    if (!selectedCategory) return;
    if (bracket) {
      setPendingRegen(bracket);
      return;
    }
    doGenerate(selectedFormat);
  };

  const handleRandomize = () => {
    if (!bracket) { handleGenerate(); return; }
    setPendingRegen(bracket);
  };

  const confirmRegen = () => {
    if (!pendingRegen) return;
    deleteBracket(pendingRegen.id);
    const fmt = (pendingRegen.format as BracketFormat) ?? selectedFormat;
    // Defer generation so the delete is applied first.
    setTimeout(() => doGenerate(fmt), 0);
    setPendingRegen(null);
  };

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  const renderVisual = () => {
    if (!bracket) return null;
    switch (bracket.format) {
      case "single-elimination":
        return <SingleEliminationBracket matches={bracketMatches} onMatchClick={setDetailMatch} />;
      case "double-elimination":
        return <DoubleEliminationBracket bracket={bracket} matches={bracketMatches} onMatchClick={setDetailMatch} />;
      case "round-robin":
        return (
          <RoundRobinGrid
            athletes={categoryAthletes}
            matches={bracketMatches}
            standings={bracket.standings ?? []}
            onMatchClick={setDetailMatch}
          />
        );
      case "pool-elimination":
        return <PoolEliminationBracket bracket={bracket} matches={bracketMatches} athletes={athletes} onMatchClick={setDetailMatch} />;
      case "team":
        return <TeamBracket bracket={bracket} matches={bracketMatches} onMatchClick={setDetailMatch} />;
      default:
        return <div className="p-8 text-[var(--text-muted)]">Unknown format.</div>;
    }
  };

  return (
    <div className={`p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20 ${printMode ? "print-mode" : ""}`}>
      <UpcomingMatchAlert matches={upcomingMatches} />
      {detailMatch && <MatchDetailModal match={detailMatch} onClose={() => setDetailMatch(null)} />}

      {pendingRegen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-[var(--bg-card)] border border-[var(--ikf-red)] rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <h2 className="font-display text-2xl text-white mb-2">Bracket Already Exists</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">A bracket already exists for this category. Regenerating will delete all existing results. Continue?</p>
            <div className="flex gap-3">
              <button onClick={() => setPendingRegen(null)} className="flex-1 h-12 rounded-xl border-2 border-[var(--border-default)] text-white font-bold hover:bg-[rgba(255,255,255,0.05)] transition-all">Cancel</button>
              <button onClick={confirmRegen} className="flex-1 h-12 rounded-xl bg-[var(--ikf-red)] text-white font-bold hover:bg-[#a00d25] transition-all">Regenerate</button>
            </div>
          </div>
        </div>
      )}

      <div className="no-print">
        <PageHeader
          category="COMPETITION"
          title="DRAW & BRACKETS"
          subtitle="Generate and manage tournament brackets across all 5 IKF formats"
          actions={
            <div className="flex gap-3">
              <IKFButton variant="secondary" leftIcon={<Printer size={16} />} disabled={!bracket} onClick={handlePrint}>Print Bracket</IKFButton>
              <IKFButton variant="secondary" leftIcon={<Shuffle size={16} />} disabled={!selectedCategory} onClick={handleFightOrder}>Generate Fight Order</IKFButton>
              <IKFButton variant="secondary" leftIcon={<Shuffle size={16} />} disabled={!bracket} onClick={handleRandomize}>Randomize Seeds</IKFButton>
              <IKFButton variant="primary" leftIcon={<Settings2 size={16} />} disabled={!selectedCategory} onClick={handleGenerate}>Generate Draw</IKFButton>
            </div>
          }
        />
      </div>

      {/* CONTROLS */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-5 rounded-xl space-y-5 shadow-card no-print">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Age Category</label>
            <select value={selectedAgeGroup} onChange={e => setSelectedAgeGroup(e.target.value as AgeGroup | "")}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)]">
              <option value="">All ages</option>
              {ageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Weight Category</label>
            <select value={selectedWeightCategory} onChange={e => setSelectedWeightCategory(e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)]">
              <option value="">All weights</option>
              {uniqueWeights.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">{categoryAthletes.length} confirmed athletes{selectedAgeGroup || selectedWeightCategory ? ` in ${[selectedAgeGroup, selectedWeightCategory].filter(Boolean).join(" ")}` : ""}</p>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex justify-end mb-2"><button type="button" onClick={clearFilters} className="text-[10px] font-bold uppercase tracking-widest text-[var(--ikf-gold)] hover:text-white">Clear Filters</button></div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Format</label>
            <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value as BracketFormat)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)]">
              {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">{formatInfo.desc}</p>
          </div>
        </div>

        {/* Per-format options */}
        <div className="flex flex-wrap gap-6 items-center border-t border-[var(--border-default)] pt-4">
          {selectedFormat === "single-elimination" && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={seeding} onChange={e => setSeeding(e.target.checked)} className="w-4 h-4 accent-[var(--ikf-red)]" />
              Enable seeding (keep input order)
              <span className="text-[var(--text-muted)]">• BYE placement: auto</span>
            </label>
          )}
          {selectedFormat === "double-elimination" && (
            <span className="text-sm text-[var(--text-muted)]">No extra options for this format.</span>
          )}
          {selectedFormat === "round-robin" && (
            <>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">Points for win
                <input type="number" min={1} value={pointsForWin} onChange={e => setPointsForWin(Number(e.target.value) || 3)} className="w-16 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-white font-mono" />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">Points for draw
                <input type="number" min={0} value={pointsForDraw} onChange={e => setPointsForDraw(Number(e.target.value) || 0)} className="w-16 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-white font-mono" />
              </label>
            </>
          )}
          {selectedFormat === "pool-elimination" && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">Athletes per pool
              <select value={athletesPerPool} onChange={e => setAthletesPerPool(Number(e.target.value))} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-white">
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
          )}
          {selectedFormat === "team" && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={matchByWeight} onChange={e => setMatchByWeight(e.target.checked)} className="w-4 h-4 accent-[var(--ikf-red)]" />
              Match by weight category
            </label>
          )}
        </div>
      </div>

      {/* VISUAL */}
      <IKFCard padding="none" className="overflow-hidden min-h-[600px] relative bg-[var(--bg-primary)]">
        {bracket ? (
          <div className="bracket-print-area">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
              <div>
                <span className="font-display text-2xl text-white">{bracket.category}</span>
                <span className="text-[var(--text-muted)] text-sm ml-3">{FORMATS.find(f => f.value === bracket.format)?.label ?? bracket.format}</span>
              </div>
              <IKFBadge variant={bracket.status === "complete" ? "win" : "live"} label={bracket.status ?? "in-progress"} size="sm" />
            </div>
            {renderVisual()}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center no-print">
            <IKFEmptyState
              icon={<Settings2 size={48} />}
              title="No bracket generated"
              subtitle="Select a category and format, then generate the draw"
              actionLabel="Generate Draw"
              onAction={handleGenerate}
            />
          </div>
        )}
      </IKFCard>

      {fightOrderMatches.length > 0 && (
        <IKFCard padding="none" className="overflow-hidden bracket-print-area">
          <div className="p-4 border-b border-[var(--border-default)] font-display text-xl text-white">Fight Order</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]"><tr><th className="py-3 px-4">Match #</th><th className="py-3 px-4">Red Corner</th><th className="py-3 px-4">Blue Corner</th><th className="py-3 px-4">Mat</th><th className="py-3 px-4">Time</th><th className="py-3 px-4">Status</th></tr></thead>
              <tbody>{fightOrderMatches.map(m => <tr key={m.id} onClick={() => setDetailMatch(m)} className="border-b border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[rgba(200,16,46,0.06)]"><td className="py-3 px-4 font-mono text-[var(--text-muted)]">#{m.matchNumber}</td><td className="py-3 px-4 text-[var(--ikf-red)] font-bold">{m.redCornerName}</td><td className="py-3 px-4 text-[var(--corner-blue)] font-bold">{m.blueCornerName}</td><td className="py-3 px-4 text-[var(--text-muted)]">{m.matNumber}</td><td className="py-3 px-4 text-[var(--text-muted)] font-mono">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}</td><td className="py-3 px-4"><IKFBadge variant={m.status === "completed" ? "win" : m.status === "in-progress" ? "live" : "pending"} label={m.isBye ? "BYE" : m.status} size="sm" /></td></tr>)}</tbody>
            </table>
          </div>
        </IKFCard>
      )}

      {/* MATCH SCHEDULE */}
      {bracket && (
        <IKFCard padding="none" className="overflow-hidden bracket-print-area">
          <div className="p-4 border-b border-[var(--border-default)] font-display text-xl text-white">Match Schedule</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <tr>
                  <th className="py-3 px-4">Match #</th><th className="py-3 px-4">Round / Pool</th>
                  <th className="py-3 px-4">Red Fighter</th><th className="py-3 px-4">Blue Fighter</th>
                  <th className="py-3 px-4">Mat</th><th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status</th><th className="py-3 px-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...bracketMatches].sort((a, b) => a.matchNumber - b.matchNumber).map(m => (
                  <tr key={m.id} onClick={() => setDetailMatch(m)} className="border-b border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[rgba(200,16,46,0.06)]">
                    <td className="py-3 px-4 font-mono text-[var(--text-muted)]">#{m.matchNumber}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{m.round}</td>
                    <td className="py-3 px-4 text-white">{m.redCornerName}</td>
                    <td className="py-3 px-4 text-white">{m.blueCornerName}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">{m.matNumber}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-mono">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}</td>
                    <td className="py-3 px-4"><IKFBadge variant={m.status === "completed" ? "win" : m.status === "in-progress" ? "live" : "pending"} label={m.status} size="sm" /></td>
                    <td className="py-3 px-4 text-[var(--ikf-gold)]">{m.result ? m.result.winnerName : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </IKFCard>
      )}
    </div>
  );
}
