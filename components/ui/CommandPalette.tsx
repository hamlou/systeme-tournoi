/* eslint-disable */
import React, { useEffect, useState } from "react";
import { Search, User, Trophy, FileText, Settings, X, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { useTournamentStore } from "@/store/tournamentStore";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { athletes, clubs, matches } = useTournamentStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      
      // Toggle Shortcuts menu
      if (e.key === "?" && !isOpen && e.target === document.body) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Close modals
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowShortcuts(false);
      }

      // Navigation shortcuts (only if no modal is open and not typing in an input)
      if (!isOpen && !showShortcuts && e.target === document.body) {
        switch (e.key.toLowerCase()) {
          case "d": router.push("/dashboard"); break;          case "j": router.push("/judging/judge"); break;
          case "t": router.push("/tv"); break;
          case "r": router.push("/reports"); break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showShortcuts, router]);

  const searchResults = React.useMemo(() => {
    const results = [];
    athletes.forEach(a => results.push({ id: `a_${a.id}`, type: "Athlete", icon: <User size={16} />, text: `${a.fullName} (${a.weightCategory} ${a.ageGroup})`, route: "/athletes" }));
    clubs.forEach(c => results.push({ id: `c_${c.id}`, type: "Club", icon: <Flag size={16} />, text: `${c.name} (${c.country})`, route: "/clubs" }));
    matches.forEach(m => results.push({ id: `m_${m.id}`, type: "Match", icon: <Trophy size={16} />, text: `Match #${m.matchNumber} — ${m.redCornerName} vs ${m.blueCornerName} (Mat 0${m.matNumber})`, route: "/brackets" }));
    results.push({ id: "s_1", type: "Settings", icon: <Settings size={16} />, text: "Tournament Settings", route: "/settings" });
    return results;
  }, [athletes, clubs, matches]);

  const filtered = searchResults.filter(r => r.text.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (route: string) => {
    setIsOpen(false);
    router.push(route);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }}
              className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center px-4 py-4 border-b border-[var(--border-default)]">
                <Search size={20} className="text-[var(--text-muted)] mr-3" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search athletes, matches, clubs... (Mocked)"
                  className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-[var(--text-muted)]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={() => setIsOpen(false)} className="text-[var(--text-muted)] hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2">
                {filtered.length > 0 ? (
                  filtered.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelect(r.route)}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-left"
                    >
                      <div className="text-[var(--text-muted)]">{r.icon}</div>
                      <div className="flex-1 text-white font-medium">{r.text}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] border border-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded">
                        {r.type}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-[var(--text-muted)]">No results found.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Keyboard Shortcuts</h3>
              <div className="space-y-4">
                {[
                  { key: "D", label: "Dashboard" },
                  { key: "J", label: "Electronic Judging" },
                  { key: "T", label: "TV Display" },
                  { key: "R", label: "Instant Reports" },
                  { key: "Ctrl + K", label: "Global Search" },
                  { key: "?", label: "Show Shortcuts" },
                ].map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">{s.label}</span>
                    <kbd className="bg-[var(--bg-elevated)] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-muted)] shadow-[0_2px_0_rgba(255,255,255,0.05)]">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

