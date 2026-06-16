/* eslint-disable */
"use client";
/**
 * useFirebaseMatchSync
 * 
 * On the Round-Management side: call pushMatchState() every time the timer ticks.
 * On the TV side: call useFirebaseMatchState() to get real-time state pushed from the other device.
 */

import { useEffect, useRef } from "react";
import { ref, set, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase";

export interface FirebaseMatchState {
  matchId: string | null;
  matchNumber: number | null;
  redCornerName: string;
  blueCornerName: string;
  redScore: number;
  blueScore: number;
  roundTimer: number;
  restTimer: number;
  timerMode: string;
  currentRound: number;
  totalRounds: number;
  maxTime: number;
  woskTimeLeft: number;
  woskCorner: string | null;
  status: string;
  category: string;
  matNumber: number;
  updatedAt: number;
}

export function deriveLiveMatchTimers(state: FirebaseMatchState | null) {
  if (!state) return null;
  const elapsed = Math.max(0, Math.floor((Date.now() - (state.updatedAt ?? Date.now())) / 1000));
  return {
    roundTimer: state.timerMode === "round" ? Math.max(0, state.roundTimer - elapsed) : state.roundTimer,
    restTimer: state.timerMode === "rest" ? Math.max(0, state.restTimer - elapsed) : state.restTimer,
    woskTimeLeft: state.timerMode === "passivity" ? Math.max(0, state.woskTimeLeft - elapsed) : state.woskTimeLeft,
  };
}

const MATCH_STATE_PATH = "tournament/live/matchState";

/** Push current match state to Firebase (call from Round Management) */
export async function pushMatchState(state: FirebaseMatchState) {
  try {
    await set(ref(db, MATCH_STATE_PATH), state);
  } catch (e) {
    // Silently fail - firebase may not be configured
    console.warn("[FirebaseSync] push failed:", e);
  }
}

/** Subscribe to live match state from Firebase (call from TV Display) */
export function useFirebaseMatchState(
  onUpdate: (state: FirebaseMatchState) => void
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const dbRef = ref(db, MATCH_STATE_PATH);
    const handler = (snapshot: any) => {
      const data = snapshot.val();
      if (data) callbackRef.current(data as FirebaseMatchState);
    };
    onValue(dbRef, handler);
    return () => off(dbRef, "value", handler);
  }, []);
}
