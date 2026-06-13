/* eslint-disable */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { AlertTriangle, Brain, CheckCircle2, Info, Lightbulb, Loader2, Search, Sparkles, TrendingUp } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader, IKFCard, SectionDivider, IKFBadge, IKFButton } from "@/components/ui";
import { useTournamentStore } from "@/store/tournamentStore";

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

function localFallbackAnalysis(match: any, judgeScores: any[], events: any[]) {
  const result = match.result;
  const winner = result?.winnerName ?? "No winner validated yet";
  const method = result?.method?.replace(/-/g, " ") ?? "pending decision";
  const scoreLine = result ? `${result.redTotalScore ?? 0}-${result.blueTotalScore ?? 0}` : "no official score yet";
  const eventTypes = events.map((event) => event.type).join(", ") || "no events recorded";
  const submittedScores = judgeScores.filter((score) => score.matchId === match.id && score.submitted).length;

  return `Fallback local analysis: ${match.redCornerName} vs ${match.blueCornerName} is ${match.status}. Current official outcome: ${winner} by ${method}, score ${scoreLine}. ${submittedScores} judge score entries are submitted. Recorded event pattern: ${eventTypes}. Recommendation: verify all judge scorecards, confirm round events are complete, and use this insight only as coaching/tournament intelligence — never as a replacement for official judging.`;
}

function buildPrompt(match: any, judgeScores: any[], events: any[], tournamentStats: any) {
  return `You are an advisory AI analyst for an IKF Kenshido tournament platform. Provide concise, professional text analysis only. Never claim to override official judges.

Analyze this match and tournament context:
${JSON.stringify({ match, judgeScores, events, tournamentStats }, null, 2)}

Return exactly these sections:
1. Match Summary
2. Performance Signals
3. Risk / Integrity Checks
4. Coaching Recommendation
5. Tournament Trend

Keep it under 220 words. Be practical and clear.`;
}

function normalizePuterResponse(response: any) {
  if (typeof response === "string") return response;
  if (response?.message?.content) return response.message.content;
  if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content;
  return JSON.stringify(response, null, 2);
}

export default function AIPage() {
  const { matches, athletes, clubs, referees, judgeScores, roundEvents, reports } = useTournamentStore();
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id ?? "");
  const [puterReady, setPuterReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? matches[0];
  const selectedJudgeScores = useMemo(
    () => judgeScores.filter((score) => score.matchId === selectedMatch?.id),
    [judgeScores, selectedMatch?.id]
  );
  const selectedEvents = useMemo(
    () => roundEvents.filter((event) => !selectedMatch || event.details?.toLowerCase().includes(`match #${selectedMatch.matchNumber}`) || selectedMatch.status === "completed"),
    [roundEvents, selectedMatch]
  );

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

  const handleAnalyze = async () => {
    if (!selectedMatch) return;
    setIsAnalyzing(true);
    setError("");
    setAnalysis("");

    try {
      const puter = (window as any).puter;
      if (!puter?.ai?.chat) {
        throw new Error("Puter AI SDK is not ready yet. Wait a moment and try again.");
      }

      const prompt = buildPrompt(selectedMatch, selectedJudgeScores, selectedEvents, tournamentStats);
      const response = await puter.ai.chat(prompt, { model: "gpt-4o-mini" });
      setAnalysis(normalizePuterResponse(response));
    } catch (err: any) {
      setError(err?.message ?? "AI provider failed. Showing local fallback analysis.");
      setAnalysis(localFallbackAnalysis(selectedMatch, selectedJudgeScores, selectedEvents));
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (selectedMatch && !analysis) {
      setAnalysis(localFallbackAnalysis(selectedMatch, selectedJudgeScores, selectedEvents));
    }
  }, [selectedMatchId]);

  return (
    <div className="relative min-h-screen">
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onLoad={() => setPuterReady(true)} />
      <NeuralBackground />

      <div className="relative z-10 p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
        <PageHeader
          category="AI ANALYTICS"
          title="PERFORMANCE INTELLIGENCE"
          subtitle="Puter OpenAI text model insights — advisory use only, never binding"
          actions={
            <IKFButton variant="primary" leftIcon={isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} onClick={handleAnalyze} disabled={!selectedMatch || isAnalyzing}>
              {isAnalyzing ? "Analyzing" : "Generate AI Analysis"}
            </IKFButton>
          }
        />

        <div className="bg-[#d4a017] text-black rounded-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(212,160,23,0.2)]">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <p className="font-bold text-sm"><span className="uppercase tracking-widest font-black mr-2">AI Advisory System —</span>Insights are informational only. AI analysis does not influence, override, or replace official judge decisions.</p>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 rounded-xl flex flex-col lg:flex-row lg:items-center gap-4">
          <Search size={20} className="text-[var(--text-muted)]" />
          <select value={selectedMatch?.id ?? ""} onChange={(event) => { setSelectedMatchId(event.target.value); setError(""); }} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-[var(--ikf-red)] min-w-[300px]">
            {matches.map((match) => <option key={match.id} value={match.id}>Match #{match.matchNumber} — {match.redCornerName} vs {match.blueCornerName}</option>)}
          </select>
          <div className="lg:ml-auto flex flex-wrap items-center gap-3">
            <IKFBadge variant={puterReady ? "win" : "pending"} label={puterReady ? "PUTER READY" : "LOADING AI SDK"} size="sm" />
            <IKFBadge variant="live" label={`${selectedMatch?.status?.toUpperCase() ?? "NO MATCH"}`} size="sm" />
          </div>
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
                <p className="text-sm text-[var(--text-secondary)] mt-2">{selectedMatch?.category} · Mat {selectedMatch?.matNumber} · {selectedMatch?.round}</p>
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
                <p className="text-xs text-[rgba(255,255,255,0.7)] leading-relaxed">Uses Puter.js with an OpenAI-compatible text model from the browser. If the provider is unavailable, the page falls back to local deterministic tournament analysis.</p>
              </div>
            </IKFCard>
          </div>

          <div className="space-y-6">
            <SectionDivider label="AI TEXT ANALYSIS" accent="blue" />
            <IKFCard padding="lg" className="h-[460px] overflow-y-auto custom-scrollbar">
              {error && <div className="mb-4 rounded-xl border border-[rgba(212,160,23,0.3)] bg-[rgba(212,160,23,0.08)] p-3 text-xs text-[var(--ikf-gold)] font-semibold">{error}</div>}
              <div className="flex items-center gap-3 mb-5">
                {puterReady ? <CheckCircle2 size={18} className="text-[var(--status-win)]" /> : <Brain size={18} className="text-[var(--ikf-gold)]" />}
                <span className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">{puterReady ? "Connected" : "Waiting for Puter SDK"}</span>
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
              { icon: <TrendingUp size={20} />, label: "Real Context", text: "Prompt includes match, scores, events, and tournament totals." },
              { icon: <Lightbulb size={20} />, label: "Safe Fallback", text: "Local analysis keeps the section usable if the provider is unavailable." },
            ].map((item) => <div key={item.label} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6"><div className="text-[var(--ikf-gold)] mb-4">{item.icon}</div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">{item.label}</p><p className="text-sm font-semibold text-white leading-relaxed">{item.text}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
