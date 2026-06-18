/* eslint-disable */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Brain, Info, Lightbulb, Search, Sparkles, TrendingUp } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader, IKFCard, SectionDivider, IKFBadge, IKFButton } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";
import { formatMatchCategory } from "@/lib/ageCategories";
import { StoredJudgeScore, StoredJudgingEvent, useFirebaseJudgingData } from "@/hooks/useFirebaseJudgingSync";
import { makeTableChiefOfficial, TABLE_CHIEF_LABEL } from "@/lib/officials";

const AI_METHOD_EVENT_TYPES = new Set([
  "decision",
  "ko",
  "tko",
  "ko-tko",
  "ippon",
  "ippon-result",
  "waza-ari",
  "yuko",
  "immobilisation",
  "disqualification",
  "doctor",
  "note",
  "draw",
]);
const AI_PRIORITY_EVENT_TYPES = new Set(["disqualification", "ko", "tko", "ko-tko", "ippon", "ippon-result", "draw", "decision"]);

function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));

    let animationId: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200, 16, 46, 0.15)";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(200, 16, 46, ${0.1 - dist / 1500})`;
            ctx.stroke();
          }
        }
      });
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

function ComparisonBar({ label, redVal, blueVal, redText, blueText }: any) {
  const total = redVal + blueVal || 1;
  const redPct = (redVal / total) * 100;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
        <span className="text-[var(--ikf-red)]">{redText}</span>
        <span>{label}</span>
        <span className="text-[var(--corner-blue)]">{blueText}</span>
      </div>
      <div className="h-2 w-full bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden flex">
        <div className="h-full bg-[var(--ikf-red)] transition-all duration-1000" style={{ width: `${redPct}%` }} />
        <div className="h-full bg-[var(--corner-blue)] transition-all duration-1000" style={{ width: `${100 - redPct}%` }} />
      </div>
    </div>
  );
}

function summarizeJudgeDecisions(judgeScores: any[], referees: any[]) {
  const byJudge = new Map<string, { judgeName: string; rounds: Array<{ round: any; redScore: any; blueScore: any }>; redRounds: number; blueRounds: number; draws: number }>();
  judgeScores.filter(score => score.submitted).forEach(score => {
    const existing = byJudge.get(score.judgeId) ?? { judgeName: score.judgeName ?? referees.find(r => r.id === score.judgeId)?.name ?? score.judgeId, rounds: [] as Array<{ round: any; redScore: any; blueScore: any }>, redRounds: 0, blueRounds: 0, draws: 0 };
    if (score.redScore > score.blueScore) existing.redRounds += 1;
    else if (score.blueScore > score.redScore) existing.blueRounds += 1;
    else existing.draws += 1;
    existing.rounds.push({ round: score.round, redScore: score.redScore, blueScore: score.blueScore });
    byJudge.set(score.judgeId, existing);
  });
  return Array.from(byJudge.values());
}

function summarizeEventCounts(events: any[]) {
  const count = (type: string, corner?: "RED" | "BLUE") =>
    events.filter(event => event.type === type && (!corner || event.corner === corner)).length;
  const methods = events.filter(event => AI_METHOD_EVENT_TYPES.has(event.type));
  return {
    red: {
      yellowCards: count("yellow-card", "RED"),
      redCards: count("red-card", "RED"),
      deductions: count("deduction", "RED"),
      ippon: count("ippon", "RED"),
      wazaAri: count("waza-ari", "RED"),
      yuko: count("yuko", "RED"),
    },
    blue: {
      yellowCards: count("yellow-card", "BLUE"),
      redCards: count("red-card", "BLUE"),
      deductions: count("deduction", "BLUE"),
      ippon: count("ippon", "BLUE"),
      wazaAri: count("waza-ari", "BLUE"),
      yuko: count("yuko", "BLUE"),
    },
    methods: methods.map(event => ({
      type: event.type,
      corner: event.corner ?? "DRAW",
      official: event.officialName ?? "Unknown official",
      details: event.details,
    })),
  };
}

function buildInstantReportSnapshot(match: any, judgeScores: any[], events: any[], officials: any) {
  const submitted = judgeScores.filter(score => score.submitted);
  const redTotal = submitted.reduce((sum, score) => sum + score.redScore, 0);
  const blueTotal = submitted.reduce((sum, score) => sum + score.blueScore, 0);
  const judgeBreakdown = summarizeJudgeDecisions(submitted, officials?.allReferees ?? []);
  const methodEvents = events.filter(event => AI_METHOD_EVENT_TYPES.has(event.type));
  const cardSummary = summarizeEventCounts(events);
  const lastPriorityMethod = [...methodEvents].reverse().find(event => AI_PRIORITY_EVENT_TYPES.has(event.type));

  let recommendedWinner: "RED" | "BLUE" | "DRAW" | "CANNOT_DETERMINE" = "CANNOT_DETERMINE";
  let recommendationReason = "Not enough submitted scorecards or decisive method events.";

  if (lastPriorityMethod?.type === "draw") {
    recommendedWinner = "DRAW";
    recommendationReason = "Latest decisive method event is DRAW.";
  } else if (lastPriorityMethod?.corner === "RED" || lastPriorityMethod?.corner === "BLUE") {
    recommendedWinner = lastPriorityMethod.corner;
    recommendationReason = `Latest decisive method event is ${lastPriorityMethod.type} for ${lastPriorityMethod.corner}.`;
  } else if (redTotal !== blueTotal && submitted.length > 0) {
    recommendedWinner = redTotal > blueTotal ? "RED" : "BLUE";
    recommendationReason = `Submitted score total favors ${recommendedWinner}: ${redTotal}-${blueTotal}.`;
  } else if (submitted.length > 0) {
    recommendedWinner = "DRAW";
    recommendationReason = `Submitted score total is level: ${redTotal}-${blueTotal}.`;
  }

  return {
    matchNumber: match.matchNumber,
    status: match.status,
    officialStoredResult: match.result ?? null,
    scoreTotals: { redTotal, blueTotal, submittedScorecards: submitted.length },
    judgeBreakdown,
    methodEvents,
    cardSummary,
    eventLog: events.map(event => ({
      time: event.timestamp,
      type: event.type,
      corner: event.corner ?? null,
      official: event.officialName ?? "Table / Round",
      details: event.details,
    })),
    recommendedWinner,
    recommendationReason,
    integrity: {
      expectedScorecards: match.assignedJudgeIds?.length ?? 0,
      totalRounds: match.totalRounds ?? 2,
      missingOfficials: [
        ...(match.assignedRefereeId ? [] : ["table chief"]),
        ...((match.assignedJudgeIds?.length ?? 0) === 0 ? ["corner judges"] : []),
      ],
    },
  };
}

function localFallbackAnalysis(match: any, judgeScores: any[], events: any[], referees: any[] = []) {
  const result = match.result;
  const snapshot = buildInstantReportSnapshot(match, judgeScores, events, { allReferees: referees });
  const winner = result?.winnerName ?? "No winner validated yet";
  const method = result?.method?.replace(/-/g, " ") ?? "pending decision";
  const scoreLine = result ? `${result.redTotalScore ?? 0}-${result.blueTotalScore ?? 0}` : "no official score yet";
  const eventTypes = events.map((event) => event.type).join(", ") || "no events recorded";
  const decisions = summarizeJudgeDecisions(judgeScores, referees);
  const judgeLine = decisions.length ? decisions.map(j => `${j.judgeName}: red rounds ${j.redRounds}, blue rounds ${j.blueRounds}, draws ${j.draws}`).join("; ") : "No submitted judge decisions yet";

  return `### AI Fallback Intelligence

**Match Summary:** ${match.redCornerName} vs ${match.blueCornerName} is ${match.status}. Outcome: **${winner}** by ${method}, score ${scoreLine}.

**Analytical Verdict:** Recommended winner from available instant-report data: **${snapshot.recommendedWinner}**. Reason: ${snapshot.recommendationReason}

**Fighter Signals:** Red total ${snapshot.scoreTotals.redTotal}; Blue total ${snapshot.scoreTotals.blueTotal}. Review method calls and discipline before final validation.

**Referee/Judge Decisions:** ${judgeLine}.

**Discipline and Method Factors:** Red cards ${snapshot.cardSummary.red.redCards}, red yellow cards ${snapshot.cardSummary.red.yellowCards}; Blue red cards ${snapshot.cardSummary.blue.redCards}, blue yellow cards ${snapshot.cardSummary.blue.yellowCards}; Method calls: ${snapshot.methodEvents.map((event: any) => `${event.type} ${event.corner ?? "DRAW"}`).join(", ") || "none"}.

**Integrity Checks:** Event pattern: ${eventTypes}. Confirm every submitted score belongs to this match and all assigned judges submitted each required round.

*Recommendation: Treat this as advisory intelligence only; official referee and chief validation remain authoritative.*`;
}

function localFighterFallbackAnalysis(match: any, corner: "RED" | "BLUE", fighter: any, judgeScores: any[], events: any[], referees: any[] = []) {
  const fighterName = corner === "RED" ? match.redCornerName : match.blueCornerName;
  const fighterEvents = events.filter(event => event.corner === corner);
  const yellow = fighterEvents.filter(event => event.type === "yellow-card").length;
  const red = fighterEvents.filter(event => event.type === "red-card").length;
  const deductions = fighterEvents.filter(event => event.type === "deduction").length;
  const submitted = judgeScores.filter(score => score.submitted);
  const roundsWon = submitted.filter(score => corner === "RED" ? score.redScore > score.blueScore : score.blueScore > score.redScore).length;
  const roundsLost = submitted.filter(score => corner === "RED" ? score.blueScore > score.redScore : score.redScore > score.blueScore).length;
  const profile = fighter ? `${fighter.fullName}, ${fighter.clubName ?? "no club"}, ${fighter.country ?? "no country"}` : fighterName;

  return `### Player AI Fallback Report - ${fighterName}

**Profile:** ${profile}

**Performance:** Submitted judging data currently gives this athlete ${roundsWon} round signals won and ${roundsLost} round signals lost.

**Cards and Events:** Yellow cards: ${yellow}. Red cards: ${red}. Deductions: ${deductions}. Recorded events: ${fighterEvents.map(event => event.type).join(", ") || "none"}.

**Judging Read:** ${summarizeJudgeDecisions(judgeScores, referees).map(j => `${j.judgeName}: red ${j.redRounds}, blue ${j.blueRounds}, draws ${j.draws}`).join("; ") || "No submitted scorecards yet."}

**Integrity Note:** This report only uses saved tournament data for Match #${match.matchNumber}; no performance details are invented.`;
}

function buildPrompt(match: any, judgeScores: any[], events: any[], tournamentStats: any, fighters: any, officials: any) {
  const eventSummary = summarizeEventCounts(events);
  const decisionSummary = summarizeJudgeDecisions(judgeScores, officials?.allReferees ?? []);
  const instantReportSnapshot = buildInstantReportSnapshot(match, judgeScores, events, officials);
  return `You are the IKF Kenshido Table Chief Fight Analyst. Your output must feel like serious "ta7lil": sharp, reasoned, and useful to a table chief, not a boring copy of the instant report.

Core mission:
Analyze the match as if you are reviewing the official Instant Report after the bout. Give a clear analytical verdict, explain why, expose contradictions, and state what the table chief should verify before the result is validated.

Hard rules:
- Do not copy the event log. Interpret it.
- Do not paraphrase the instant report. Use it as evidence, then produce an expert opinion.
- Aggregate repeated events: write "2 yellow cards", never "yellow card, yellow card".
- Treat KO/TKO, Ippon, under-14 actions (immobilisation, Waza-ari, Yuko), Disqualification, DRAW, 10/9/8/7 point entries, red cards, yellow cards, deductions, warnings, notes, and judge submissions as meaningful decision factors.
- A disqualification or red-card pattern can outweigh points if the data supports it. Explain that explicitly.
- If the official/stored result is missing, still recommend who appears to deserve the win based only on the provided data.
- If the stored result conflicts with the data, say so clearly and explain which evidence is stronger.
- If data is incomplete, do not invent missing rounds, strikes, dominance, or behavior. Say what is missing and how it affects confidence.
- Use names, totals, card counts, judge names, and method calls. Avoid generic sports talk.
- Give a confidence level: High, Medium, Low, or Cannot determine.
- Be decisive when the data supports it; be transparent when it does not.
- Every verdict must answer the direct question: who deserves the win, and why?

Decision logic priority:
1. Disqualification / red-card decisive events.
2. KO/TKO or Ippon (Kids) method calls from assigned officials.
3. Submitted judge score totals and round direction.
4. Deductions, yellow cards, warnings, and discipline pattern.
5. Missing officials or missing scorecards reduce confidence.

Raw data:
${JSON.stringify({ instantReportSnapshot, match, fighters, officials, judgeDecisionBreakdown: decisionSummary, eventSummary, judgeScores, events, tournamentStats }, null, 2)}

Required Markdown structure:

### 1. Analytical Verdict
- Recommended outcome: Red, Blue, Draw, or Cannot determine.
- Confidence level.
- One strong verdict sentence, like a chief analyst would say it.
- Whether this agrees or conflicts with the stored official result.
- Include the exact data reason from instantReportSnapshot.recommendationReason and then challenge it if other evidence is stronger.

### 2. Why This Verdict
- Give the strongest 3 to 5 reasons in ranked order.
- Use exact points, card counts, method calls, and judge signals.

### 3. Judge Scorecard Intelligence
- Explain totals, round direction, judge agreement/disagreement, and missing submissions.
- Identify whether one athlete wins by clean score logic or only because of discipline/method events.

### 4. Discipline and Method Consequences
- Summarize yellow cards, red cards, deductions, warnings, KO/TKO, Ippon (Kids), Disqualification, and DRAW as counts.
- Explain how these events should change or confirm the result.

### 5. Athlete Performance Analysis
- Analyze ${match.redCornerName} and ${match.blueCornerName} separately.
- Discuss control, risk, discipline, momentum, and decision credibility.

### 6. Data Integrity and Table Chief Checks
- Flag missing, duplicated, contradictory, or suspicious records.
- Say what the table chief should verify before validation.

### 7. Final Table Chief Note
- One concise operational conclusion: validate, review, or hold result pending missing data.
- Explicitly state the athlete/corner that deserves the win according to your analysis.

Tone: professional, intense, analytical, and tournament-official serious.`;
}

function buildFighterPrompt(match: any, corner: "RED" | "BLUE", fighter: any, judgeScores: any[], events: any[], tournamentStats: any, officials: any) {
  const fighterName = corner === "RED" ? match.redCornerName : match.blueCornerName;
  const fighterEvents = events.filter(event => event.corner === corner);
  const instantReportSnapshot = buildInstantReportSnapshot(match, judgeScores, events, officials);
  return `You are the IKF Kenshido athlete performance analyst. Produce a serious single-athlete "ta7lil" in Markdown.

Do not copy the event log. Build an opinion. Aggregate repeated cards/events into counts and judge whether this athlete's data supports a win, loss, draw, or unclear outcome. You must decide whether this athlete deserved the result from the Instant Report evidence.

**Selected Athlete:** ${fighterName}
**Corner:** ${corner}

**Raw Data Provided:**
${JSON.stringify({ instantReportSnapshot, match, fighter, corner, officials, judgeDecisionBreakdown: summarizeJudgeDecisions(judgeScores, officials?.allReferees ?? []), fighterEventSummary: summarizeEventCounts(fighterEvents), judgeScores, fighterEvents, allMatchEvents: events, tournamentStats }, null, 2)}

Required structure:

### 1. Athlete Verdict
- Deserved outcome for this athlete: Win, Loss, Draw, or Cannot determine.
- Confidence level.
- Strongest reason in one sentence.

### 2. Points and Momentum
- Explain score patterns, judge support, and momentum using exact numbers.

### 3. Discipline
- Count yellow cards, red cards, deductions, warnings, KO/TKO, Ippon (Kids), Disqualification, and DRAW calls.
- Explain whether discipline damages or supports this athlete's case.

### 4. Technical Read From Available Data
- Explain what the data suggests about control, risk, and reliability.
- Do not invent strikes or actions that are not recorded.

### 5. Official Decision Impact
- Explain how referee/judge submissions and method calls affect this athlete.

### 6. Final Note
- One practical note for the table chief or coach.
- Explicitly say if the athlete deserved to win, lose, draw, or if the data cannot support a firm decision.`;
}

async function requestServerAnalysis(prompt: string) {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error ?? "Server GPT analysis failed.");
  return data.text as string;
}

export default function AIPage() {
  const { matches, athletes, clubs, referees, judgeScores, roundEvents, reports } = useTournamentStore();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [analysisScope, setAnalysisScope] = useState<"match" | "red" | "blue">("match");
  const [databaseScores, setDatabaseScores] = useState<StoredJudgeScore[]>([]);
  const [databaseEvents, setDatabaseEvents] = useState<StoredJudgingEvent[]>([]);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  useFirebaseJudgingData(selectedMatchId || null, ({ scores, events }) => {
    setDatabaseScores(scores);
    setDatabaseEvents(events);
  });

  const selectedReport = reports.find((report) => report.matchId === selectedMatch?.id);
  const selectedJudgeScores = useMemo(
    () => {
      const localScores = selectedReport?.judgeScores ?? judgeScores.filter((score) => score.matchId === selectedMatch?.id);
      const merged = new Map<string, any>();
      localScores.forEach((score: any) => merged.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));
      databaseScores.forEach(score => merged.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));
      return Array.from(merged.values());
    },
    [databaseScores, judgeScores, selectedMatch?.id, selectedReport]
  );
  const selectedEvents = useMemo(
    () => {
      const localEvents = selectedReport?.events ?? roundEvents.filter((event) => selectedMatch && event.details?.toLowerCase().includes(`match #${selectedMatch.matchNumber}`));
      const merged = new Map<string, any>();
      localEvents.forEach((event: any) => merged.set(`${event.id}-${event.timestamp}-${event.type}-${event.details}`, event));
      databaseEvents.forEach(event => merged.set(`${event.id}-${event.timestamp}-${event.type}-${event.details}`, event));
      return Array.from(merged.values());
    },
    [databaseEvents, roundEvents, selectedMatch, selectedReport]
  );
  const fighterContext = useMemo(() => ({
    red: athletes.find(a => a.id === selectedMatch?.redCornerId) ?? null,
    blue: athletes.find(a => a.id === selectedMatch?.blueCornerId) ?? null,
  }), [athletes, selectedMatch?.blueCornerId, selectedMatch?.redCornerId]);
  const officialContext = useMemo(() => ({
    tableChief: selectedMatch?.assignedRefereeId ? makeTableChiefOfficial(TABLE_CHIEF_LABEL) : null,
    cornerJudges: selectedMatch?.assignedJudgeIds?.map(id => referees.find(r => r.id === id)).filter(Boolean) ?? [],
    allReferees: referees,
  }), [referees, selectedMatch?.assignedJudgeIds, selectedMatch?.assignedRefereeId]);

  const tournamentStats = useMemo(() => {
    const completed = matches.filter((match) => match.status === "completed");
    return {
      totalAthletes: athletes.length,
      totalClubs: clubs.length,
      totalReferees: referees.length,
      totalMatches: matches.length,
      completedMatches: completed.length,
      scheduledMatches: matches.filter((match) => match.status === "scheduled").length,
      reportsGenerated: reports.length,
      commonMethods: completed.map((match) => match.result?.method).filter(Boolean),
    };
  }, [athletes.length, clubs.length, referees.length, matches, reports.length]);

  const radarData = useMemo(() => {
    const redScore = selectedMatch?.result?.redTotalScore ?? 70;
    const blueScore = selectedMatch?.result?.blueTotalScore ?? 70;
    const scoreGap = Math.abs(redScore - blueScore);
    const redSubmitted = selectedJudgeScores.filter((score) => score.redScore >= score.blueScore).length;
    const blueSubmitted = selectedJudgeScores.filter((score) => score.blueScore > score.redScore).length;

    return [
      { subject: "Score Control", red: Math.min(100, redScore), blue: Math.min(100, blueScore), fullMark: 100 },
      { subject: "Judge Support", red: 55 + redSubmitted * 12, blue: 55 + blueSubmitted * 12, fullMark: 100 },
      { subject: "Consistency", red: Math.max(45, 92 - scoreGap * 3), blue: Math.max(45, 92 - scoreGap * 3), fullMark: 100 },
      { subject: "Activity", red: selectedMatch?.status === "completed" ? 82 : 64, blue: selectedMatch?.status === "completed" ? 78 : 64, fullMark: 100 },
      { subject: "Readiness", red: selectedMatch?.redCornerName === "TBD" ? 30 : 88, blue: selectedMatch?.blueCornerName === "TBD" ? 30 : 88, fullMark: 100 },
    ];
  }, [selectedMatch, selectedJudgeScores]);

  const handleAnalyze = async (scope: "match" | "red" | "blue" = "match") => {
    if (!selectedMatch) return;
    setAnalysisScope(scope);
    setIsAnalyzing(true);
    setError("");
    setAnalysis("");

    try {
      const prompt = scope === "match"
        ? buildPrompt(selectedMatch, selectedJudgeScores, selectedEvents, tournamentStats, fighterContext, officialContext)
        : buildFighterPrompt(selectedMatch, scope === "red" ? "RED" : "BLUE", scope === "red" ? fighterContext.red : fighterContext.blue, selectedJudgeScores, selectedEvents, tournamentStats, officialContext);

      const text = await requestServerAnalysis(prompt);
      setAnalysis(text);
    } catch (err: any) {
      setError(err?.message ?? "AI provider failed. Showing local fallback analysis.");
      setAnalysis(scope === "match"
        ? localFallbackAnalysis(selectedMatch, selectedJudgeScores, selectedEvents, referees)
        : localFighterFallbackAnalysis(selectedMatch, scope === "red" ? "RED" : "BLUE", scope === "red" ? fighterContext.red : fighterContext.blue, selectedJudgeScores, selectedEvents, referees)
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (selectedMatch) {
      setAnalysisScope("match");
      setAnalysis(localFallbackAnalysis(selectedMatch, selectedJudgeScores, selectedEvents, referees));
    } else {
      setAnalysis("");
    }
  }, [selectedMatchId, selectedJudgeScores, selectedEvents, selectedMatch, referees]);

  return (
    <div className="relative min-h-screen">
      <NeuralBackground />

      <div className="relative z-10 p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
        <PageHeader
          category="AI ANALYTICS"
          title="PERFORMANCE INTELLIGENCE"
          subtitle="GPT fight intelligence with verdict opinion, method impact, cards, points, and judge audit"
        />

        <div className="bg-[#d4a017] text-black rounded-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(212,160,23,0.2)]">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <p className="font-bold text-sm"><span className="uppercase tracking-widest font-black mr-2">AI Advisory System —</span>Insights are informational only. AI analysis does not influence, override, or replace official judge decisions.</p>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 rounded-xl flex flex-col lg:flex-row lg:items-center gap-4">
          <Search size={20} className="text-[var(--text-muted)]" />
          <select value={selectedMatchId} onChange={(event) => { setSelectedMatchId(event.target.value); setError(""); setAnalysis(""); }} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-[var(--ikf-red)] min-w-[300px]">
            <option value="">Choose match first...</option>
            {matches.map((match) => <option key={match.id} value={match.id}>Match #{match.matchNumber} — {match.redCornerName} vs {match.blueCornerName}</option>)}
          </select>
          <div className="lg:ml-auto flex flex-wrap items-center gap-3">
            <IKFBadge variant="win" label="GPT API ROUTE" size="sm" />
            <IKFBadge variant="live" label={`${selectedMatch?.status?.toUpperCase() ?? "NO MATCH"}`} size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <IKFButton variant="secondary" leftIcon={<Sparkles size={16} />} onClick={() => handleAnalyze("match")} disabled={!selectedMatch || isAnalyzing}>
            Full Match GPT Report
          </IKFButton>
          <button
            type="button"
            onClick={() => handleAnalyze("red")}
            disabled={!selectedMatch || isAnalyzing}
            className={`rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-40 ${analysisScope === "red" ? "border-[var(--ikf-red)] bg-[rgba(200,16,46,0.12)]" : "border-[rgba(200,16,46,0.25)] bg-[rgba(200,16,46,0.05)] hover:border-[var(--ikf-red)]"}`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ikf-red)]">Red athlete report</div>
            <div className="mt-1 text-sm font-bold text-white truncate">{selectedMatch?.redCornerName ?? "Choose match first"}</div>
          </button>
          <button
            type="button"
            onClick={() => handleAnalyze("blue")}
            disabled={!selectedMatch || isAnalyzing}
            className={`rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-40 ${analysisScope === "blue" ? "border-[var(--corner-blue)] bg-[rgba(0,102,204,0.12)]" : "border-[rgba(0,102,204,0.25)] bg-[rgba(0,102,204,0.05)] hover:border-[var(--corner-blue)]"}`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--corner-blue)]">Blue athlete report</div>
            <div className="mt-1 text-sm font-bold text-white truncate">{selectedMatch?.blueCornerName ?? "Choose match first"}</div>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr_1fr] gap-8">
          <div className="space-y-6">
            <SectionDivider label="LIVE DATA FEED" accent="red" />
            <IKFCard padding="lg" className="h-[460px] flex flex-col justify-center">
              <ComparisonBar label="Official Score" redVal={selectedMatch?.result?.redTotalScore ?? 0} blueVal={selectedMatch?.result?.blueTotalScore ?? 0} redText={`${selectedMatch?.result?.redTotalScore ?? "—"}`} blueText={`${selectedMatch?.result?.blueTotalScore ?? "—"}`} />
              <ComparisonBar label="Judge Cards" redVal={selectedJudgeScores.filter((s) => s.redScore >= s.blueScore).length} blueVal={selectedJudgeScores.filter((s) => s.blueScore > s.redScore).length} redText={`${selectedJudgeScores.filter((s) => s.redScore >= s.blueScore).length}`} blueText={`${selectedJudgeScores.filter((s) => s.blueScore > s.redScore).length}`} />
              <ComparisonBar label="Submitted Scores" redVal={selectedJudgeScores.filter((s) => s.submitted).length} blueVal={Math.max(0, selectedJudgeScores.length - selectedJudgeScores.filter((s) => s.submitted).length)} redText={`${selectedJudgeScores.filter((s) => s.submitted).length} done`} blueText={`${Math.max(0, selectedJudgeScores.length - selectedJudgeScores.filter((s) => s.submitted).length)} pending`} />
              <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold mb-2">Selected match</p>
                <p className="font-display text-3xl text-white">{selectedMatch?.redCornerName} <span className="text-[var(--text-muted)]">vs</span> {selectedMatch?.blueCornerName}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2">{selectedMatch ? formatMatchCategory(selectedMatch.ageGroup, selectedMatch.weightCategory, selectedMatch.gender) : ""} · Mat {selectedMatch?.matNumber} · {selectedMatch?.round}</p>
              </div>
            </IKFCard>
          </div>

          <div className="space-y-6">
            <SectionDivider label="PERFORMANCE RADAR" accent="gold" />
            <IKFCard padding="lg" className="h-[460px] flex flex-col">
              <div className="flex-1 -mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "bold" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={selectedMatch?.redCornerName ?? "Red"} dataKey="red" stroke="var(--ikf-red)" fill="var(--ikf-red)" fillOpacity={0.3} strokeWidth={2} />
                    <Radar name={selectedMatch?.blueCornerName ?? "Blue"} dataKey="blue" stroke="var(--corner-blue)" fill="var(--corner-blue)" fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f1117", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }} itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[rgba(212,160,23,0.05)] border border-[rgba(212,160,23,0.2)] rounded-lg p-4 mt-2">
                <h4 className="text-[10px] font-bold text-[var(--ikf-gold)] uppercase tracking-widest mb-2">Model Source</h4>
                <p className="text-xs text-[rgba(255,255,255,0.7)] leading-relaxed">Uses the server GPT API route with saved match, judge, card, method, and official data. If the provider is unavailable, the page falls back to local deterministic tournament analysis.</p>
              </div>
            </IKFCard>
          </div>

          <div className="space-y-6">
            <SectionDivider label="AI TEXT ANALYSIS" accent="blue" />
            <IKFCard padding="lg" className="h-[460px] overflow-y-auto custom-scrollbar">
              {error && <div className="mb-4 rounded-xl border border-[rgba(212,160,23,0.3)] bg-[rgba(212,160,23,0.08)] p-3 text-xs text-[var(--ikf-gold)] font-semibold">{error}</div>}
              <div className="flex items-center gap-3 mb-5">
                <Brain size={18} className="text-[var(--ikf-gold)]" />
                <span className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">{isAnalyzing ? "Server GPT analysis running" : "Server GPT analysis"}</span>
              </div>
              <pre className="whitespace-pre-wrap font-body text-sm leading-7 text-[var(--text-secondary)]">{analysis || "Choose a match and generate analysis."}</pre>
            </IKFCard>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <SectionDivider label="SITE AUDIT NOTES — AI SECTION" accent="gold" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Info size={20} />, label: "Fixed Logic", text: "Match selector now uses real store matches instead of fake IDs." },
              { icon: <TrendingUp size={20} />, label: "Real Context", text: "Prompt includes fighters, assigned officials, every submitted judge decision, events, and tournament totals." },
              { icon: <Lightbulb size={20} />, label: "Safe Fallback", text: "Local analysis keeps the section usable if the provider is unavailable." },
            ].map((item) => <div key={item.label} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6"><div className="text-[var(--ikf-gold)] mb-4">{item.icon}</div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">{item.label}</p><p className="text-sm font-semibold text-white leading-relaxed">{item.text}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
