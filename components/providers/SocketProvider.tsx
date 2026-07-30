"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onValue, off, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, Club, WeighinRecord, Match, Bracket, Referee, JudgeScore, RoundEvent, TournamentReport, TournamentSettings, RoleAccount } from "@/types/tournament";
import { DEFAULT_CHAMPIONSHIP, NATIONAL_COUNTRY } from "@/lib/nationalCompetition";
import { totalRoundsForAgeGroup } from "@/lib/ageCategories";
import { normalizeWeightCategory } from "@/lib/competitionRules";
import { TABLE_CHIEF_ASSIGNMENT_ID, TABLE_CHIEF_LABEL } from "@/lib/officials";

interface SyncContextType {
  isConnected: boolean;
  isHydrated: boolean;
}

const SyncContext = createContext<SyncContextType>({ isConnected: false, isHydrated: false });

export const useSocket = () => useContext(SyncContext);

type AccountLinkKey = "athleteId" | "clubId" | "refereeId";
type LegacyRole = RoleAccount["role"] | "central-referee";
type LegacyRefRole = Referee["role"] | "Chief Referee" | "Central Referee";
type LegacyRoleAccount = Omit<RoleAccount, "role"> & { role?: LegacyRole };
type LegacyReferee = Omit<Referee, "role"> & { role?: LegacyRefRole };
type TournamentSnapshot = Partial<{
  settings: TournamentSettings;
  athletes: Athlete[];
  clubs: Club[];
  weighinRecords: WeighinRecord[];
  matches: Match[];
  brackets: Bracket[];
  referees: Referee[];
  accounts: RoleAccount[];
  judgeScores: JudgeScore[];
  events: RoundEvent[] | Record<string, RoundEvent>;
  judging: Record<string, {
    scores?: Record<string, { rounds?: Record<string, JudgeScore> }>;
    events?: Record<string, RoundEvent>;
  }>;
  roundEvents: RoundEvent[];
  reports: TournamentReport[];
  activeMatch: Match | null;
  live: {
    matchState?: {
      matchId?: string | null;
      currentRound?: number;
      roundTimer?: number;
      timerMode?: "idle" | "round" | "rest" | "passivity" | "medical";
      updatedAt?: number;
    };
  };
}>;
type LiveMatchSnapshot = NonNullable<TournamentSnapshot["live"]>["matchState"];

const LOCAL_SNAPSHOT_KEY = "ikf_tournament_snapshot_v2";

function makeAccountUsername(name: string, prefix: string, accounts: RoleAccount[]) {
  const base = `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile"}`;
  const taken = new Set(accounts.map(account => account.username.toLowerCase()));
  let username = base;
  let index = 2;
  while (taken.has(username.toLowerCase())) {
    username = `${base}${index}`;
    index += 1;
  }
  return username;
}

function makeAccountPassword(prefix: string, profileId: string) {
  const tail = profileId.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "000001";
  return `${prefix}-${tail}`;
}

function normalizeMatch(match: Match): Match {
  const baseRounds = totalRoundsForAgeGroup(match.ageGroup);
  return {
    ...match,
    weightCategory: normalizeWeightCategory(match.weightCategory),
    totalRounds: match.totalRounds && match.totalRounds > baseRounds ? match.totalRounds : baseRounds,
  };
}

function deriveRoundTimer(state?: LiveMatchSnapshot) {
  if (!state || typeof state.roundTimer !== "number") return undefined;
  if (state.timerMode !== "round") return state.roundTimer;
  const elapsed = Math.max(0, Math.floor((Date.now() - (state.updatedAt ?? Date.now())) / 1000));
  return Math.max(0, state.roundTimer - elapsed);
}

function normalizeAccount(account: LegacyRoleAccount): RoleAccount {
  const migratedRole = account.role === "central-referee" ? "admin" : account.role ?? "athlete";
  return {
    ...account,
    role: migratedRole as RoleAccount["role"],
    displayName: migratedRole === "admin" && /chief admin|central referee/i.test(account.displayName)
      ? TABLE_CHIEF_LABEL
      : account.displayName,
    approvalStatus: migratedRole === "admin" ? "Approved" : account.approvalStatus,
    ...(migratedRole === "admin" ? { refereeId: undefined } : {}),
  };
}

function isLegacyCentralReferee(referee: LegacyReferee) {
  return referee.role === "Central Referee" || referee.role === "Chief Referee" || referee.role === TABLE_CHIEF_LABEL;
}

function readLocalSnapshot(): TournamentSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) as TournamentSnapshot : null;
  } catch {
    window.localStorage.removeItem(LOCAL_SNAPSHOT_KEY);
    return null;
  }
}

function writeLocalSnapshot(snapshot: TournamentSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[local snapshot] write failed", error);
  }
}

function stateToSnapshot(state: ReturnType<typeof useTournamentStore.getState>): TournamentSnapshot {
  return {
    settings: state.settings,
    athletes: state.athletes,
    clubs: state.clubs,
    weighinRecords: state.weighinRecords,
    matches: state.matches,
    brackets: state.brackets,
    referees: state.referees,
    accounts: state.accounts,
    judgeScores: state.judgeScores,
    events: state.roundEvents,
    reports: state.reports,
    activeMatch: state.activeMatch,
  };
}

function flattenJudgingData(judging?: TournamentSnapshot["judging"]) {
  const scores: JudgeScore[] = [];
  const events: RoundEvent[] = [];
  if (!judging) return { scores, events };

  Object.values(judging).forEach(bundle => {
    Object.values(bundle?.scores ?? {}).forEach(judgeRecord => {
      Object.values(judgeRecord?.rounds ?? {}).forEach(score => {
        if (score?.matchId && score?.judgeId) scores.push(score as JudgeScore);
      });
    });
    Object.values(bundle?.events ?? {}).forEach(event => {
      if (event?.type && event?.timestamp) events.push(event as RoundEvent);
    });
  });

  return { scores, events };
}

function mergeByKey<T>(base: T[], incoming: T[], getKey: (item: T) => string) {
  const merged = new Map<string, T>();
  base.forEach(item => merged.set(getKey(item), item));
  incoming.forEach(item => merged.set(getKey(item), item));
  return Array.from(merged.values());
}

// Handles both Firebase object-keyed format ({id1: {...}, id2: {...}}) and legacy array format
function toArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean) as T[];
  if (typeof data === 'object') return Object.values(data).filter(Boolean) as T[];
  return [];
}

function ensureProfileAccount(
  accounts: RoleAccount[],
  profile: {
    id: string;
    name: string;
    role: RoleAccount["role"];
    linkKey: AccountLinkKey;
    accountId?: string;
    approvalStatus?: RoleAccount["approvalStatus"];
  },
) {
  const now = new Date().toISOString();
  const prefix = profile.role === "athlete" ? "athlete" : profile.role === "club" ? "club" : profile.role === "corner-referee" ? "corner" : "official";
  const accountStatus = profile.approvalStatus ?? "Approved";
  const existing = accounts.find(account => account.id === profile.accountId) ?? accounts.find(account => account[profile.linkKey] === profile.id);

  if (existing) {
    return {
      accountId: existing.id,
      accounts: accounts.map(account => account.id === existing.id
        ? {
            ...account,
            role: profile.role,
            displayName: profile.name,
            approvalStatus: accountStatus,
            [profile.linkKey]: profile.id,
            ...(accountStatus === "Approved" ? { approvedAt: account.approvedAt ?? now } : {}),
          }
        : account),
    };
  }

  const takenIds = new Set(accounts.map(account => account.id));
  let id = `account-${profile.id}`;
  let index = 2;
  while (takenIds.has(id)) {
    id = `account-${profile.id}-${index}`;
    index += 1;
  }

  const account: RoleAccount = {
    id,
    username: makeAccountUsername(profile.name, prefix, accounts),
    password: makeAccountPassword(prefix, profile.id),
    role: profile.role,
    displayName: profile.name,
    approvalStatus: accountStatus,
    [profile.linkKey]: profile.id,
    createdAt: now,
    ...(accountStatus === "Approved" ? { approvedAt: now } : {}),
  };

  return { accountId: account.id, accounts: [account, ...accounts] };
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasHydratedRef = useRef(false);
  const latestLiveStateRef = useRef<LiveMatchSnapshot | null>(null);

  useEffect(() => {
    const rootRef = ref(db, "tournament");
    let connected = false;
    const markHydrated = () => {
      hasHydratedRef.current = true;
      setIsHydrated(true);
    };

    const hydrateFromData = (rawData: TournamentSnapshot) => {
      const data = rawData;
      const store = useTournamentStore;
      const rawReferees = Array.isArray(data.referees) ? data.referees as LegacyReferee[] : [];
      const legacyTableChiefIds = new Set(
        rawReferees
          .filter(isLegacyCentralReferee)
          .map(referee => referee.id),
      );

      let normalizedAccounts = toArray<LegacyRoleAccount>(data.accounts).length > 0
        ? toArray<LegacyRoleAccount>(data.accounts).map(normalizeAccount)
        : store.getState().accounts;

      // Sync each collection into the Zustand store
      const safeSetState = (key: string, newVal: any) => {
        const currentVal = (store.getState() as any)[key];
        if (JSON.stringify(currentVal) !== JSON.stringify(newVal)) {
          store.setState({ [key]: newVal });
        }
      };

      if (data.settings) {
        const settings = data.settings as TournamentSettings;
        safeSetState('settings', { ...settings, championshipName: settings.championshipName ?? DEFAULT_CHAMPIONSHIP });
      }
      const rawAthletes = toArray<Athlete>(data.athletes);
      if (rawAthletes.length > 0) {
        const normalizedAthletes = rawAthletes.map(athlete => {
          const approvalStatus = athlete.approvalStatus ?? (athlete.registrationStatus === "Active" ? "Approved" : "Pending");
          const linked = ensureProfileAccount(normalizedAccounts, {
            id: athlete.id,
            name: athlete.fullName,
            role: "athlete",
            linkKey: "athleteId",
            accountId: athlete.accountId,
            approvalStatus,
          });
          normalizedAccounts = linked.accounts;
          return {
            ...athlete,
            accountId: linked.accountId,
            country: NATIONAL_COUNTRY,
            weightCategory: normalizeWeightCategory(athlete.weightCategory),
            approvalStatus,
            registrationStatus: athlete.registrationStatus ?? (approvalStatus === "Approved" ? "Active" : "Pending"),
          };
        });
        safeSetState('athletes', normalizedAthletes);
      }
      const rawClubs = toArray<Club>(data.clubs);
      if (rawClubs.length > 0) {
        const normalizedClubs = rawClubs.map(club => {
          const approvalStatus = club.approvalStatus ?? (club.status === "Active" ? "Approved" : "Pending");
          const linked = ensureProfileAccount(normalizedAccounts, {
            id: club.id,
            name: club.name,
            role: "club",
            linkKey: "clubId",
            accountId: club.accountId,
            approvalStatus,
          });
          normalizedAccounts = linked.accounts;
          return {
            ...club,
            accountId: linked.accountId,
            country: NATIONAL_COUNTRY,
            approvalStatus,
            status: club.status ?? (approvalStatus === "Approved" ? "Active" : "Pending"),
          };
        });
        safeSetState('clubs', normalizedClubs);
      }
      const rawWeighin = toArray<WeighinRecord>(data.weighinRecords);
      if (rawWeighin.length > 0) {
        safeSetState('weighinRecords', rawWeighin);
      }
      const rawMatches = toArray<Match>(data.matches);
      if (rawMatches.length > 0) {
        safeSetState('matches', rawMatches.map(match => {
          const normalized = normalizeMatch(match);
          const shouldUseTableChief = !normalized.assignedRefereeId || legacyTableChiefIds.has(normalized.assignedRefereeId);
          return {
            ...normalized,
            assignedRefereeId: shouldUseTableChief ? TABLE_CHIEF_ASSIGNMENT_ID : normalized.assignedRefereeId,
          };
        }));
      }
      const rawBrackets = toArray<Bracket>(data.brackets);
      if (rawBrackets.length > 0) {
        safeSetState('brackets', rawBrackets.map(bracket => ({
          ...bracket,
          weightCategory: normalizeWeightCategory(bracket.weightCategory),
        })));
      }
      const rawRefereeList = toArray<LegacyReferee>(data.referees);
      if (rawRefereeList.length > 0) {
        const normalizedReferees = rawRefereeList
          .filter(referee => !isLegacyCentralReferee(referee))
          .map(referee => {
          const approvalStatus = referee.approvalStatus ?? "Approved";
          const linked = ensureProfileAccount(normalizedAccounts, {
            id: referee.id,
            name: referee.name,
            role: "corner-referee",
            linkKey: "refereeId",
            accountId: referee.accountId,
            approvalStatus,
          });
          normalizedAccounts = linked.accounts;
          return {
            ...referee,
            role: "Corner Judge" as const,
            accountId: linked.accountId,
            country: NATIONAL_COUNTRY,
            approvalStatus,
          };
        });
        safeSetState('referees', normalizedReferees);
      }
      if (toArray(data.accounts).length > 0 || rawAthletes.length > 0 || rawClubs.length > 0 || rawRefereeList.length > 0) {
        safeSetState('accounts', normalizedAccounts);
      }
      const rawJudgeScores = toArray<JudgeScore>(data.judgeScores);
      if (rawJudgeScores.length > 0) {
        safeSetState('judgeScores', rawJudgeScores);
      }
      if (data.events) {
        const events = toArray<RoundEvent>(data.events);
        safeSetState('roundEvents', events);
      }
      if (data.judging) {
        const { scores, events } = flattenJudgingData(data.judging);
        const newJudgeScores = mergeByKey(
          store.getState().judgeScores,
          scores,
          score => `${score.matchId}-${score.judgeId}-${score.round}`
        );
        const newRoundEvents = mergeByKey(
          store.getState().roundEvents,
          events,
          event => event.id ?? `${event.timestamp}-${event.type}-${event.corner ?? ""}-${event.details}`
        );
        safeSetState('judgeScores', newJudgeScores);
        safeSetState('roundEvents', newRoundEvents);
      }
      if (Array.isArray(data.reports)) {
        safeSetState('reports', data.reports as TournamentReport[]);
      }
      if (data.live?.matchState) {
        const liveState = data.live.matchState;
        latestLiveStateRef.current = liveState;
        store.setState({
          currentRound: liveState.currentRound ?? store.getState().currentRound,
          roundTimer: deriveRoundTimer(liveState) ?? store.getState().roundTimer,
          timerMode: liveState.timerMode ?? store.getState().timerMode,
        });
      }
      if (data.activeMatch) {
        const normalizedActive = normalizeMatch(data.activeMatch as Match);
        store.setState({
          activeMatch: {
            ...normalizedActive,
            assignedRefereeId: !normalizedActive.assignedRefereeId || legacyTableChiefIds.has(normalizedActive.assignedRefereeId)
              ? TABLE_CHIEF_ASSIGNMENT_ID
              : normalizedActive.assignedRefereeId,
          },
        });
      }
      markHydrated();
    };

    const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
      const data = snapshot.val() as TournamentSnapshot | null;
      if (!connected) { connected = true; setIsConnected(true); }
      if (!data) {
        const localSnapshot = readLocalSnapshot();
        if (localSnapshot) hydrateFromData(localSnapshot);
        markHydrated();
        return;
      }
      hydrateFromData(data);
    };

    const handleError = (error: Error) => {
      console.warn("[FirebaseSync] Falling back to local snapshot", error);
      const localSnapshot = readLocalSnapshot();
      if (localSnapshot) hydrateFromData(localSnapshot);
      setIsConnected(false);
      markHydrated();
    };

    onValue(rootRef, handler, handleError);
    const hydrationTimeout = window.setTimeout(() => {
      if (hasHydratedRef.current) return;
      console.warn("[FirebaseSync] Hydration timed out. Showing login with local/default data.");
      const localSnapshot = readLocalSnapshot();
      if (localSnapshot) hydrateFromData(localSnapshot);
      setIsConnected(false);
      markHydrated();
    }, 5000);
    const unsubscribe = useTournamentStore.subscribe(state => {
      if (!hasHydratedRef.current) return;
      writeLocalSnapshot(stateToSnapshot(state));
    });
    return () => {
      window.clearTimeout(hydrationTimeout);
      off(rootRef, "value", handler);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const liveState = latestLiveStateRef.current;
      if (!liveState || liveState.timerMode !== "round") return;
      const roundTimer = deriveRoundTimer(liveState);
      if (roundTimer === undefined) return;
      useTournamentStore.setState({
        currentRound: liveState.currentRound ?? useTournamentStore.getState().currentRound,
        roundTimer,
        timerMode: liveState.timerMode,
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider value={{ isConnected, isHydrated }}>
      {children}
    </SyncContext.Provider>
  );
};
