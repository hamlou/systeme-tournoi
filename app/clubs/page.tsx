"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Building2, Edit2, User, Trash2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, Club } from "@/types/tournament";
import { PageHeader, IKFButton, IKFCard, IKFBadge, IKFEmptyState } from "@/components/ui";
import { t } from "@/lib/i18n";

function ClubLogo({ club }: { club: Club }) {
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <div className="relative w-16 h-16 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center overflow-hidden flex-shrink-0">
      {club.logoUrl && !imageFailed ? (
        <Image
          src={club.logoUrl}
          alt={`${club.name} logo`}
          fill
          sizes="64px"
          className="object-contain p-1.5"
          unoptimized
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Building2 size={28} className="text-[var(--text-muted)]" />
      )}
    </div>
  );
}

function RosterAthleteAvatar({ athlete }: { athlete: Athlete }) {
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <div className="relative w-8 h-8 rounded-full border-2 border-[var(--bg-card)] bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-110 transition-transform">
      {athlete.photoUrl && !imageFailed ? (
        <Image
          src={athlete.photoUrl}
          alt={`${athlete.fullName} profile photo`}
          fill
          sizes="32px"
          className="object-cover"
          unoptimized
          onError={() => setImageFailed(true)}
        />
      ) : (
        <User size={14} className="text-[var(--text-muted)]" />
      )}
    </div>
  );
}

export default function ClubsPage() {
  const router = useRouter();
  const { clubs, athletes, settings, deleteClub, approveClub } = useTournamentStore();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);

  const handleDeleteClub = (club: Club) => {
    deleteClub(club.id);
    toast.success(`${club.name} removed from registry`);
    setDeleteTarget(null);
  };

  const filteredClubs = useMemo(() => {
    return clubs.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.country.toLowerCase().includes(search.toLowerCase())
    );
  }, [clubs, search]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--ikf-red)] rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(200,16,46,0.1)] border border-[var(--ikf-red)] flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-[var(--ikf-red)]" />
            </div>
            <h2 className="font-display text-2xl text-white mb-2">Delete Club</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Are you sure you want to remove <span className="text-white font-semibold">{deleteTarget.name}</span> ({deleteTarget.country})? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-12 rounded-xl border-2 border-[var(--border-default)] text-white font-bold hover:bg-[rgba(255,255,255,0.05)] transition-all">Cancel</button>
              <button onClick={() => handleDeleteClub(deleteTarget)} className="flex-1 h-12 rounded-xl bg-[var(--ikf-red)] text-white font-bold hover:bg-[#a00d25] transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <PageHeader 
        category={t('management', settings.language)}
        title={t('club_registry', settings.language)}
        subtitle={t('registered_clubs_desc', settings.language)}
        actions={
          <div className="flex gap-3">
            <IKFButton variant="primary" leftIcon={<Building2 size={16} />} onClick={() => router.push('/clubs/register')}>{t('register_club', settings.language)}</IKFButton>
          </div>
        }
      />

      {/* TOP ACTION BAR */}
      <div className="flex items-center bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-default)] shadow-card">
        <div className="w-full max-w-md relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder={t('search_clubs', settings.language)} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)] outline-none transition-all"
          />
        </div>
      </div>

      {/* CLUB GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClubs.length > 0 ? (
          filteredClubs.map(club => (
            <IKFCard 
              key={club.id} 
              glowColor="gold"
              interactive
              className="relative flex flex-col group overflow-visible"
            >
              {/* Top right status badge */}
              <div className="absolute top-4 right-4 z-10">
                <IKFBadge 
                  variant={club.status === "Active" ? "win" : club.status === "Pending" || club.status === "Incomplete" ? "pending" : "cancelled"}
                  label={club.status === "Active" ? t('active', settings.language) : club.status === "Pending" || club.status === "Incomplete" ? t('pending', settings.language) : club.status}
                  size="sm" 
                />
              </div>

              {/* Top section */}
              <div className="mb-6 flex items-start gap-4 pr-24">
                <ClubLogo club={club} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-4xl text-[var(--text-primary)] group-hover:text-[var(--ikf-gold)] transition-colors leading-none mb-2 truncate">
                    {club.name}
                  </h3>
                  <p className="text-sm font-semibold text-[var(--text-secondary)] tracking-wide uppercase truncate">
                    {club.country}
                  </p>
                </div>
              </div>

              {/* Middle stats */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-3 text-center">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase mb-1">{t('athletes', settings.language)}</div>
                    <div className="text-3xl font-display text-white">{athletes.filter(a => a.clubId === club.id).length}</div>
                </div>
                <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-3 text-center">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase mb-1">{t('confirmed', settings.language)}</div>
                  <div className="font-mono text-xl text-[var(--status-win)]">{athletes.filter(a => a.clubId === club.id && a.weighInStatus === 'Confirmed').length}</div>
                </div>
                <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-3 text-center">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase mb-1">{t('pending', settings.language)}</div>
                  <div className="font-mono text-xl text-[var(--status-draw)]">{athletes.filter(a => a.clubId === club.id && a.weighInStatus === 'Pending').length}</div>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                {(club.approvalStatus ?? (club.status === "Active" ? "Approved" : "Pending")) !== "Approved" && (
                  <IKFButton variant="secondary" size="sm" leftIcon={<CheckCircle2 size={14} />} onClick={(event) => { event.stopPropagation(); approveClub(club.id); }}>
                    Approve
                  </IKFButton>
                )}
                <IKFButton variant="ghost" size="sm" leftIcon={<Edit2 size={14} />} onClick={(event) => { event.stopPropagation(); router.push(`/clubs/register?edit=${club.id}`); }}>
                  Edit Club
                </IKFButton>
                <IKFButton variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={(event) => { event.stopPropagation(); setDeleteTarget(club); }}>
                  Delete
                </IKFButton>
              </div>

              {/* Bottom Avatars */}
              <div className="mt-auto pt-4 border-t border-[var(--border-default)] flex items-center gap-3">
                <span className="text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase flex-shrink-0">{t('roster', settings.language)}</span>
                <div className="flex items-center -space-x-2">
                  {athletes.filter(a => a.clubId === club.id).slice(0, 5).map(athlete => (
                    <RosterAthleteAvatar key={athlete.id} athlete={athlete} />
                  ))}
                  {athletes.filter(a => a.clubId === club.id).length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--bg-card)] bg-[rgba(212,160,23,0.1)] flex items-center justify-center z-0 ml-1">
                      <span className="text-[10px] font-bold text-[var(--ikf-gold)]">+{athletes.filter(a => a.clubId === club.id).length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            </IKFCard>
          ))
        ) : (
          <div className="col-span-full">
            <IKFEmptyState 
              icon={<Building2 size={48} />}
              title={t('no_clubs_registered', settings.language)}
              subtitle={t('no_clubs_desc', settings.language)}
              actionLabel={t('register_first_club', settings.language)}
              onAction={() => router.push('/clubs/register')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
