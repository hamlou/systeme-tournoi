/* eslint-disable */
"use client";

import React, { useState, useMemo } from "react";
import { Search, ShieldAlert, Calendar, CheckCircle2, Shield, AlertCircle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { useTournamentStore } from "@/store/tournamentStore";
import { PageHeader, IKFCard, IKFButton, SectionDivider, IKFEmptyState } from "@/components/ui";
import { format } from "date-fns";
import { t } from "@/lib/i18n";

const assignmentSchema = z.object({
  matchId: z.string().min(1, "Please select a match"),
  centralRefereeId: z.string().min(1, "Central referee is required"),
  cornerJudgeIds: z.array(z.string()).length(3, "Exactly 3 judges must be selected"),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function RefereesPage() {
  const { referees, matches, assignRefereeToMatch, settings } = useTournamentStore();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReferees = useMemo(() => {
    return referees.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, referees]);

  const stats = {
    total: referees.length,
    central: referees.filter(r => r.role === "Central Referee").length,
    corner: referees.filter(r => r.role === "Corner Judge").length,
    chief: referees.filter(r => r.role === "Chief Referee").length,
  };

  const upcomingMatches = useMemo(() => matches.filter(m => m.status === "scheduled").sort(
    (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  ), [matches]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { cornerJudgeIds: [] }
  });

  const selectedMatchId = watch("matchId");
  const selectedMatch = upcomingMatches.find(m => m.id === selectedMatchId);
  const selectedJudges = watch("cornerJudgeIds");

  const onSubmit = (data: AssignmentFormValues) => {
    assignRefereeToMatch(data.matchId, data.centralRefereeId, data.cornerJudgeIds);
    reset();
  };

  const toggleJudge = (id: string) => {
    if (selectedJudges.includes(id)) {
      setValue("cornerJudgeIds", selectedJudges.filter(jId => jId !== id), { shouldValidate: true });
    } else {
      if (selectedJudges.length < 3) {
        setValue("cornerJudgeIds", [...selectedJudges, id], { shouldValidate: true });
      } else {
        toast.error("You can only select 3 judges");
      }
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "Chief Referee") return <span className="bg-[rgba(212,160,23,0.1)] text-[var(--ikf-gold)] border border-[var(--ikf-gold)] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('chief_referee', settings.language)}</span>;
    if (role === "Central Referee") return <span className="bg-[rgba(200,16,46,0.1)] text-[var(--ikf-red)] border border-[var(--ikf-red)] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('central_referee', settings.language)}</span>;
    return <span className="bg-[rgba(0,102,204,0.1)] text-[#0066cc] border border-[#0066cc] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{t('corner_judges', settings.language)}</span>;
  };

  // Timeline (show all matches with assignments for today)
  const todayMatchesWithAssignments = matches
    .filter(m => m.assignedRefereeId)
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category={t('competition', settings.language)}
        title={t('referee_management', settings.language)}
        subtitle={t('referee_management_desc', settings.language)}
      />

      {/* TOP STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col justify-between shadow-card">
          <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase flex items-center gap-2">
            <Shield size={16} /> {t('total_referees', settings.language)}
          </div>
          <div className="font-display text-5xl text-white mt-4">{stats.total}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col justify-between shadow-card border-b-4 border-b-[var(--ikf-red)]">
          <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase flex items-center gap-2">
            <ShieldAlert size={16} className="text-[var(--ikf-red)]" /> {t('central_referees', settings.language)}
          </div>
          <div className="font-display text-5xl text-[var(--ikf-red)] mt-4">{stats.central}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col justify-between shadow-card border-b-4 border-b-[#0066cc]">
          <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#0066cc]" /> {t('corner_judges', settings.language)}
          </div>
          <div className="font-display text-5xl text-[#0066cc] mt-4">{stats.corner}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col justify-between shadow-card border-b-4 border-b-[var(--ikf-gold)]">
          <div className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase flex items-center gap-2">
            <TrophyIcon /> {t('chief_referee', settings.language)}
          </div>
          <div className="font-display text-5xl text-[var(--ikf-gold)] mt-4">{stats.chief}</div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        
        {/* LEFT COLUMN - Referee List */}
        <div className="w-full xl:w-1/2 space-y-6">
          <SectionDivider label={t('referee_roster', settings.language)} accent="red" />
          
          <div className="relative mb-6">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder={t('search_referee', settings.language)} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl pl-12 pr-4 h-[48px] text-sm text-[var(--text-primary)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)] outline-none transition-all shadow-sm"
            />
          </div>

          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredReferees.length === 0 ? (
              <IKFEmptyState 
                title={t('no_referees_found', settings.language)}
                subtitle={t('adjust_search', settings.language)}
                actionLabel={t('clear_search', settings.language)}
                onAction={() => setSearchTerm("")}
              />
            ) : (
              filteredReferees.map(ref => (
                <IKFCard key={ref.id} padding="md" className="group flex flex-col hover:border-[var(--border-active)] transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-white">{ref.name}</h3>
                      {getRoleBadge(ref.role)}
                    </div>
                    <div className="flex items-center gap-2 bg-[var(--bg-elevated)] px-2.5 py-1 rounded-full border border-[var(--border-default)]">
                      <div className={`w-2 h-2 rounded-full ${
                        ref.status === "Available" ? "bg-[var(--status-win)] shadow-[0_0_8px_var(--status-win)]" : 
                        ref.status === "In Match" ? "bg-[var(--ikf-red)] shadow-[0_0_8px_var(--ikf-red)]" : 
                        "bg-[var(--ikf-gold)] shadow-[0_0_8px_var(--ikf-gold)]"
                      }`} />
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{ref.status === 'Available' ? t('available', settings.language) : ref.status === 'In Match' ? t('in_match', settings.language) : ref.status}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] font-medium mb-4">
                    <span>{ref.country}</span>
                    <span>•</span>
                    <span className="font-mono text-[var(--text-muted)]">{ref.grade}</span>
                  </div>

                  <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-3 py-2 rounded mb-4">
                    <span className="font-bold text-[var(--text-primary)]">{t('current', settings.language)}</span> {ref.currentAssignment || t('none', settings.language)}
                  </div>
                </IKFCard>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Assignment Panel */}
        <div className="w-full xl:w-1/2 space-y-6">
          <SectionDivider label={t('match_assignments', settings.language)} accent="gold" />
          
          <IKFCard padding="lg">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">{t('select_match', settings.language)}</label>
                <Controller
                  name="matchId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`w-full bg-[var(--bg-elevated)] border rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors ${errors.matchId ? 'border-[var(--ikf-red)]' : 'border-[var(--border-default)]'}`}>
                      <option value="">{t('choose_upcoming_match', settings.language)}</option>
                      {upcomingMatches.map(m => <option key={m.id} value={m.id}>{t('match_number', settings.language).replace('#', '')} #{m.matchNumber} — {m.category}</option>)}
                    </select>
                  )}
                />
                {errors.matchId && <p className="text-[var(--ikf-red)] text-xs mt-1.5">{errors.matchId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">{t('central_referee', settings.language)}</label>
                <Controller
                  name="centralRefereeId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`w-full bg-[var(--bg-elevated)] border rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors ${errors.centralRefereeId ? 'border-[var(--ikf-red)]' : 'border-[var(--border-default)]'}`}>
                      <option value="">{t('choose_central_referee', settings.language)}</option>
                      {referees.filter(r => r.role === "Central Referee" && r.status === "Available").map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.country})</option>
                      ))}
                    </select>
                  )}
                />
                {errors.centralRefereeId && <p className="text-[var(--ikf-red)] text-xs mt-1.5">{errors.centralRefereeId.message}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('corner_judges', settings.language)}</label>
                  <span className={`text-xs font-bold ${selectedJudges.length === 3 ? 'text-[var(--status-win)]' : 'text-[var(--ikf-red)]'}`}>
                    {t('judges_selected', settings.language).replace('{count}', String(selectedJudges.length))}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {referees.filter(r => r.role === "Corner Judge").map(r => {
                    const isSelected = selectedJudges.includes(r.id);
                    const isDisabled = r.status !== "Available" && !isSelected;
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => !isDisabled && toggleJudge(r.id)}
                        className={`border rounded p-2 text-xs flex flex-col gap-1 transition-colors ${isDisabled ? 'opacity-40 cursor-not-allowed border-[var(--border-default)] bg-[var(--bg-card)]' : isSelected ? 'bg-[rgba(0,102,204,0.15)] border-[#0066cc] text-[#0066cc] cursor-pointer shadow-[0_0_10px_rgba(0,102,204,0.2)]' : 'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer hover:border-[rgba(255,255,255,0.2)]'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold">{r.name}</span>
                          {isSelected && <CheckCircle2 size={12} />}
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]">{r.country}</span>
                      </div>
                    );
                  })}
                </div>
                {errors.cornerJudgeIds && <p className="text-[var(--ikf-red)] text-xs mt-1.5">{errors.cornerJudgeIds.message}</p>}
              </div>

              <div className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-default)] p-4 rounded-lg">
                <AlertCircle size={20} className="text-[var(--text-muted)]" />
                <div className="text-sm">
                  <span className="text-[var(--text-muted)]">{t('target_mat', settings.language)} </span>
                  <span className="font-bold text-white font-mono">{selectedMatch ? `${t('mat', settings.language)} ${String(selectedMatch.matNumber).padStart(2, '0')}` : "—"}</span>
                </div>
              </div>

              <IKFButton type="submit" variant="primary" size="lg" className="w-full tracking-widest" disabled={upcomingMatches.length === 0}>
                {upcomingMatches.length === 0 ? t('no_matches_to_assign', settings.language) : t('confirm_assignment', settings.language)}
              </IKFButton>
            </form>
          </IKFCard>

          <div className="mt-8">
            <h3 className="text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4 pl-2">{t('current_assignments', settings.language)}</h3>
            <div className="relative pl-4 space-y-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border-default)]">
              {todayMatchesWithAssignments.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">{t('no_assignments_yet', settings.language)}</div>
              ) : todayMatchesWithAssignments.map((m, idx) => {
                const centralRef = referees.find(r => r.id === m.assignedRefereeId);
                const cornerRefs = m.assignedJudgeIds?.map(id => referees.find(r => r.id === id)?.name).filter(Boolean) || [];
                return (
                  <div key={m.id} className="relative pl-6">
                    {/* Timeline Dot */}
                    <div className="absolute left-[-5px] top-1.5 w-[12px] h-[12px] rounded-full shadow-[0_0_8px_var(--ikf-gold)] bg-[var(--ikf-gold)] text-[var(--ikf-gold)]" />
                    
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:border-[var(--border-active)] transition-colors">
                      <div className="font-mono text-xl font-bold text-[var(--text-primary)] min-w-[60px]">{format(new Date(m.scheduledTime), "HH:mm")}</div>
                      
                      <div className="flex-1">
                        <div className="font-bold text-sm text-white mb-1">{t('match_number', settings.language).replace('#', '')} #{m.matchNumber} — {m.category}</div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--ikf-gold)]">{t('mat', settings.language)} {String(m.matNumber).padStart(2, '0')}</div>
                      </div>

                      <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-2 text-xs min-w-[200px]">
                        <div className="mb-1 pb-1 border-b border-[rgba(255,255,255,0.05)]">
                          <span className="text-[var(--text-muted)] font-bold">{t('cr', settings.language)}</span> <span className="text-white">{centralRef?.name || t('unknown', settings.language)}</span>
                        </div>
                        <div className="text-[var(--text-muted)]">
                          <span className="font-bold">{t('cj', settings.language)}</span> {cornerRefs.join(", ") || t('none', settings.language)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ikf-gold)]">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
      <path d="M4 22h16"></path>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
  );
}

