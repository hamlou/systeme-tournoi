/* eslint-disable */
"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  FileText, ClipboardList, BarChart2, Trophy, Eye, Download,
  CheckCircle2, Calendar, Filter, ChevronRight, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { PageHeader, IKFButton, IKFCard, IKFBadge, SectionDivider } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";
import { t } from "@/lib/i18n";
import { formatMatchCategory } from "@/lib/ageCategories";
import { StoredJudgeScore, StoredJudgingEvent, useFirebaseJudgingData } from "@/hooks/useFirebaseJudgingSync";

// ── Types ──────────────────────────────────────────────────────────────────
type ReportType = "Match Report" | "Judge Scorecard" | "Table Official Report" | "Tournament Summary";
type ReportStatus = "Draft" | "Official" | "Exported";

interface Report {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: Date;
  status: ReportStatus;
  matchId?: string;
  matchNumber?: number;
  category?: string;
  mat?: string;
}

// ── Icon map ────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<ReportType, React.ReactNode> = {
  "Match Report": <FileText size={18} />,
  "Judge Scorecard": <ClipboardList size={18} />,
  "Table Official Report": <BarChart2 size={18} />,
  "Tournament Summary": <Trophy size={18} />,
};

// ── REPORT PREVIEW DOCUMENT ─────────────────────────────────────────────────
function normalizeAgeGroup(ageGroup?: string) {
  if (!ageGroup) return "—";
  if (["Mini", "Cadet", "Junior", "Senior"].includes(ageGroup)) return ageGroup;
  if (["Senior A", "Senior B", "Senior C"].includes(ageGroup)) return "Senior";
  if (["U16", "U18"].includes(ageGroup)) return "Junior";
  if (["U14"].includes(ageGroup)) return "Cadet";
  if (["U8", "U10", "U12"].includes(ageGroup)) return "Mini";
  return ageGroup;
}

function formatMethodEvent(event: { type: string; corner?: "RED" | "BLUE" }) {
  const labels: Record<string, string> = {
    decision: "Decision",
    "ko-tko": "KO / TKO",
    "ippon-result": "Ippon (Kids)",
    disqualification: "Disqualification",
    draw: "DRAW",
  };
  const corner = event.corner ? ` (${event.corner})` : "";
  return `${labels[event.type] ?? event.type}${corner}`;
}

function MatchReportDocument({
  report,
  databaseScores,
  databaseEvents,
}: {
  report: Report;
  databaseScores: StoredJudgeScore[];
  databaseEvents: StoredJudgingEvent[];
}) {
  const { matches, athletes, reports: storeReports, settings, referees, roundEvents } = useTournamentStore();
  const storeReport = storeReports.find(r => r.id === report.id || r.matchId === report.matchId);
  const match = storeReport?.matchData ?? matches.find(m => m.id === report.matchId);

  if (!match) return <div className="bg-white text-black p-10">No match data available for this report.</div>;

  const allJudgeScores = useTournamentStore.getState().judgeScores;

  // Merge scores from all sources, deduplicate by judgeId + round + matchId
  const allScoreSources = [
    ...databaseScores,
    ...(storeReport?.judgeScores ?? []),
    ...(match.result?.roundScores ?? []),
    ...allJudgeScores.filter(score => score.matchId === match.id),
  ] as any[];
  const scoreKey = (s: any) => `${s.judgeId}-${s.round}-${s.matchId ?? match.id}`;
  const seenScores = new Map<string, any>();
  for (const s of allScoreSources) {
    const key = scoreKey(s);
    if (!seenScores.has(key) || (s.submitted && !seenScores.get(key)?.submitted)) {
      seenScores.set(key, s);
    }
  }
  const matchScores = Array.from(seenScores.values()).filter(score => !('matchId' in score) || score.matchId === match.id);

  // Merge events from all sources, deduplicate by id
  const allEventSources = [
    ...databaseEvents,
    ...((storeReport?.events ?? []).filter((event: any) => event.details?.includes(`#${match.matchNumber}`) || event.details?.toLowerCase().includes(`match #${match.matchNumber}`))),
    ...roundEvents.filter((event: any) => event.details?.includes(`#${match.matchNumber}`) || event.details?.toLowerCase().includes(`match #${match.matchNumber}`)),
  ];
  const seenEvents = new Map<string, any>();
  for (const e of allEventSources) {
    const key = e.id ?? `${e.type}-${e.corner}-${e.timestamp}`;
    if (!seenEvents.has(key)) seenEvents.set(key, e);
  }
  const matchEvents = Array.from(seenEvents.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const redAthlete = athletes.find(a => a.id === match.redCornerId);
  const blueAthlete = athletes.find(a => a.id === match.blueCornerId);
  const centralReferee = referees.find(r => r.id === match.assignedRefereeId);
  const cornerJudgeRecords = match.assignedJudgeIds?.map(id => referees.find(r => r.id === id)).filter(Boolean) ?? [];
  const cornerJudges = cornerJudgeRecords.map(referee => referee!.name);
  const assignedOfficialRecords = [centralReferee, ...cornerJudgeRecords].filter(Boolean);
  const officialAgeGroup = normalizeAgeGroup(match.ageGroup);
  const generatedAt = report.generatedAt instanceof Date ? report.generatedAt : new Date(report.generatedAt);
  const validatedAt = match.result?.validatedAt ? new Date(match.result.validatedAt) : null;
  const submittedScores = matchScores.filter(score => score.submitted);
  const calculatedRedTotal = submittedScores.reduce((sum, score) => sum + score.redScore, 0);
  const calculatedBlueTotal = submittedScores.reduce((sum, score) => sum + score.blueScore, 0);
  const finalRedTotal = match.result?.redTotalScore ?? calculatedRedTotal;
  const finalBlueTotal = match.result?.blueTotalScore ?? calculatedBlueTotal;
  const liveMethodEvents = matchEvents.filter(event => ["decision", "ko-tko", "ippon-result", "disqualification", "draw"].includes(event.type));
  const officialRows = assignedOfficialRecords.map((official: any) => {
    const scores = submittedScores.filter(score => score.judgeId === official.id);
    const officialEvents = matchEvents.filter(event => (event as any).officialId === official.id || (event as any).officialName === official.name);
    const methodEvents = officialEvents.filter(event => ["decision", "ko-tko", "ippon-result", "disqualification", "draw"].includes(event.type));
    const redTotal = scores.reduce((sum, score) => sum + score.redScore, 0);
    const blueTotal = scores.reduce((sum, score) => sum + score.blueScore, 0);
    return {
      id: official.id,
      name: official.name,
      role: official.role,
      redTotal,
      blueTotal,
      yellowCards: officialEvents.filter(event => event.type === "yellow-card").length,
      redCards: officialEvents.filter(event => event.type === "red-card").length,
      deductions: officialEvents.filter(event => event.type === "deduction").length,
      warnings: officialEvents.filter(event => event.type === "yellow-card" || event.type === "wosk-stop").length,
      specialEvents: officialEvents.filter(event => ["ippon", "waza-ari", "yuko", "doctor"].includes(event.type)).length,
      actionCount: officialEvents.length,
      methodDecisions: methodEvents.map(formatMethodEvent).join(", ") || "None",
      decision: redTotal > blueTotal ? match.redCornerName : blueTotal > redTotal ? match.blueCornerName : scores.length ? "Draw" : "No score submitted",
      status: scores.length ? "Submitted" : "Pending",
    };
  });
  const officialActionEvents = matchEvents.filter(event => (event as any).officialId || (event as any).officialName);
  
  return (
    <div className="bg-white text-black p-10 min-h-[1100px] font-sans text-[13px] leading-relaxed" style={{ fontFamily: "Arial, sans-serif" }}>

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b-4 border-black">
        <div>
          <div className="text-2xl font-black tracking-tight uppercase">{t('ikf_kenshido', settings.language)}</div>
          <div className="text-xs text-gray-500 font-semibold tracking-wider mt-0.5">{t('ikf_division', settings.language)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black uppercase tracking-wider text-red-700 border border-red-700 px-3 py-1 rounded">{t('official_match_report', settings.language)}</div>
          <div className="text-xs text-gray-500 mt-1">{t('document', settings.language)} #{report.id.toUpperCase()} · {format(generatedAt, "dd/MM/yyyy HH:mm")}</div>
        </div>
      </div>

      {/* TOURNAMENT INFO */}
      <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('tournament' as any, settings.language)}</div>
          <div className="font-bold">{settings.tournamentName}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('venue', settings.language)}</div>
          <div className="font-bold">{settings.venue}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('date', settings.language)}</div>
          <div className="font-bold">{format(generatedAt, "MMMM d, yyyy")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('match_details', settings.language)}</div>
          <div className="font-bold">{t('match_number', settings.language).replace('#', '')} #{match.matchNumber} · {formatMatchCategory(match.ageGroup, match.weightCategory)} · {t('mat_uc', settings.language)} {match.matNumber} · {match.round}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('start_time', settings.language)}</div>
          <div className="font-bold">{match.scheduledTime ? new Date(match.scheduledTime).toLocaleTimeString() : "Not scheduled"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('end_time_duration', settings.language)}</div>
          <div className="font-bold">{validatedAt ? validatedAt.toLocaleTimeString() : "Pending"}</div>
        </div>
      </div>

      {/* FIGHTER TABLE */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('competitor_information', settings.language)}</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-800 text-white text-left px-4 py-2 w-1/4 text-[11px] uppercase tracking-wider">{t('field', settings.language)}</th>
              <th className="bg-red-700 text-white text-left px-4 py-2 text-[11px] uppercase tracking-wider">{t('red_corner', settings.language)}</th>
              <th className="bg-blue-700 text-white text-left px-4 py-2 text-[11px] uppercase tracking-wider">{t('blue_corner', settings.language)}</th>
            </tr>
          </thead>
          <tbody>
            {[
              [t('full_name', settings.language), match.redCornerName || "TBD", match.blueCornerName || "TBD"],
              [t('club', settings.language), redAthlete?.clubName ?? "—", blueAthlete?.clubName ?? "—"],
              [t('age_group', settings.language), officialAgeGroup, officialAgeGroup],
              [t('weight_category', settings.language), match.weightCategory, match.weightCategory],
            ].map(([field, red, blue], i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-2 font-semibold text-gray-500 border border-gray-200 text-[11px] uppercase tracking-wider">{field as string}</td>
                <td className="px-4 py-2 border border-gray-200">{red as string}</td>
                <td className="px-4 py-2 border border-gray-200">{blue as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ROUND-BY-ROUND SCORECARD */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('aggregate_scorecard', settings.language)}</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">{t('round', settings.language)}</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">{t('red_total', settings.language)}</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">{t('blue_total', settings.language)}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: match.totalRounds }, (_, idx) => idx + 1).map((r, i) => {
              const scores = matchScores.filter(s => s.round === r && s.submitted);
              const rAgg = scores.reduce((a, b) => a + b.redScore, 0);
              const bAgg = scores.reduce((a, b) => a + b.blueScore, 0);
              return (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border border-gray-200 font-semibold">{t('round', settings.language)} {r}</td>
                <td className="px-3 py-2 border border-gray-200 text-center text-red-700 font-bold">{rAgg}</td>
                <td className="px-3 py-2 border border-gray-200 text-center text-blue-700 font-bold">{bAgg}</td>
              </tr>
            )})}
            <tr className="bg-gray-900 text-white font-black">
              <td className="px-3 py-2 border border-gray-700 uppercase tracking-wider text-sm">{t('total', settings.language)}</td>
              <td className="px-3 py-2 border border-gray-700 text-center text-red-400">{finalRedTotal}</td>
              <td className="px-3 py-2 border border-gray-700 text-center text-blue-400">{finalBlueTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LIVE METHOD DECISIONS */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Live Method Decisions</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Method</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Corner</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Official</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody>
            {liveMethodEvents.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-3 border border-gray-200 text-gray-500">No live method decisions recorded yet.</td></tr>
            ) : liveMethodEvents.map((event, i) => (
              <tr key={event.id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border border-gray-200 font-bold">{formatMethodEvent(event)}</td>
                <td className="px-3 py-2 border border-gray-200">{event.corner ?? "DRAW"}</td>
                <td className="px-3 py-2 border border-gray-200">{(event as any).officialName ?? "Unknown official"}</td>
                <td className="px-3 py-2 border border-gray-200">{event.timestamp ? format(new Date(event.timestamp), "HH:mm:ss") : "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PER-OFFICIAL DECISIONS */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Per-Official Decisions, Cards, and Totals</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Official</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Role</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Red Total</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Blue Total</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Decision</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Method Clicks</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Cards</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Ded.</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Special</th>
              <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider">Actions</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {officialRows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-3 border border-gray-200 text-gray-500">No officials assigned for this match yet.</td></tr>
            ) : officialRows.map((row, i) => (
              <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border border-gray-200 font-semibold">{row.name}</td>
                <td className="px-3 py-2 border border-gray-200">{row.role}</td>
                <td className="px-3 py-2 border border-gray-200 text-center text-red-700 font-bold">{row.redTotal}</td>
                <td className="px-3 py-2 border border-gray-200 text-center text-blue-700 font-bold">{row.blueTotal}</td>
                <td className="px-3 py-2 border border-gray-200">{row.decision}</td>
                <td className="px-3 py-2 border border-gray-200">{row.methodDecisions}</td>
                <td className="px-3 py-2 border border-gray-200 text-center font-bold">Y:{row.yellowCards} / R:{row.redCards}</td>
                <td className="px-3 py-2 border border-gray-200 text-center font-bold">{row.deductions}</td>
                <td className="px-3 py-2 border border-gray-200 text-center font-bold">{row.specialEvents}</td>
                <td className="px-3 py-2 border border-gray-200 text-center font-bold">{row.actionCount}</td>
                <td className="px-3 py-2 border border-gray-200 uppercase text-[11px] font-bold">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PER-OFFICIAL ACTION LOG */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Per-Official Action Log</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Official</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Time</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Action</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Corner</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {officialActionEvents.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-3 border border-gray-200 text-gray-500">No referee/judge actions recorded for this match yet.</td></tr>
            ) : officialActionEvents.map((event, i) => (
              <tr key={(event as any).id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border border-gray-200 font-semibold">{(event as any).officialName ?? "Unknown official"}</td>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">{event.timestamp ? format(new Date(event.timestamp), "HH:mm:ss") : "Pending"}</td>
                <td className="px-3 py-2 border border-gray-200 font-semibold uppercase text-[11px]">{formatMethodEvent(event).replace(` (${event.corner})`, "")}</td>
                <td className="px-3 py-2 border border-gray-200">{event.corner ?? "—"}</td>
                <td className="px-3 py-2 border border-gray-200">{event.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OFFICIAL RESULT */}
      {match.result && (
        <div className="mb-6 border-2 border-black p-5 rounded mt-12">
          <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{t('official_result', settings.language)}</div>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-2xl font-black uppercase ${match.result.winnerCorner === "RED" ? "text-red-700" : "text-blue-700"}`}>
                {t('winner_colon', settings.language)} {match.result.winnerName}
              </div>
              <div className="text-base font-bold text-gray-700 mt-1">{match.result.winnerCorner === "RED" ? t('red_corner', settings.language) : t('blue_corner', settings.language)} · {t('method', settings.language)} {match.result.method}</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{finalRedTotal} <span className="text-gray-300">–</span> {finalBlueTotal}</div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">{t('red_blue_label', settings.language)}</div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT LOG */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Event Log</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Time</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Official</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Type</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {matchEvents.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-3 border border-gray-200 text-gray-500">No round events recorded for this report.</td></tr>
            ) : matchEvents.map((event, i) => (
              <tr key={event.id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">{format(new Date(event.timestamp), "HH:mm:ss")}</td>
                <td className="px-3 py-2 border border-gray-200">{(event as any).officialName ?? "Table / Round"}</td>
                <td className="px-3 py-2 border border-gray-200 font-semibold uppercase text-[11px]">{event.type}</td>
                <td className="px-3 py-2 border border-gray-200">{event.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OFFICIALS */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Assigned Officials</div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="bg-white">
              <td className="px-4 py-2 font-semibold text-gray-500 border border-gray-200 text-[11px] uppercase tracking-wider w-1/4">Central Referee</td>
              <td className="px-4 py-2 border border-gray-200 font-bold">{centralReferee?.name ?? "Unassigned"}</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-2 font-semibold text-gray-500 border border-gray-200 text-[11px] uppercase tracking-wider">Corner Judges</td>
              <td className="px-4 py-2 border border-gray-200 font-bold">{cornerJudges.length > 0 ? cornerJudges.join(", ") : "Unassigned"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SIGNATURES */}
      <div className="mt-8 pt-6 border-t border-gray-300">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-5">{t('official_signatures', settings.language)}</div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-8">
          {officialRows.length === 0 ? (
            <div>
              <div className="border-b border-black h-8 mb-1" />
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Assigned Official</div>
            </div>
          ) : officialRows.map((official) => (
            <div key={`sig-${official.id}`}>
              <div className="border-b border-black h-8 mb-1 flex items-end text-xs font-semibold">{official.name}</div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{official.role} Signature</div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-4">
          {t('document_footer', settings.language)} IKF Kenshido Division · Tunis 2026 · Doc #{report.id.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ── PAGE COMPONENT ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { matches, reports: storeReports, settings, updateReportStatus } = useTournamentStore();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [databaseScores, setDatabaseScores] = useState<StoredJudgeScore[]>([]);
  const [databaseEvents, setDatabaseEvents] = useState<StoredJudgingEvent[]>([]);

  useFirebaseJudgingData(selectedReport?.matchId ?? null, ({ scores, events }) => {
    setDatabaseScores(scores);
    setDatabaseEvents(events);
  });
  
  const generatedReports = useMemo<Report[]>(() => {
    const reportByMatch = new Map(storeReports.map(report => [report.matchId, report]));
    return matches.filter(m => m.status === "completed" || Boolean(m.assignedRefereeId) || (m.assignedJudgeIds?.length ?? 0) > 0).map(m => {
      const stored = reportByMatch.get(m.id);
      return {
        id: stored?.id ?? `mrep-${m.id}`,
        type: stored?.type ?? "Match Report",
        title: stored?.title ?? `${t('match_number', settings.language).replace('#', '')} #${m.matchNumber} — ${m.redCornerName} ${t('vs', settings.language)} ${m.blueCornerName}`,
        generatedAt: new Date(stored?.generatedAt ?? m.result?.validatedAt ?? m.scheduledTime ?? Date.now()),
        status: stored?.status === "Draft" && m.result ? "Official" : (stored?.status ?? (m.result ? "Official" : "Draft")),
        matchId: m.id,
        matchNumber: m.matchNumber,
        category: formatMatchCategory(m.ageGroup, m.weightCategory),
        mat: `Mat ${m.matNumber}`
      };
    });
  }, [matches, storeReports, settings.language]);

  const [reports, setReports] = useState<Report[]>(generatedReports);
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Sync state if reports/matches change without resetting exported status held locally.
  useEffect(() => {
    setReports(prev => {
      const previousById = new Map(prev.map(report => [report.id, report]));
      return generatedReports.map(report => ({ ...report, status: previousById.get(report.id)?.status ?? report.status }));
    });
  }, [generatedReports]);

  const filteredReports = reports.filter(r => {
    const typeMatches = typeFilter === "all" || r.type === typeFilter;
    const now = new Date();
    const generated = r.generatedAt instanceof Date ? r.generatedAt : new Date(r.generatedAt);
    const dateMatches = dateFilter === "today"
      ? generated.toDateString() === now.toDateString()
      : dateFilter === "week"
        ? now.getTime() - generated.getTime() <= 7 * 24 * 60 * 60 * 1000
        : true;
    return typeMatches && dateMatches;
  });

  const handleExportPDF = async () => {
    if (!selectedReport) {
      toast.error("Select a report before exporting.");
      return;
    }
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let posY = 0;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        while (remainingHeight > 0) {
          pdf.addImage(imgData, "PNG", 0, posY, pdfWidth, imgHeight);
          remainingHeight -= pdfHeight;
          posY -= pdfHeight;
          if (remainingHeight > 0) pdf.addPage();
        }
      }

      const filename = `IKF-Report-${selectedReport.id.toUpperCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(filename);
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: "Exported" } : r));
      updateReportStatus(selectedReport.id, "Exported");
      setSelectedReport(prev => prev ? { ...prev, status: "Exported" } : prev);
      toast.success(`PDF exported: ${filename}`);
    } catch (err) {
      toast.error("PDF export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const statusVariant = (s: ReportStatus): "win" | "upcoming" | "pending" =>
    s === "Official" ? "win" : s === "Exported" ? "upcoming" : "pending";

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader
        category={t('analytics' as any, settings.language)}
        title={t('instant_reports', settings.language).toUpperCase()}
        subtitle={t('auto_generated_reports', settings.language)}
        actions={
          <div className="flex gap-3">
            <IKFButton variant="secondary" leftIcon={<Download size={16} />} loading={isExporting} disabled={!selectedReport} onClick={handleExportPDF}>
              {t('export_pdf', settings.language)}
            </IKFButton>
          </div>
        }
      />

      {/* TOP FILTER BAR */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 flex flex-wrap gap-4 items-center shadow-card">
        <Filter size={16} className="text-[var(--text-muted)]" />

        {/* Date */}
        <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
          {["today", "week", "custom"].map(d => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${dateFilter === d ? "bg-[var(--ikf-red)] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              {d === "today" ? t('today', settings.language) : d === "week" ? t('this_week', settings.language) : t('custom', settings.language)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
          {["all", "Match Report", "Judge Scorecard", "Tournament Summary"].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${typeFilter === type ? "bg-[var(--ikf-gold)] text-black" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              {type === "all" ? "All" : type.replace(" Report", "")}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-[var(--text-muted)] font-mono">
          {filteredReports.length} {t('reports_count', settings.language)}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">

        {/* LEFT COLUMN — Reports List */}
        <div className="w-full xl:w-[40%] space-y-3">
          <SectionDivider label={t('generated_reports', settings.language)} accent="red" />

          <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredReports.length === 0 && (
              <div className="text-center p-8 text-[var(--text-muted)] border border-[var(--border-default)] rounded-xl border-dashed">
                {t('no_completed_match_reports', settings.language)}
              </div>
            )}
            {filteredReports.map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedReport?.id === report.id
                    ? "bg-[rgba(200,16,46,0.06)] border-[var(--ikf-red)] shadow-[0_0_15px_rgba(200,16,46,0.1)]"
                    : "bg-[var(--bg-card)] border-[var(--border-default)] hover:border-[rgba(255,255,255,0.15)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors ${
                  selectedReport?.id === report.id ? "bg-[rgba(200,16,46,0.15)] border-[var(--ikf-red)] text-[var(--ikf-red)]" : "bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-muted)] group-hover:text-white"
                }`}>
                  {TYPE_ICONS[report.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{report.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar size={11} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-mono text-[var(--text-muted)]">{format(report.generatedAt, "HH:mm · dd MMM")}</span>
                    <span className="text-[var(--border-default)]">·</span>
                    <span className="text-xs text-[var(--text-muted)]">{report.type}</span>
                  </div>
                </div>

                {/* Badge + Actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <IKFBadge variant={statusVariant(report.status)} label={t(report.status.toLowerCase() as any, settings.language) || report.status} size="sm" />
                </div>

                {selectedReport?.id === report.id && (
                  <ChevronRight size={16} className="text-[var(--ikf-red)] flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — Preview */}
        <div className="w-full xl:w-[60%] space-y-4">
          <SectionDivider label={t('report_preview', settings.language)} accent="gold" />

          {selectedReport ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl overflow-hidden shadow-card">
              {/* Preview toolbar */}
              <div className="bg-[var(--bg-elevated)] p-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[var(--ikf-red)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--ikf-gold)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--status-win)]" />
                  </div>
                  <span className="text-xs font-mono text-[var(--text-muted)]">{t('document_preview', settings.language)}{selectedReport.title}</span>
                </div>
                <IKFButton
                  variant="secondary"
                  size="sm"
                  leftIcon={isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  onClick={handleExportPDF}
                  loading={isExporting}
                >
                  {isExporting ? t('generating', settings.language) : t('export_pdf', settings.language)}
                </IKFButton>
              </div>

              {/* Scrollable document area */}
              <div className="overflow-y-auto max-h-[820px] custom-scrollbar">
                <div ref={previewRef}>
                  <MatchReportDocument report={selectedReport} databaseScores={databaseScores} databaseEvents={databaseEvents} />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-[var(--border-default)] rounded-xl text-[var(--text-muted)]">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">{t('select_report_to_preview', settings.language)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

