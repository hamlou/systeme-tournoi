/* eslint-disable */
"use client";

import React from "react";
import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 w-full">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between border-b border-[rgba(255,255,255,0.05)] pb-6 mb-8">
        <div className="space-y-4">
          <div className="w-24 h-4 bg-[var(--bg-elevated)] rounded-md animate-pulse" />
          <div className="w-64 h-10 bg-[var(--bg-elevated)] rounded-md animate-pulse" />
          <div className="w-48 h-4 bg-[var(--bg-elevated)] rounded-md animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="w-32 h-10 bg-[var(--bg-elevated)] rounded-lg animate-pulse" />
          <div className="w-32 h-10 bg-[var(--bg-elevated)] rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[140px] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 animate-pulse">
            <div className="w-16 h-4 bg-[var(--bg-elevated)] rounded mb-6" />
            <div className="w-24 h-10 bg-[var(--bg-elevated)] rounded mb-4" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl overflow-hidden mt-8">
        <div className="h-12 bg-[var(--bg-elevated)] border-b border-[var(--border-default)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 border-b border-[rgba(255,255,255,0.02)] animate-pulse flex items-center px-6 gap-6">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)]" />
            <div className="w-32 h-4 bg-[var(--bg-elevated)] rounded" />
            <div className="w-24 h-4 bg-[var(--bg-elevated)] rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

