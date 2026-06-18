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

    const hydrateFromData = (rawData: TournamentSnapshot) => {
      const data = rawData;
      const store = useTournamentStore;
      const rawReferees = Array.isArray(data.referees) ? data.referees as LegacyReferee[] : [];
      const legacyTableChiefIds = new Set(
        rawReferees
          .filter(isLegacyCentralReferee)
          .map(referee => referee.id),
      );

      let normalizedAccounts = Array.isArray(data.accounts)
        ? (data.accounts as LegacyRoleAccount[]).map(normalizeAccount)
        : store.getState().accounts;

      // Sync each collection into the Zustand store
      if (data.settings) {
        const settings = data.settings as TournamentSettings;
        store.setState({ settings: { ...settings, championshipName: settings.championshipName ?? DEFAULT_CHAMPIONSHIP } });
      }
      if (Array.isArray(data.athletes)) {
        const normalizedAthletes = (data.athletes as Athlete[]).map(athlete => {
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
        store.setState({
          athletes: normalizedAthletes,
        });
      }
      if (Array.isArray(data.clubs)) {
        const normalizedClubs = (data.clubs as Club[]).map(club => {
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
        store.setState({
          clubs: normalizedClubs,
        });
      }
      if (Array.isArray(data.weighinRecords)) {
        store.setState({ weighinRecords: data.weighinRecords as WeighinRecord[] });
      }
      if (Array.isArray(data.matches)) {
        store.setState({
          matches: (data.matches as Match[]).map(match => {
            const normalized = normalizeMatch(match);
            const shouldUseTableChief = !normalized.assignedRefereeId || legacyTableChiefIds.has(normalized.assignedRefereeId);
            return {
              ...normalized,
              assignedRefereeId: shouldUseTableChief ? TABLE_CHIEF_ASSIGNMENT_ID : normalized.assignedRefereeId,
            };
          }),
        });
      }
      if (Array.isArray(data.brackets)) {
        store.setState({ brackets: (data.brackets as Bracket[]).map(bracket => ({
          ...bracket,
          weightCategory: normalizeWeightCategory(bracket.weightCategory),
        })) });
      }
      if (Array.isArray(data.referees)) {
        const normalizedReferees = (data.referees as LegacyReferee[])
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
        store.setState({
          referees: normalizedReferees,
        });
      }
      if (Array.isArray(data.accounts) || Array.isArray(data.athletes) || Array.isArray(data.clubs) || Array.isArray(data.referees)) {
        store.setState({ accounts: normalizedAccounts });
      }
      if (Array.isArray(data.judgeScores)) {
        store.setState({ judgeScores: data.judgeScores as JudgeScore[] });
      }
      if (data.events) {
        const events = Array.isArray(data.events)
          ? data.events
          : Object.values(data.events as Record<string, RoundEvent>);
        store.setState({ roundEvents: events as RoundEvent[] });
      }
      if (data.judging) {
        const { scores, events } = flattenJudgingData(data.judging);
        store.setState(state => ({
          judgeScores: mergeByKey(
            state.judgeScores,
            scores,
            score => `${score.matchId}-${score.judgeId}-${score.round}`,
          ),
          roundEvents: mergeByKey(
            state.roundEvents,
            events,
            event => event.id ?? `${event.timestamp}-${event.type}-${event.corner ?? ""}-${event.details}`,
          ),
        }));
      }
      if (Array.isArray(data.reports)) {
        store.setState({ reports: data.reports as TournamentReport[] });
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
      hasHydratedRef.current = true;
      setIsHydrated(true);
    };

    const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
      const data = snapshot.val() as TournamentSnapshot | null;
      if (!connected) { connected = true; setIsConnected(true); }
      if (!data) {
        const localSnapshot = readLocalSnapshot();
        if (localSnapshot) hydrateFromData(localSnapshot);
        hasHydratedRef.current = true;
        setIsHydrated(true);
        return;
      }
      hydrateFromData(data);
    };

    const handleError = (error: Error) => {
      console.warn("[FirebaseSync] Falling back to local snapshot", error);
      const localSnapshot = readLocalSnapshot();
      if (localSnapshot) hydrateFromData(localSnapshot);
      hasHydratedRef.current = true;
      setIsConnected(false);
      setIsHydrated(true);
    };

    onValue(rootRef, handler, handleError);
    const unsubscribe = useTournamentStore.subscribe(state => {
      if (!hasHydratedRef.current) return;
      writeLocalSnapshot(stateToSnapshot(state));
    });
    return () => {
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
