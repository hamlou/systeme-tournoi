/* eslint-disable */
"use client";

import React, { useState, useEffect } from "react";
import { PageHeader, IKFCard, IKFInput, IKFSelect, IKFButton, SectionDivider } from "@/components/ui";
import { Save, Globe, Moon, Monitor, Clock, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useTournamentStore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  const { settings, updateSettings } = useTournamentStore();
  const [loading, setLoading] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  // Apply RTL effect if global language changes (after save)
  useEffect(() => {
    if (settings.language === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [settings.language]);

  const handleSave = () => {
    setLoading(true);
    // Update global store
    updateSettings(localSettings);
    
    setTimeout(() => {
      setLoading(false);
      toast.success("Tournament settings saved successfully");
    }, 500);
  };

  const handleChange = (field: keyof typeof settings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleDurationChange = (group: keyof typeof settings.roundDurations, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      roundDurations: { ...prev.roundDurations, [group]: Number(value) }
    }));
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category={t('management', settings.language)} 
        title={t('tournament_settings', settings.language)} 
        subtitle="Global platform configuration"
        actions={
          <IKFButton variant="primary" leftIcon={<Save size={16} />} loading={loading} onClick={handleSave}>
            {t('save_changes', settings.language)}
          </IKFButton>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* GENERAL SETTINGS */}
        <div className="space-y-6">
          <SectionDivider label={t('general_information', settings.language)} accent="red" />
          <IKFCard padding="lg" className="space-y-5">
            <IKFInput 
              label={t('tournament_name', settings.language)} 
              value={localSettings.tournamentName}
              onChange={(e) => handleChange('tournamentName', e.target.value)}
              placeholder="Enter official tournament name"
            />
            <div className="grid grid-cols-2 gap-4">
              <IKFInput 
                label={t('location_venue', settings.language)} 
                value={localSettings.venue}
                onChange={(e) => handleChange('venue', e.target.value)}
              />
              <IKFInput 
                label={t('start_date', settings.language)} 
                type="date" 
                value={localSettings.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
          </IKFCard>
        </div>

        {/* SYSTEM PREFERENCES */}
        <div className="space-y-6">
          <SectionDivider label={t('system_preferences', settings.language)} accent="gold" />
          <IKFCard padding="lg" className="space-y-5">
            <IKFSelect
              label={t('platform_language', settings.language)}
              value={localSettings.language}
              onChange={(e) => handleChange('language', e.target.value)}
              options={[
                { value: "en", label: "English (UI) / French (Official)" },
                { value: "fr", label: "Français (Strict)" },
                { value: "ar", label: "Arabic" },
              ]}
            />
            <IKFSelect
              label={t('ui_theme', settings.language)}
              defaultValue="dark"
              options={[
                { value: "dark", label: "IKF Dark Mode (Recommended)" },
                { value: "light", label: "Light Mode" },
                { value: "system", label: "System Default" },
              ]}
            />
            <IKFSelect
              label={t('tv_display_resolution_lock', settings.language)}
              defaultValue="1080p"
              options={[
                { value: "1080p", label: "1920x1080 (16:9) Strict" },
                { value: "auto", label: "Responsive (Auto-scale)" },
              ]}
            />
          </IKFCard>
        </div>

        {/* RULES & MATCH CONFIG */}
        <div className="space-y-6 xl:col-span-2">
          <SectionDivider label={t('competition_rules', settings.language)} accent="blue" />
          <IKFCard padding="lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="space-y-4 border-r border-[var(--border-default)] pr-6">
                <div className="flex items-center gap-2 mb-4 text-[var(--ikf-gold)]">
                  <ShieldCheck size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm">{t('judging_setup', settings.language)}</h3>
                </div>
                <IKFSelect
                  label={t('judges_per_match', settings.language)}
                  value={String(localSettings.defaultJudgesCount)}
                  onChange={(e) => handleChange('defaultJudgesCount', Number(e.target.value))}
                  options={[
                    { value: "3", label: "3 Judges (Standard)" },
                    { value: "5", label: "5 Judges (Finals Only)" },
                  ]}
                />
                <IKFSelect
                  label={t('scoring_system', settings.language)}
                  defaultValue="10-point"
                  options={[
                    { value: "10-point", label: "10-Point Must System" },
                    { value: "cumulative", label: "Cumulative Strike Count" },
                  ]}
                />
              </div>

              <div className="space-y-4 border-r border-[var(--border-default)] pr-6 pl-0 md:pl-6">
                <div className="flex items-center gap-2 mb-4 text-[var(--status-win)]">
                  <Clock size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm">{t('durations_senior', settings.language)}</h3>
                </div>
                <IKFInput 
                  label={t('round_duration_seconds', settings.language)} 
                  type="number" 
                  value={localSettings.roundDurations['Senior A']}
                  onChange={(e) => handleDurationChange('Senior A', e.target.value)}
                />
                <IKFInput 
                  label={t('rest_period_seconds', settings.language)} 
                  type="number" 
                  defaultValue={60} 
                />
              </div>

              <div className="space-y-4 pl-0 md:pl-6">
                <div className="flex items-center gap-2 mb-4 text-[var(--status-live)]">
                  <Clock size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm">{t('durations_kids', settings.language)}</h3>
                </div>
                <IKFInput 
                  label={t('round_duration_seconds', settings.language)} 
                  type="number" 
                  value={localSettings.roundDurations['U16']}
                  onChange={(e) => handleDurationChange('U16', e.target.value)}
                />
                <IKFInput 
                  label={t('rest_period_seconds', settings.language)} 
                  type="number" 
                  defaultValue={60} 
                />
              </div>

            </div>
          </IKFCard>
        </div>

      </div>
    </div>
  );
}

