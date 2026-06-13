/* eslint-disable */
"use client";

import React, { useState, useMemo } from "react";
import { Search, ScanLine, User, X, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, WeighinRecord, WeighinStatus } from "@/types/tournament";
import { PageHeader, IKFCard, IKFButton, IKFBadge, SectionDivider } from "@/components/ui";
import { t } from "@/lib/i18n";

const WEIGHT_CATEGORIES = ["-40kg", "-45kg", "-50kg", "-55kg", "-60kg", "-65kg", "-70kg", "-75kg", "-80kg", "-85kg", "-90kg", "+90kg"];

export default function WeighInPage() {
  const { athletes, weighinRecords: logs, addWeighinRecord: addLog, updateAthleteWeighinStatus, settings } = useTournamentStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentAthlete, setCurrentAthlete] = useState<Athlete | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [resultStatus, setResultStatus] = useState<"Confirmed" | "Borderline" | "Overweight" | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState("");

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return athletes.filter(a => 
      a.fullName.toLowerCase().includes(term) || 
      a.licenseNumber.toLowerCase().includes(term)
    ).slice(0, 5); // limit to 5
  }, [searchTerm, athletes]);

  const handleSelectAthlete = (athlete: Athlete) => {
    setCurrentAthlete(athlete);
    setSearchTerm("");
    setWeightValue("");
    setResultStatus(null);
    setResultMessage("");
    setSuggestedCategory("");
  };

  const getLimitFromCategory = (cat: string) => {
    const match = cat.match(/([+-])(\d+)kg/);
    if (!match) return null;
    return {
      sign: match[1],
      limit: parseInt(match[2], 10)
    };
  };

  const getNextCategory = (currentLimit: number) => {
    const index = WEIGHT_CATEGORIES.indexOf(`-${currentLimit}kg`);
    if (index !== -1 && index + 1 < WEIGHT_CATEGORIES.length) {
      return WEIGHT_CATEGORIES[index + 1];
    }
    return "+90kg";
  };

  const handleConfirmWeight = () => {
    if (!currentAthlete || !weightValue) return;
    
    let kgValue = parseFloat(weightValue);
    if (isNaN(kgValue)) return;

    if (unit === "lbs") {
      kgValue = kgValue * 0.453592;
    }

    const limitData = getLimitFromCategory(currentAthlete.weightCategory);
    if (!limitData) {
      toast.error("Invalid weight category setup");
      return;
    }

    let status: "Confirmed" | "Borderline" | "Overweight" = "Confirmed";
    let message = "";
    let nextCat = "";
    
    const displayWeight = kgValue.toFixed(1);

    if (limitData.sign === "-") {
      if (kgValue > limitData.limit) {
        status = "Overweight";
        message = `${displayWeight} kg — Exceeds category limit. Athlete cannot compete at -${limitData.limit}kg.`;
        nextCat = getNextCategory(limitData.limit);
      } else if (limitData.limit - kgValue <= 0.3) {
        status = "Borderline";
        message = `${displayWeight} kg — Within 0.3kg of limit. Reweigh recommended.`;
      } else {
        status = "Confirmed";
        message = `${displayWeight} kg — Within category limit (-${limitData.limit}kg). Athlete cleared.`;
      }
    } else {
      // +90kg logic
      if (kgValue < limitData.limit) {
        status = "Overweight"; 
        message = `${displayWeight} kg — Below minimum category limit. Athlete cannot compete at +${limitData.limit}kg.`;
      } else {
        status = "Confirmed";
        message = `${displayWeight} kg — Meets category minimum (+${limitData.limit}kg). Athlete cleared.`;
      }
    }

    setResultStatus(status);
    setResultMessage(message);
    setSuggestedCategory(nextCat);

    // If confirmed, automatically log it.
    if (status === "Confirmed" || status === "Borderline") {
      const logRecord: WeighinRecord = {
        id: uuidv4(),
        athleteId: currentAthlete.id,
        athleteName: currentAthlete.fullName,
        recordedWeight: parseFloat(displayWeight),
        registeredCategory: currentAthlete.weightCategory,
        assignedCategory: nextCat || currentAthlete.weightCategory,
        status: status === "Borderline" ? "Confirmed" : status,
        timestamp: new Date().toISOString(),
      };
      addLog(logRecord);
      updateAthleteWeighinStatus(currentAthlete.id, "Confirmed");
    } else if (status === "Overweight") {
      const logRecord: WeighinRecord = {
        id: uuidv4(),
        athleteId: currentAthlete.id,
        athleteName: currentAthlete.fullName,
        recordedWeight: parseFloat(displayWeight),
        registeredCategory: currentAthlete.weightCategory,
        assignedCategory: currentAthlete.weightCategory,
        status: "Overweight",
        timestamp: new Date().toISOString(),
      };
      addLog(logRecord);
      updateAthleteWeighinStatus(currentAthlete.id, "Overweight");
    }
  };

  const handleReassign = () => {
    if (!currentAthlete || !suggestedCategory) return;
    
    updateAthleteWeighinStatus(currentAthlete.id, "Pending", suggestedCategory);
    
    toast.success(`${currentAthlete.fullName} reassigned to ${suggestedCategory}`);
    
    const logRecord: WeighinRecord = {
        id: uuidv4(),
        athleteId: currentAthlete.id,
        athleteName: currentAthlete.fullName,
        recordedWeight: 0,
        registeredCategory: currentAthlete.weightCategory,
        assignedCategory: suggestedCategory,
        status: "Reassigned",
        timestamp: new Date().toISOString(),
    };
    addLog(logRecord);
    
    setResultStatus(null);
    setResultMessage("");
    setCurrentAthlete(null);
    setWeightValue("");
  };

  // Stats
  const totalLogs = logs.length;
  const confirmedLogs = logs.filter(l => l.status === "Confirmed").length;
  const overweightLogs = logs.filter(l => l.status === "Overweight").length;
  const reassignedLogs = logs.filter(l => l.status === "Reassigned").length;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category={t('competition', settings.language)}
        title={t('weigh_in_station', settings.language)}
        subtitle={t('weigh_in_station_desc', settings.language)}
      />

      {/* TOP ROW - Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder={t('search_athlete_weighin', settings.language)} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--bg-card)] border-2 border-[var(--border-default)] rounded-xl pl-14 pr-4 h-[56px] text-lg text-[var(--text-primary)] focus:border-[var(--ikf-red)] focus:ring-2 focus:ring-[rgba(200,16,46,0.2)] outline-none transition-all shadow-card"
          />
          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg shadow-2xl overflow-hidden z-50">
              {searchResults.map(a => (
                <div 
                  key={a.id} 
                  className="px-4 py-3 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer flex justify-between items-center border-b border-[var(--border-default)] last:border-0"
                  onClick={() => handleSelectAthlete(a)}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[var(--text-primary)]">{a.fullName}</span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{a.licenseNumber} • {a.clubName}</span>
                  </div>
                  <IKFBadge variant="pending" label={a.weightCategory} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsScannerOpen(true)}
          className="h-[56px] px-8 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] hover:border-[var(--ikf-gold)] rounded-xl flex items-center gap-3 text-[var(--text-primary)] font-semibold uppercase tracking-wider transition-all hover:bg-[rgba(212,160,23,0.05)] group shadow-card flex-shrink-0"
        >
          <ScanLine size={20} className="text-[var(--text-muted)] group-hover:text-[var(--ikf-gold)] transition-colors" />
          {t('scan_qr', settings.language)}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* LEFT PANEL - Current Athlete */}
        <div className="w-full xl:w-[60%] space-y-6">
          <SectionDivider label={t('current_athlete', settings.language)} accent="red" />
          
          <IKFCard padding="lg" className="min-h-[400px]">
            {currentAthlete ? (
              <div className="space-y-8 animate-fade-in">
                {/* Athlete Info */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-[var(--bg-primary)] border-4 border-[var(--border-default)] flex items-center justify-center flex-shrink-0">
                    <User size={40} className="text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="font-display text-5xl text-white mb-1 leading-none truncate">{currentAthlete.fullName}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                      <span className="font-mono">{currentAthlete.licenseNumber}</span>
                      <span>•</span>
                      <span>{currentAthlete.clubName}</span>
                      <span>•</span>
                      <span>{currentAthlete.country}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase mb-1">{t('registered_category', settings.language)}</div>
                    <div className="font-mono text-2xl text-[var(--ikf-red)] font-bold">{currentAthlete.weightCategory}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{currentAthlete.ageGroup}</div>
                  </div>
                </div>

                {/* Weight Entry */}
                <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] p-8 text-center relative overflow-hidden">
                  <label className="block text-sm font-semibold mb-6 text-[var(--text-secondary)] uppercase tracking-widest">{t('recorded_weight', settings.language)}</label>
                  
                  <div className="flex justify-center items-end gap-4 mb-8 relative z-10">
                    <input 
                      type="number" 
                      step="0.1"
                      value={weightValue}
                      onChange={(e) => setWeightValue(e.target.value)}
                      placeholder="0.0"
                      className="w-48 bg-transparent text-center font-display text-[80px] leading-none text-white border-b-4 border-[var(--ikf-red)] focus:outline-none focus:border-[var(--ikf-gold)] transition-colors placeholder:text-[rgba(255,255,255,0.1)]"
                    />
                    <div className="flex flex-col bg-[var(--bg-elevated)] rounded-lg p-1 border border-[var(--border-default)]">
                      <button 
                        onClick={() => setUnit("kg")}
                        className={`px-4 py-2 text-sm font-bold rounded ${unit === "kg" ? "bg-[var(--ikf-red)] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
                      >
                        KG
                      </button>
                      <button 
                        onClick={() => setUnit("lbs")}
                        className={`px-4 py-2 text-sm font-bold rounded ${unit === "lbs" ? "bg-[var(--ikf-red)] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
                      >
                        LBS
                      </button>
                    </div>
                  </div>

                  <div className="max-w-sm mx-auto relative z-10">
                    <IKFButton 
                      variant="primary" 
                      size="xl" 
                      className="w-full text-lg tracking-widest"
                      onClick={handleConfirmWeight}
                      disabled={!weightValue}
                    >
                      {t('confirm_weight', settings.language)}
                    </IKFButton>
                  </div>
                  
                  {/* Subtle background element */}
                  <div className="absolute -bottom-10 -right-10 opacity-[0.03] pointer-events-none">
                    <h1 className="font-display text-[200px] leading-none">{weightValue || "0.0"}</h1>
                  </div>
                </div>

                {/* Results Alert */}
                {resultStatus && (
                  <div className="animate-fade-in space-y-4">
                    <div className={`p-4 rounded-xl flex items-start gap-4 border-l-4 shadow-lg ${
                      resultStatus === "Confirmed" ? "bg-[rgba(46,204,113,0.1)] border-[var(--status-win)]" :
                      resultStatus === "Borderline" ? "bg-[rgba(212,160,23,0.1)] border-[var(--ikf-gold)]" :
                      "bg-[rgba(200,16,46,0.1)] border-[var(--ikf-red)]"
                    }`}>
                      {resultStatus === "Confirmed" ? <CheckCircle2 size={24} className="text-[var(--status-win)] flex-shrink-0 mt-0.5" /> :
                       resultStatus === "Borderline" ? <AlertTriangle size={24} className="text-[var(--ikf-gold)] flex-shrink-0 mt-0.5" /> :
                       <XCircle size={24} className="text-[var(--ikf-red)] flex-shrink-0 mt-0.5" />}
                      <div>
                        <h4 className={`font-bold mb-1 ${
                          resultStatus === "Confirmed" ? "text-[var(--status-win)]" :
                          resultStatus === "Borderline" ? "text-[var(--ikf-gold)]" :
                          "text-[var(--ikf-red)]"
                        }`}>{resultMessage}</h4>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          Weighed in at {format(new Date(), "HH:mm:ss — MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    {resultStatus === "Overweight" && suggestedCategory && (
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{t('next_available_category', settings.language)} <span className="font-mono text-[var(--ikf-gold)]">{suggestedCategory}</span></p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{t('reassign_question', settings.language)}</p>
                        </div>
                        <IKFButton variant="secondary" size="sm" onClick={handleReassign}>
                          {t('reassign_athlete', settings.language)}
                        </IKFButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50 py-20">
                <User size={64} className="mb-4" />
                <p className="text-lg font-medium">{t('search_athlete_to_begin', settings.language)}</p>
              </div>
            )}
          </IKFCard>
        </div>

        {/* RIGHT PANEL - Log */}
        <div className="w-full xl:w-[40%] space-y-6">
          <SectionDivider label={t('todays_weighin_log', settings.language)} accent="gold" />
          
          <IKFCard padding="none" className="overflow-hidden flex flex-col h-[700px]">
            <div className="bg-[var(--bg-primary)] p-4 border-b border-[var(--border-default)] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <span>{t('total', settings.language)} <span className="text-white">{totalLogs}</span></span>
              <span>{t('conf', settings.language)} <span className="text-[var(--status-win)]">{confirmedLogs}</span></span>
              <span>{t('over', settings.language)} <span className="text-[var(--ikf-red)]">{overweightLogs}</span></span>
              <span>{t('reass', settings.language)} <span className="text-[var(--ikf-gold)]">{reassignedLogs}</span></span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-primary)] transition-colors p-4 rounded-lg border border-[var(--border-default)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center font-mono text-xs font-bold text-white border border-[var(--border-default)] flex-shrink-0">
                    {log.recordedWeight}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white truncate text-sm">{log.athleteName}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mt-1 font-mono">
                      <span>{log.assignedCategory || log.registeredCategory}</span>
                      <span>•</span>
                      <span>{format(new Date(log.timestamp), "HH:mm")}</span>
                    </div>
                  </div>
                  <IKFBadge 
                    variant={log.status === "Confirmed" ? "win" : log.status === "Reassigned" ? "pending" : "loss"} 
                    label={log.status === "Confirmed" ? t('confirmed', settings.language) : log.status === "Reassigned" ? t('reassigned', settings.language) : log.status === "Overweight" ? t('overweight', settings.language) : log.status} 
                    size="sm" 
                  />
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  {t('no_weighin_records', settings.language)}
                </div>
              )}
            </div>
          </IKFCard>
        </div>
      </div>

      {/* QR Scanner Modal (Simulated) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden max-w-sm w-full mx-4 shadow-2xl">
            <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
              <h3 className="font-bold text-white uppercase tracking-wider">{t('scan_qr_code', settings.language)}</h3>
              <button onClick={() => setIsScannerOpen(false)} className="text-[var(--text-muted)] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 relative bg-[#050505]">
              {/* Fake camera viewport */}
              <div className="aspect-square border-2 border-dashed border-[var(--text-muted)] rounded-xl relative overflow-hidden flex items-center justify-center">
                <User size={48} className="text-[var(--text-muted)] opacity-20" />
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--status-win)] shadow-[0_0_15px_var(--status-win)] animate-scan" />
              </div>
              <p className="text-center text-sm text-[var(--text-muted)] mt-6">
                {t('scan_qr_desc', settings.language)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

