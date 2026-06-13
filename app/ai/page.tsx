/* eslint-disable */
"use client";

import React, { useRef, useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, TrendingUp, Search, Info } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader, IKFCard, SectionDivider, IKFBadge } from "@/components/ui";

// ── Neural Network Background ───────────────────────────────────────────────
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

    const particles: { x: number, y: number, vx: number, vy: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      });
    }

    let animationId: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      
      // Update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
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
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(200, 16, 46, ${0.1 - dist / 1500})`;
            ctx.stroke();
          }
        }
      }
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

// ── Components ──────────────────────────────────────────────────────────────
function ComparisonBar({ label, redVal, blueVal, redText, blueText, format = "number" }: any) {
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

// ── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_RADAR = [
  { subject: "Technical Identity", red: 85, blue: 65, fullMark: 100 },
  { subject: "Effectiveness", red: 78, blue: 72, fullMark: 100 },
  { subject: "Positive Control", red: 60, blue: 85, fullMark: 100 },
  { subject: "Activity Level", red: 88, blue: 82, fullMark: 100 },
  { subject: "Rule Compliance", red: 95, blue: 70, fullMark: 100 },
];

const MOCK_TRENDS = [
  { icon: <TrendingUp size={20} />, label: "Observation", text: "Most common win method in -70kg: Majority Decision (62%)", color: "#0066cc" },
  { icon: <Info size={20} />, label: "Pattern Detected", text: "Highest activity category: Senior A — avg 47 exchanges per match", color: "#2ecc71" },
  { icon: <TrendingUp size={20} />, label: "Observation", text: "Country with highest KO rate: Algeria (4 KOs from 12 matches)", color: "#0066cc" },
  { icon: <Lightbulb size={20} />, label: "Recommendation", text: "Review passivity rule enforcement in U16 category — 34% of matches had passive play warnings", color: "#d4a017" },
];

// ── Page ────────────────────────────────────────────────────────────────────
export default function AIPage() {
  const [selectedMatch, setSelectedMatch] = useState("m7");

  return (
    <div className="relative min-h-screen">
      <NeuralBackground />
      
      <div className="relative z-10 p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
        <PageHeader 
          category="AI ANALYTICS" 
          title="PERFORMANCE INTELLIGENCE" 
          subtitle="AI-powered insights — advisory use only, never binding"
        />

        {/* ── DISCLAIMER BANNER ────────────────────────────────────────── */}
        <div className="bg-[#d4a017] text-black rounded-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(212,160,23,0.2)]">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <p className="font-bold text-sm">
            <span className="uppercase tracking-widest font-black mr-2">⚠️ AI Advisory System —</span>
            All insights generated by this module are informational only. AI analysis does not influence, override, or replace official judge decisions. For coaching and performance improvement use only.
          </p>
        </div>

        {/* ── MATCH SELECTOR ───────────────────────────────────────────── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 rounded-xl flex items-center gap-4">
          <Search size={20} className="text-[var(--text-muted)]" />
          <select 
            value={selectedMatch}
            onChange={e => setSelectedMatch(e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-[var(--ikf-red)] min-w-[300px]"
          >
            <option value="m7">Match #7 — Ahmed Ben Ali vs Karim Mansouri</option>
            <option value="m5">Match #5 — Lucas Silva vs Omar Diallo</option>
            <option value="m12">Match #12 — David Kim vs Jean Dupont</option>
          </select>
          <div className="ml-auto flex items-center gap-3">
            <IKFBadge variant="live" label="ANALYSIS COMPLETE" size="sm" />
          </div>
        </div>

        {/* ── MAIN CONTENT: THREE COLUMNS ──────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr_1fr] gap-8">
          
          {/* LEFT: ACTIVITY ANALYSIS */}
          <div className="space-y-6">
            <SectionDivider label="ACTIVITY ANALYSIS" accent="red" />
            <IKFCard padding="lg" className="h-[460px] flex flex-col justify-center">
              
              <ComparisonBar 
                label="Strikes Attempted" 
                redVal={142} blueVal={98} 
                redText="142" blueText="98" 
              />
              
              <ComparisonBar 
                label="Strikes Landed" 
                redVal={86} blueVal={54} 
                redText="86 (60%)" blueText="54 (55%)" 
              />
              
              <ComparisonBar 
                label="Takedowns (Att / Lnd)" 
                redVal={4} blueVal={6} 
                redText="4 / 2" blueText="6 / 4" 
              />
              
              <ComparisonBar 
                label="Ground Control Time" 
                redVal={84} blueVal={47} 
                redText="1:24" blueText="0:47" 
              />
              
              <ComparisonBar 
                label="Passivity Warnings" 
                redVal={0} blueVal={2} 
                redText="0" blueText="2" 
              />
              
            </IKFCard>
          </div>

          {/* CENTER: PERFORMANCE RADAR */}
          <div className="space-y-6">
            <SectionDivider label="PERFORMANCE RADAR" accent="gold" />
            <IKFCard padding="lg" className="h-[460px] flex flex-col">
              <div className="flex-1 -mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={MOCK_RADAR}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "bold" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Ahmed Ben Ali" dataKey="red" stroke="var(--ikf-red)" fill="var(--ikf-red)" fillOpacity={0.3} strokeWidth={2} />
                    <Radar name="Karim Mansouri" dataKey="blue" stroke="var(--corner-blue)" fill="var(--corner-blue)" fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f1117", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[rgba(212,160,23,0.05)] border border-[rgba(212,160,23,0.2)] rounded-lg p-4 mt-2">
                <h4 className="text-[10px] font-bold text-[var(--ikf-gold)] uppercase tracking-widest mb-2">AI Assessment</h4>
                <p className="text-xs text-[rgba(255,255,255,0.7)] leading-relaxed">
                  Red Corner demonstrated superior technical identity throughout rounds 1 and 2, with a higher strike landing rate (60% vs 55%). Blue Corner showed stronger ground control and takedown efficiency in round 3. Overall activity levels heavily favored Red. <span className="font-bold text-[var(--text-muted)] italic">This analysis is advisory only.</span>
                </p>
              </div>
            </IKFCard>
          </div>

          {/* RIGHT: ROUND BREAKDOWN */}
          <div className="space-y-6">
            <SectionDivider label="ROUND-BY-ROUND BREAKDOWN" accent="blue" />
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
              
              {[
                { r: 1, dom: "RED", events: ["Red dominated striking", "Blue passivity warning"], rCtrl: 65, bCtrl: 35 },
                { r: 2, dom: "RED", events: ["Balanced exchanges", "Red technical superiority"], rCtrl: 52, bCtrl: 48 },
                { r: 3, dom: "BLUE", events: ["Blue successful takedowns", "Blue ground control"], rCtrl: 30, bCtrl: 70 },
              ].map(round => (
                <div key={round.r} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 hover:border-[rgba(255,255,255,0.1)] transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <div className="font-bold text-sm tracking-widest uppercase">Round {round.r}</div>
                    <IKFBadge 
                      variant={round.dom === "RED" ? "live" : "pending"} 
                      label={`${round.dom} DOMINANT`} 
                      size="sm" 
                    />
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {round.events.map((e, i) => (
                      <div key={i} className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" /> {e}
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                      <span className="text-[var(--ikf-red)]">{round.rCtrl}% Control</span>
                      <span className="text-[var(--corner-blue)]">{round.bCtrl}% Control</span>
                    </div>
                    <div className="h-1.5 w-full bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[var(--ikf-red)]" style={{ width: `${round.rCtrl}%` }} />
                      <div className="h-full bg-[var(--corner-blue)]" style={{ width: `${round.bCtrl}%` }} />
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* ── BOTTOM: TOURNAMENT TRENDS ────────────────────────────────── */}
        <div className="mt-8 space-y-6">
          <SectionDivider label="TOURNAMENT TRENDS (AI)" accent="gold" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {MOCK_TRENDS.map((trend, i) => (
              <div 
                key={i} 
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 relative overflow-hidden group hover:border-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div 
                  className="absolute top-0 left-0 w-1 h-full" 
                  style={{ backgroundColor: trend.color }} 
                />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(255,255,255,0.05)]" style={{ color: trend.color }}>
                    {trend.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {trend.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {trend.text}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

