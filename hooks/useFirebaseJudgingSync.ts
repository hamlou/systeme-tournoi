/* eslint-disable */
"use client";

import { useEffect, useRef } from "react";
import { off, onValue, push, ref, set } from "firebase/database";
import { db } from "@/lib/firebase";
import type { JudgeScore, RoundEvent } from "@/types/tournament";

export interface StoredJudgeScore extends JudgeScore {
  submittedAt?: string;
  updatedAt: string;
  validationStatus: "draft" | "submitted";
}

export interface StoredJudgingEvent extends RoundEvent {
  matchId: string;
  officialId?: string;
  officialName?: string;
}

const judgingPath = (matchId: string) => `tournament/judging/${matchId}`;

export interface StoredJudgingBundle {
  matchId: string;
  scores: StoredJudgeScore[];
  events: StoredJudgingEvent[];
}

export async function saveJudgeScoreToDatabase(score: JudgeScore) {
  const now = new Date().toISOString();
  const payload: StoredJudgeScore = {
    ...score,
    validationStatus: score.submitted ? "submitted" : "draft",
    updatedAt: now,
    ...(score.submitted ? { submittedAt: now } : {}),
  };

  try {
    await set(ref(db, `${judgingPath(score.matchId)}/scores/${score.judgeId}/rounds/${score.round}`), payload);
  } catch (error) {
    console.warn("[FirebaseJudging] score save failed:", error);
  }
}

export async function saveJudgingEventToDatabase(event: Omit<StoredJudgingEvent, "id" | "timestamp">) {
  try {
    const eventRef = push(ref(db, `${judgingPath(event.matchId)}/events`));
    const payload: StoredJudgingEvent = {
      ...event,
      id: eventRef.key ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    await set(eventRef, payload);
  } catch (error) {
    console.warn("[FirebaseJudging] event save failed:", error);
  }
}

export function useFirebaseJudgingData(
  matchId: string | null,
  onUpdate: (data: { scores: StoredJudgeScore[]; events: StoredJudgingEvent[] }) => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!matchId) return;

    const dbRef = ref(db, judgingPath(matchId));
    const handler = (snapshot: any) => {
      const value = snapshot.val() ?? {};
      const scores = Object.values(value.scores ?? {}).flatMap((judge: any) =>
        Object.values(judge.rounds ?? {}) as StoredJudgeScore[]
      );
      const events = Object.values(value.events ?? {}) as StoredJudgingEvent[];
      callbackRef.current({ scores, events });
    };

    onValue(dbRef, handler);
    return () => off(dbRef, "value", handler);
  }, [matchId]);
}

export function useFirebaseAllJudgingData(
  onUpdate: (data: StoredJudgingBundle[]) => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const dbRef = ref(db, "tournament/judging");
    const handler = (snapshot: any) => {
      const value = snapshot.val() ?? {};
      const bundles = Object.entries(value).map(([matchId, raw]: [string, any]) => ({
        matchId,
        scores: Object.values(raw?.scores ?? {}).flatMap((judge: any) =>
          Object.values(judge.rounds ?? {}) as StoredJudgeScore[]
        ),
        events: Object.values(raw?.events ?? {}) as StoredJudgingEvent[],
      }));
      callbackRef.current(bundles);
    };

    onValue(dbRef, handler);
    return () => off(dbRef, "value", handler);
  }, []);
}
