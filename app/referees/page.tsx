/* eslint-disable */
"use client";

import React, { useMemo, useState } from "react";
import { Search, CheckCircle2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useTournamentStore } from "@/store/tournamentStore";
import { PageHeader, IKFCard, IKFButton, SectionDivider, IKFEmptyState, IKFBadge } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMatchNotifications, isMatchStartingSoon } from "@/hooks/useMatchNotifications";
import { UpcomingMatchAlert } from "@/components/UpcomingMatchAlert";

function toDateTimeLocal(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function RefereesPage() {
  const { referees, matches, assignRefereeToMatch, settings } = useTournamentStore();
  const upcomingMatches = useMatchNotifications();
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [timeByMatch, setTimeByMatch] = useState<Record<string, string>>({});
  const [centralByMatch, setCentralByMatch] = useState<Record<string, string>>({});
  const [judgesByMatch, setJudgesByMatch] = useState<Record<string, string[]>>({});

  const requiredJudgeCount = settings.defaultJudgesCount;

  const filteredReferees = useMemo(
    () => referees.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, referees]
  );

  const scheduledMatches = useMemo(() => matches
    .filter(m => m.status === "scheduled")
    .filter(m => !showOnlyUnassigned || !m.assignedRefereeId)
    .sort((a, b) => a.matchNumber - b.matchNumber),
  [matches, showOnlyUnassigned]);

  const assignedMatches = useMemo(() => matches
    .filter(m => m.assignedRefereeId)
    .sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime()),
  [matches]);

  const getRoleBadge = (role: string) => {
    if (role === "Chief Referee") return <span className="bg-[rgba(212,160,23,0.1)] text-[var(--ikf-gold)] border border-[var(--ikf-gold)] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('chief_referee', settings.language)}</span>;
    if (role === "Central Referee") return <span className="bg-[rgba(200,16,46,0.1)] text-[var(--ikf-red)] border border-[var(--ikf-red)] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('central_referee', settings.language)}</span>;
    return <span className="bg-[rgba(0,102,204,0.1)] text-[#0066cc] border border-[#0066cc] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('corner_judges', settings.language)}</span>;
  };

  const toggleJudge = (matchId: string, judgeId: string) => {
    const current = judgesByMatch[matchId] ?? [];
    if (current.includes(judgeId)) {
      setJudgesByMatch(prev => ({ ...prev, [matchId]: current.filter(id => id !== judgeId) }));
      return;
    }
    if (current.length >= requiredJudgeCount) {
      toast.error(`Select exactly ${requiredJudgeCount} corner judges`);
      return;
    }
    setJudgesByMatch(prev => ({ ...prev, [matchId]: [...current, judgeId] }));
  };

  const assignMatch = (matchId: string) => {
    const centralRefereeId = centralByMatch[matchId];
    const judgeIds = judgesByMatch[matchId] ?? [];
    if (!centralRefereeId) return toast.error("Central referee is required");
    if (judgeIds.length !== requiredJudgeCount) return toast.error(`Select exactly ${requiredJudgeCount} corner judges`);
    if (judgeIds.includes(centralRefereeId)) return toast.error("Central referee cannot also be a corner judge");
    const localTime = timeByMatch[matchId] || toDateTimeLocal();
    assignRefereeToMatch(matchId, centralRefereeId, judgeIds, new Date(localTime).toISOString());
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <UpcomingMatchAlert matches={upcomingMatches} />
      <PageHeader
        category={t('competition', settings.language)}
        title={t('referee_management', settings.language)}
        subtitle={t('referee_management_desc', settings.language)}
      />

      <SectionDivider label={t('referee_roster', settings.language)} accent="red" />
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder={t('search_referee', settings.language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl pl-12 pr-4 h-[48px] text-sm text-[var(--text-primary)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)] outline-none transition-all shadow-sm"
        />
      </div>

      <IKFCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <tr><th className="py-3 px-4">Name</th><th className="py-3 px-4">Role</th><th className="py-3 px-4">Country</th><th className="py-3 px-4">Grade</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Current</th></tr>
            </thead>
            <tbody>
              {filteredReferees.map(ref => (
                <tr key={ref.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)]">
                  <td className="py-3 px-4 font-bold text-white">{ref.name}</td>
                  <td className="py-3 px-4">{getRoleBadge(ref.role)}</td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{ref.country}</td>
                  <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{ref.grade}</td>
                  <td className="py-3 px-4"><IKFBadge variant={ref.status === "Available" ? "win" : ref.status === "In Match" ? "live" : "pending"} label={ref.status} size="sm" /></td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{ref.currentAssignment || t('none', settings.language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReferees.length === 0 && <IKFEmptyState title={t('no_referees_found', settings.language)} subtitle={t('adjust_search', settings.language)} actionLabel={t('clear_search', settings.language)} onAction={() => setSearchTerm("")} />}
        </div>
      </IKFCard>

      <SectionDivider label="MATCH ASSIGNMENT" accent="gold" />
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">Assign scheduled matches, set times, and mark officials as in match.</p>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={showOnlyUnassigned} onChange={e => setShowOnlyUnassigned(e.target.checked)} className="w-4 h-4 accent-[var(--ikf-red)]" />
          Show only unassigned matches
        </label>
      </div>

      <IKFCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <tr><th className="py-3 px-3">Match #</th><th className="py-3 px-3">Category</th><th className="py-3 px-3">Red vs Blue</th><th className="py-3 px-3">Mat</th><th className="py-3 px-3">Time</th><th className="py-3 px-3">Referee</th><th className="py-3 px-3">Judges</th><th className="py-3 px-3">Action</th></tr>
            </thead>
            <tbody>
              {scheduledMatches.map(match => {
                const selectedJudges = judgesByMatch[match.id] ?? match.assignedJudgeIds ?? [];
                const startingSoon = isMatchStartingSoon(match);
                const assigned = Boolean(match.assignedRefereeId);
                return (
                  <tr key={match.id} className={`border-b border-[rgba(255,255,255,0.04)] ${startingSoon ? 'bg-[rgba(200,16,46,0.18)]' : assigned ? 'bg-[rgba(46,204,113,0.08)]' : ''}`}>
                    <td className="py-3 px-3 font-mono text-white">#{match.matchNumber}{startingSoon && <div className="mt-1 text-[9px] text-[var(--ikf-gold)] font-bold flex items-center gap-1"><Clock size={10} /> STARTING SOON</div>}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{match.category}</td>
                    <td className="py-3 px-3"><span className="text-[var(--ikf-red)] font-bold">{match.redCornerName}</span><span className="text-[var(--text-muted)] mx-1">vs</span><span className="text-[var(--corner-blue)] font-bold">{match.blueCornerName}</span></td>
                    <td className="py-3 px-3 text-[var(--ikf-gold)] font-bold">{match.matNumber}</td>
                    <td className="py-3 px-3"><input type="datetime-local" value={timeByMatch[match.id] ?? toDateTimeLocal(match.scheduledTime)} onChange={e => setTimeByMatch(prev => ({ ...prev, [match.id]: e.target.value }))} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-white" /></td>
                    <td className="py-3 px-3"><select value={centralByMatch[match.id] ?? match.assignedRefereeId ?? ""} onChange={e => setCentralByMatch(prev => ({ ...prev, [match.id]: e.target.value }))} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-white"><option value="">Central Referee</option>{referees.filter(r => r.role === "Central Referee" && (r.status === "Available" || r.currentMatchId === match.id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                    <td className="py-3 px-3"><div className="flex flex-wrap gap-1 max-w-[280px]">{referees.filter(r => r.role === "Corner Judge" && (r.status === "Available" || r.currentMatchId === match.id)).map(r => <button type="button" key={r.id} onClick={() => toggleJudge(match.id, r.id)} className={`px-2 py-1 rounded border text-[10px] ${selectedJudges.includes(r.id) ? 'bg-[#0066cc]/20 border-[#0066cc] text-[#76b7ff]' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:text-white'}`}>{selectedJudges.includes(r.id) && <CheckCircle2 size={10} className="inline mr-1" />}{r.name}</button>)}</div><div className="mt-1 text-[10px] text-[var(--text-muted)]">{selectedJudges.length}/{requiredJudgeCount}</div></td>
                    <td className="py-3 px-3"><IKFButton size="sm" variant={assigned ? "secondary" : "primary"} onClick={() => assignMatch(match.id)}>{assigned ? "Update" : "Assign"}</IKFButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {scheduledMatches.length === 0 && <div className="p-8 text-center text-[var(--text-muted)]">No scheduled matches to assign.</div>}
        </div>
      </IKFCard>

      {assignedMatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase">{t('current_assignments', settings.language)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {assignedMatches.map(match => {
              const centralRef = referees.find(r => r.id === match.assignedRefereeId);
              const cornerRefs = match.assignedJudgeIds?.map(id => referees.find(r => r.id === id)?.name).filter(Boolean) ?? [];
              return <IKFCard key={match.id} padding="md"><div className="flex justify-between mb-2"><span className="font-bold text-white">Match #{match.matchNumber}</span><span className="text-[var(--ikf-gold)] font-mono">{match.scheduledTime ? format(new Date(match.scheduledTime), "HH:mm") : "TBD"}</span></div><div className="text-xs text-[var(--text-muted)] mb-2">{match.category} · Mat {match.matNumber}</div><div className="text-xs text-white">CR: {centralRef?.name ?? t('unknown', settings.language)}</div><div className="text-xs text-[var(--text-muted)]">CJ: {cornerRefs.join(", ") || t('none', settings.language)}</div></IKFCard>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
