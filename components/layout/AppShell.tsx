"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ScrollToTop } from "../ui/ScrollToTop";
import { CommandPalette } from "../ui/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Full-screen routes that should completely hide the nav chrome
  const isFullScreen = pathname?.startsWith("/judging") || pathname?.startsWith("/tv");

  if (isFullScreen) {
    return (
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-[100dvh] bg-[var(--bg-primary)]"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />
        <div className="flex-1 overflow-y-auto custom-scrollbar relative" id="main-scroll-container">
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
            >
              {children}
            </motion.main>
          </AnimatePresence>
          <ScrollToTop />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
