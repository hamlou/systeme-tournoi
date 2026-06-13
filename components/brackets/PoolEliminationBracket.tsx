"use client";

import React from "react";
import type { Bracket, Match, Athlete } from "@/types/tournament";
import { RoundRobinGrid } from "./RoundRobinGrid";
import { SingleEliminationBracket } from "./SingleEliminationBracket";

interface Props {
  bracket: Bracket;
  matches: Match[];
  athletes: Athlete[];
  onMatchClick: (m: Match) => void;
}

export function PoolEliminationBracket({ bracket, matches, athletes, onMatchClick }: Props) {
  const [tab, setTab] = React.useState<"pool" | "elim">("pool");
  const pools = bracket.pools ?? [];
  const elimMatchIds = new Set(bracket.eliminationMatches ?? []);
  const elimMatches = matches.filter(m => elimMatchIds.has(m.id));

  const poolMatchIds = new Set(pools.flatMap(p => p.matchIds));
  const remaining = matches.filter(m => poolMatchIds.has(m.id) && m.status !== "completed").length;

  return (
    <div className="p-6">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("pool")} className={`px-5 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${tab === "pool" ? "bg-[var(--ikf-red)] text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white"}`}>POOL STAGE</button>
        <button onClick={() => setTab("elim")} className={`px-5 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${tab === "elim" ? "bg-[var(--ikf-red)] text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white"}`}>ELIMINATION STAGE</button>
      </div>

      {tab === "pool" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {pools.map(pool => {
            const poolAthletes = athletes.filter(a => pool.athleteIds.includes(a.id));
            const poolMatches = matches.filter(m => pool.matchIds.includes(m.id));
            return (
              <div key={pool.id} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-3xl text-white tracking-wide">{pool.name}</h3>
                  {pool.complete && <span className="text-[10px] font-bold bg-[rgba(46,204,113,0.15)] text-[var(--status-win)] rounded px-2 py-1 tracking-widest">COMPLETE</span>}
                </div>
                <RoundRobinGrid athletes={poolAthletes} matches={poolMatches} standings={pool.standings} onMatchClick={onMatchClick} compact />
                <div className="mt-4 space-y-1">
                  {pool.standings.map((s, i) => (
                    <div key={s.athleteId} className="flex items-center justify-between text-sm py-1">
                      <span className="text-white"><span className="text-[var(--text-muted)] mr-2">{i + 1}.</span>{s.athleteName}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[var(--text-muted)]">{s.points} pts</span>
                        {i < 2 && <span className="text-[9px] font-bold bg-[rgba(212,160,23,0.15)] text-[var(--ikf-gold)] rounded px-2 py-0.5 tracking-widest">ADVANCES</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        bracket.eliminationUnlocked && elimMatches.length > 0 ? (
          <SingleEliminationBracket matches={elimMatches} onMatchClick={onMatchClick} />
        ) : (
          <div className="py-20 text-center">
            <div className="font-display text-3xl text-[var(--text-muted)] mb-2">Elimination stage locked</div>
            <p className="text-[var(--text-secondary)]">Pool stage incomplete — {remaining} match{remaining === 1 ? "" : "es"} remaining</p>
          </div>
        )
      )}
    </div>
  );
}

export default PoolEliminationBracket;
