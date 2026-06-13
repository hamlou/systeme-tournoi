/* eslint-disable */
"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Printer, Shuffle, Settings2, Trophy } from "lucide-react";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Match, Bracket } from "@/types/tournament";
import { PageHeader, IKFButton, IKFCard, IKFBadge, SectionDivider, IKFEmptyState } from "@/components/ui";
import toast from "react-hot-toast";
import { t } from "@/lib/i18n";

const FORMATS = ["Single Elimination"];

// --- Match Card Component ---
function MatchCard({ match }: { match: Match }) {
  const { settings } = useTournamentStore();
  const isRedWinner = match.result?.winnerCorner === "RED";
  const isBlueWinner = match.result?.winnerCorner === "BLUE";
  const redScore = match.result?.redTotalScore;
  const blueScore = match.result?.blueTotalScore;

  return (
    <div className="w-[220px] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg overflow-hidden flex flex-col shadow-card relative z-10">
      <div className="bg-[var(--bg-elevated)] p-2 flex justify-between items-center border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">
        <span>{t('mat', settings.language)} {match.matNumber} • {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>M#{match.matchNumber}</span>
      </div>
      
      {/* Red Corner */}
      <div className={`p-3 border-l-4 border-[var(--ikf-red)] border-b border-[var(--border-default)] flex justify-between items-center transition-colors ${isRedWinner ? 'bg-[rgba(200,16,46,0.1)]' : ''}`}>
        <span className={`font-semibold text-sm truncate pr-2 ${isBlueWinner ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>
          {match.redCornerName || <span className="text-[var(--text-muted)] italic">{t('tbd', settings.language)}</span>}
        </span>
        <div className="flex items-center gap-2">
          {isRedWinner && <Trophy size={14} className="text-[var(--ikf-gold)]" />}
          {redScore !== undefined && (
            <span className={`font-mono text-sm font-bold ${isRedWinner ? 'text-[var(--ikf-gold)]' : 'text-white'}`}>{redScore}</span>
          )}
        </div>
      </div>
      
      {/* Blue Corner */}
      <div className={`p-3 border-l-4 border-[var(--corner-blue)] flex justify-between items-center transition-colors ${isBlueWinner ? 'bg-[rgba(0,102,204,0.1)]' : ''}`}>
        <span className={`font-semibold text-sm truncate pr-2 ${isRedWinner ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>
          {match.blueCornerName || <span className="text-[var(--text-muted)] italic">{t('tbd', settings.language)}</span>}
        </span>
        <div className="flex items-center gap-2">
          {isBlueWinner && <Trophy size={14} className="text-[var(--ikf-gold)]" />}
          {blueScore !== undefined && (
            <span className={`font-mono text-sm font-bold ${isBlueWinner ? 'text-[var(--ikf-gold)]' : 'text-white'}`}>{blueScore}</span>
          )}
        </div>
      </div>

      {match.status !== "scheduled" && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2">
          <IKFBadge variant={match.status === "completed" ? "win" : "live"} label={match.status} size="sm" />
        </div>
      )}
    </div>
  );
}

// --- Bracket Lines SVG ---
function BracketLines() {
  const lineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1, 
      transition: { duration: 1.5 } 
    }
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: 800 }}>
      {/* QF to SF lines */}
      <motion.path d="M 220 90 L 250 90 L 250 170 L 280 170" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
      <motion.path d="M 220 250 L 250 250 L 250 170 L 280 170" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
      
      <motion.path d="M 220 410 L 250 410 L 250 490 L 280 490" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
      <motion.path d="M 220 570 L 250 570 L 250 490 L 280 490" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />

      {/* SF to Final lines */}
      <motion.path d="M 500 170 L 530 170 L 530 330 L 560 330" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
      <motion.path d="M 500 490 L 530 490 L 530 330 L 560 330" stroke="var(--border-default)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
      
      {/* Final to Winner */}
      <motion.path d="M 780 330 L 840 330" stroke="var(--ikf-gold)" strokeWidth="2" fill="none" variants={lineVariants} initial="hidden" animate="visible" />
    </svg>
  );
}

export default function BracketsPage() {
  const { brackets, matches, athletes, generateBracket, settings } = useTournamentStore();
  
  const uniqueCategories = useMemo(() => Array.from(new Set(athletes.filter(a => a.weighInStatus === 'Confirmed').map(a => `${a.weightCategory} ${a.ageGroup}`))), [athletes]);
  const [selectedCategory, setSelectedCategory] = useState(uniqueCategories[0] || "");
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[0]);

  const bracket = useMemo(() => brackets.find(b => b.categoryId === selectedCategory), [brackets, selectedCategory]);
  const bracketMatches = useMemo(() => matches.filter(m => bracket?.matchIds.includes(m.id)), [matches, bracket]);

  const qfMatches = bracketMatches.filter(m => m.round === "Quarterfinal");
  const sfMatches = bracketMatches.filter(m => m.round === "Semifinal");
  const finalMatch = bracketMatches.find(m => m.round === "Final");
  
  const champion = finalMatch?.result ? { name: finalMatch.result.winnerName } : null;

  const handleGenerate = () => {
    if (!selectedCategory) return;
    const categoryAthletes = athletes.filter(a => a.weighInStatus === 'Confirmed' && `${a.weightCategory} ${a.ageGroup}` === selectedCategory);
    if (categoryAthletes.length < 2) {
      toast.error(t('not_enough_athletes', settings.language).replace('{category}', selectedCategory));
      return;
    }
    if (bracket) {
      toast.error(t('bracket_already_exists', settings.language).replace('{category}', selectedCategory));
      return;
    }
    generateBracket(selectedCategory, selectedFormat, categoryAthletes);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category={t('competition', settings.language)}
        title={t('draw_brackets', settings.language).toUpperCase()}
        subtitle={t('draw_brackets_desc', settings.language)}
        actions={
          <div className="flex gap-3">
            <IKFButton variant="secondary" leftIcon={<Printer size={16} />} disabled={!bracket} onClick={() => window.print()}>{t('print_bracket', settings.language)}</IKFButton>
            <IKFButton variant="primary" leftIcon={<Settings2 size={16} />} disabled={!selectedCategory || Boolean(bracket)} onClick={handleGenerate}>{bracket ? 'Draw Exists' : t('generate_draw', settings.language)}</IKFButton>
          </div>
        }
      />

      {/* TOP CONTROLS */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 rounded-xl flex flex-wrap gap-6 items-center justify-between shadow-card">
        <div className="flex flex-wrap gap-4 flex-1">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)] min-w-[200px]"
          >
            {uniqueCategories.length === 0 && <option value="">No confirmed categories</option>}
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)] min-w-[200px]"
          >
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* BRACKET VISUAL */}
      <IKFCard padding="none" className="overflow-hidden min-h-[650px] relative bg-[var(--bg-primary)]">
        {bracket ? (
          <div className="p-8 overflow-x-auto h-full flex items-center relative" style={{ minWidth: 1000 }}>
            <BracketLines />
            
            <div className="flex gap-[60px] relative z-10 h-[600px] items-center">
              {/* Column 1: QF */}
              <div className="flex flex-col gap-[60px] justify-center w-[220px]">
                {qfMatches.map((m, i) => (
                  <MatchCard key={m.id || i} match={m} />
                ))}
              </div>
              
              {/* Column 2: SF */}
              <div className="flex flex-col gap-[220px] justify-center w-[220px]">
                {sfMatches.map((m, i) => (
                  <MatchCard key={m.id || i} match={m} />
                ))}
              </div>

              {/* Column 3: Final */}
              <div className="flex flex-col justify-center w-[220px]">
                {finalMatch && <MatchCard match={finalMatch} />}
              </div>

              {/* Column 4: Winner */}
              <div className="flex flex-col justify-center w-[200px] ml-6">
                <div className={`p-6 border-2 rounded-xl text-center shadow-[var(--shadow-gold-glow)] transition-all ${champion ? 'border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.1)]' : 'border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)]'}`}>
                  <Trophy size={48} className={`mx-auto mb-4 ${champion ? 'text-[var(--ikf-gold)]' : 'text-[var(--border-default)]'}`} />
                  <div className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-2">{t('champion', settings.language)}</div>
                  <div className={`font-display text-3xl leading-none ${champion ? 'text-white' : 'text-[var(--text-muted)]'}`}>
                    {champion ? champion.name : t('tbd', settings.language)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <IKFEmptyState 
              icon={<Settings2 size={48} />} 
              title={t('no_bracket_generated', settings.language)} 
              subtitle={t('select_category_to_generate', settings.language)} 
              actionLabel={t('generate_draw', settings.language)} 
              onAction={handleGenerate} 
            />
          </div>
        )}
      </IKFCard>
    </div>
  );
}

