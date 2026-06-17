"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onValue, off, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, Club, WeighinRecord, Match, Bracket, Referee, JudgeScore, RoundEvent, TournamentReport, TournamentSettings, RoleAccount } from "@/types/tournament";
import { DEFAULT_CHAMPIONSHIP, NATIONAL_COUNTRY } from "@/lib/nationalCompetition";

interface SyncContextType {
  isConnected: boolean;
}

const SyncContext = createContext<SyncContextType>({ isConnected: false });

export const useSocket = () => useContext(SyncContext);

type AccountLinkKey = "athleteId" | "clubId" | "refereeId";

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
  const prefix = profile.role === "athlete" ? "athlete" : profile.role === "club" ? "club" : profile.role === "corner-referee" ? "corner" : "central";
  const accountStatus = profile.role === "athlete" || profile.role === "club" ? "Approved" : profile.approvalStatus ?? "Approved";
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

  useEffect(() => {
    const rootRef = ref(db, "tournament");
    let connected = false;

    const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
      const data = snapshot.val();
      if (!data) return;
      if (!connected) { connected = true; setIsConnected(true); }

      const store = useTournamentStore;
      let normalizedAccounts = Array.isArray(data.accounts)
        ? data.accounts as RoleAccount[]
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
            approvalStatus: "Approved",
          });
          normalizedAccounts = linked.accounts;
          return {
            ...athlete,
            accountId: linked.accountId,
            country: NATIONAL_COUNTRY,
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
            approvalStatus: "Approved",
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
        store.setState({ matches: (data.matches as Match[]).map(match => ({ ...match, totalRounds: 3 })) });
      }
      if (Array.isArray(data.brackets)) {
        store.setState({ brackets: data.brackets as Bracket[] });
      }
      if (Array.isArray(data.referees)) {
        const normalizedReferees = (data.referees as Referee[]).map(referee => {
          const approvalStatus = referee.approvalStatus ?? "Approved";
          const linked = ensureProfileAccount(normalizedAccounts, {
            id: referee.id,
            name: referee.name,
            role: referee.role === "Corner Judge" ? "corner-referee" : "central-referee",
            linkKey: "refereeId",
            accountId: referee.accountId,
            approvalStatus,
          });
          normalizedAccounts = linked.accounts;
          return {
            ...referee,
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
      if (Array.isArray(data.reports)) {
        store.setState({ reports: data.reports as TournamentReport[] });
      }
      if (data.activeMatch) {
        store.setState({ activeMatch: { ...(data.activeMatch as Match), totalRounds: 3 } });
      }
    };

    onValue(rootRef, handler);
    return () => { off(rootRef, "value", handler); };
  }, []);

  return (
    <SyncContext.Provider value={{ isConnected }}>
      {children}
    </SyncContext.Provider>
  );
};
