"use client";

import React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { UploadCloud, Building2, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Club } from "@/types/tournament";
import { PageHeader, IKFCard, IKFInput, IKFButton, SectionDivider } from "@/components/ui";
import { uploadProfileImage } from "@/lib/imgbb";
import { getStoredRoleSession } from "@/components/auth/AuthGate";
import { NATIONAL_COUNTRY } from "@/lib/nationalCompetition";

const clubSchema = z.object({
  name: z.string().min(2, "Club name is required"),
  country: z.string().min(1, "Country is required"),
  presidentName: z.string().min(2, "President name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(5, "Phone number is required"),
  expectedAthletes: z.number().min(1, "Must expect at least 1 athlete"),
  notes: z.string().optional(),
  logoUrl: z.string().optional(),
});

type ClubFormValues = z.infer<typeof clubSchema>;

export default function RegisterClubPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-8 w-8 rounded-full border-2 border-[var(--border-default)] border-t-[var(--ikf-red)] animate-spin" /></div>}>
      <RegisterClubContent />
    </React.Suspense>
  );
}

function RegisterClubContent() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params?.get("edit");
  const { clubs, athletes, matches, addClub, updateClub, updateAccount } = useTournamentStore();
  const [session, setSession] = React.useState<ReturnType<typeof getStoredRoleSession>>(null);

  React.useEffect(() => {
    setSession(getStoredRoleSession());
  }, []);

  const ownClub = session?.role === "club"
    ? clubs.find(c => c.accountId === session.accountId || c.id === session.clubId)
    : null;
  const editingClub = editId ? clubs.find(c => c.id === editId) : ownClub ?? null;
  const isSelfRegistration = session?.role === "club";
  const clubUpcomingMatches = React.useMemo(() => {
    if (!ownClub) return [];
    const clubAthleteIds = new Set(athletes.filter(athlete => athlete.clubId === ownClub.id).map(athlete => athlete.id));
    return matches
      .filter(match => match.status !== "completed" && (clubAthleteIds.has(match.redCornerId) || clubAthleteIds.has(match.blueCornerId)))
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .slice(0, 5);
  }, [athletes, matches, ownClub]);

  const [logoUrl, setLogoUrl] = React.useState(editingClub?.logoUrl ?? "");
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    if (editingClub?.logoUrl) setLogoUrl(editingClub.logoUrl);
  }, [editingClub?.logoUrl]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClubFormValues>({
    resolver: zodResolver(clubSchema),
    defaultValues: editingClub ? {
      name: editingClub.name,
      country: NATIONAL_COUNTRY,
      presidentName: editingClub.presidentName,
      email: editingClub.email,
      phone: editingClub.phone,
      expectedAthletes: editingClub.expectedAthletes,
      notes: editingClub.notes ?? "",
    } : undefined,
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { url, storedRemotely } = await uploadProfileImage(file, { maxSize: 640 });
      setLogoUrl(url);
      toast.success(storedRemotely ? "Logo uploaded successfully" : "Logo saved to database");
    } catch {
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: ClubFormValues) => {
    if (isUploading) {
      toast.error("Please wait for the logo upload to finish before saving.");
      return;
    }
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    
    const duplicateClub = clubs.find(c => c.id !== editingClub?.id && c.name.trim().toLowerCase() === data.name.trim().toLowerCase());
    if (duplicateClub) {
      toast.error("A club with this name already exists.");
      return;
    }

    if (editingClub) {
      updateClub(editingClub.id, {
        name: data.name,
        country: data.country,
        presidentName: data.presidentName,
        email: data.email,
        phone: data.phone,
        expectedAthletes: data.expectedAthletes,
        notes: data.notes,
        logoUrl: logoUrl,
      });
      if (isSelfRegistration && session?.accountId) {
        updateAccount(session.accountId, { clubId: editingClub.id, displayName: data.name });
      }
      toast.success(`${data.name} updated successfully`);
      router.push(isSelfRegistration ? "/clubs/register" : "/clubs");
      return;
    }

    const affiliationNumber = `IKF-TN-${Math.floor(100000 + Math.random() * 900000)}`;

    const newClub: Club = {
      id: uuidv4(),
      name: data.name,
      country: NATIONAL_COUNTRY,
      presidentName: data.presidentName,
      email: data.email,
      phone: data.phone,
      affiliationNumber,
      expectedAthletes: data.expectedAthletes,
      status: isSelfRegistration ? "Pending" : "Active",
      approvalStatus: isSelfRegistration ? "Pending" : "Approved",
      accountId: isSelfRegistration ? session?.accountId : undefined,
      notes: data.notes,
      logoUrl: logoUrl,
    };
    
    addClub(newClub);
    if (isSelfRegistration && session?.accountId) {
      updateAccount(session.accountId, { clubId: newClub.id, displayName: data.name });
    }
    
    toast.success(
      <div>
        <p className="font-bold">{isSelfRegistration ? "Club Submitted!" : "Club Registered!"}</p>
        <p className="text-sm font-mono mt-1">{data.name}</p>
      </div>,
      { duration: 5000 }
    );
    
    router.push(isSelfRegistration ? "/clubs/register" : "/clubs");
  };

  // ── If club already submitted their profile, show status instead of blank form ──
  if (isSelfRegistration && ownClub && !editId) {
    return (
      <div className="p-8 max-w-[700px] mx-auto animate-fade-in">
        <PageHeader category="MY CLUB" title="REGISTRATION STATUS" subtitle={`Welcome, ${ownClub.name}`} />
        <div className={`rounded-xl border p-6 mt-6 ${ownClub.approvalStatus === "Approved" ? "border-[rgba(46,204,113,0.35)] bg-[rgba(46,204,113,0.07)]" : "border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.08)]"}`}>
          <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${ownClub.approvalStatus === "Approved" ? "text-[var(--status-win)]" : "text-[var(--ikf-gold)]"}`}>
            {ownClub.approvalStatus === "Approved" ? "✅ Approved by Table Chef" : "⏳ Waiting for Table Chef Approval"}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{ownClub.name}</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Affiliation: <span className="font-mono text-white">{ownClub.affiliationNumber}</span> &nbsp;·&nbsp; {ownClub.country}
          </p>
          {ownClub.approvalStatus === "Approved" ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Your club has been <strong className="text-[var(--status-win)]">approved by the Table Chef</strong>. Athletes can now register under your club.
              {clubUpcomingMatches.length > 0 ? ` You have ${clubUpcomingMatches.length} upcoming match(es) in the system.` : ""}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Your club registration has been submitted and is <strong className="text-[var(--ikf-gold)]">waiting for the Table Chef to review and approve it</strong>.
              Once approved, your athletes will be able to register under your club.
            </p>
          )}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => router.push(`/clubs/register?edit=${ownClub.id}`)}
              className="rounded-md border border-white/20 px-5 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/40 transition"
            >
              Edit Club Profile
            </button>
          </div>
          
          {ownClub.approvalStatus === "Approved" && (
            <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.1)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Club Athletes</h3>
                <button
                  type="button"
                  onClick={() => router.push(`/athletes/register`)}
                  className="rounded-md bg-[var(--ikf-red)] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition shadow-lg hover:-translate-y-0.5"
                >
                  + Add Athlete
                </button>
              </div>
              <div className="space-y-3">
                {athletes.filter(a => a.clubId === ownClub.id || a.clubName === ownClub.name).length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] italic">No athletes registered under this club yet.</p>
                ) : (
                  athletes.filter(a => a.clubId === ownClub.id || a.clubName === ownClub.name).map(athlete => (
                    <div key={athlete.id} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                      <div>
                        <div className="font-bold text-white text-sm">{athlete.fullName}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{athlete.weightCategory} • {athlete.ageGroup}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/athletes/register?edit=${athlete.id}`)}
                        className="text-xs text-[var(--ikf-gold)] font-bold uppercase hover:text-white transition"
                      >
                        Edit
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[800px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category="REGISTRATION"
        title={editingClub ? "EDIT CLUB" : "NEW CLUB"}
        subtitle={editingClub ? `Editing: ${editingClub.name}` : "Register a club or national delegation"}
      />

      {isSelfRegistration && ownClub && (
        <div className="rounded-xl border border-[rgba(212,160,23,0.35)] bg-[rgba(212,160,23,0.08)] p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ikf-gold)] mb-2">Account notification</div>
          <p className="font-bold text-white">
            Club status: {(ownClub.approvalStatus ?? "Pending") === "Approved" ? "Approved by table chief" : "Waiting for table chief approval"}
          </p>
          <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
            {clubUpcomingMatches.length > 0
              ? clubUpcomingMatches.map(match => <p key={match.id}>Match #{match.matchNumber}: {match.redCornerName} vs {match.blueCornerName}, Mat {match.matNumber}</p>)
              : <p>No generated combat is linked to this club yet.</p>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <IKFCard padding="lg">
          <SectionDivider label="CLUB DETAILS" accent="gold" className="mt-0 mb-6" icon={<Building2 size={14} />} />
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Club Official Name *</label>
              <IKFInput {...register("name")} placeholder="e.g. Kenshido Elite Academy" error={errors.name?.message} />
            </div>

            <input type="hidden" value={NATIONAL_COUNTRY} {...register("country")} />
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">National Country</label>
              <div className="w-full bg-[rgba(212,160,23,0.05)] border border-[rgba(212,160,23,0.3)] rounded-md px-3 py-2.5 text-sm text-[var(--ikf-gold)] font-bold">
                {NATIONAL_COUNTRY}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">President / Head of Delegation *</label>
              <IKFInput {...register("presidentName")} placeholder="Full Name" error={errors.presidentName?.message} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Contact Email *</label>
                <IKFInput type="email" {...register("email")} placeholder="contact@club.com" error={errors.email?.message} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Contact Phone *</label>
                <IKFInput {...register("phone")} placeholder="+1 234 567 890" error={errors.phone?.message} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Expected Number of Athletes *</label>
              <input 
                type="number" 
                {...register("expectedAthletes", { valueAsNumber: true })} 
                placeholder="0"
                min="1"
                className={`w-full bg-[var(--bg-elevated)] border rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none font-mono transition-colors ${errors.expectedAthletes ? 'border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)]' : 'border-[var(--border-default)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red-muted)]'}`}
              />
              {errors.expectedAthletes && <p className="text-[var(--ikf-red)] text-xs mt-1.5">{errors.expectedAthletes.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Club Logo Upload</label>
              <label className="border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] rounded-lg p-10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[var(--ikf-gold)] transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                {logoUrl ? (
                  <Image src={logoUrl} alt="Club logo" width={96} height={96} sizes="96px" className="h-24 w-24 object-contain rounded-lg mb-4" unoptimized />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[rgba(212,160,23,0.1)] transition-all">
                    {isUploading ? <Loader2 size={24} className="text-[var(--ikf-gold)] animate-spin" /> : <UploadCloud size={24} className="text-[var(--text-muted)] group-hover:text-[var(--ikf-gold)]" />}
                  </div>
                )}
                <p className="text-sm font-medium text-[var(--text-secondary)]">{isUploading ? "Uploading..." : logoUrl ? "Click to replace logo" : "Click to upload a logo image"}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">PNG, JPG or SVG.</p>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Notes / Special Requests</label>
              <textarea 
                {...register("notes")} 
                rows={4}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)] transition-colors resize-y"
                placeholder="Any special accommodations or notes for the organizing committee..."
              />
            </div>
          </div>
        </IKFCard>

        <div className="flex gap-4 justify-end">
          <IKFButton variant="ghost" type="button" onClick={() => router.push(isSelfRegistration ? "/clubs/register" : "/clubs")}>Cancel</IKFButton>
          <IKFButton
            type="submit"
            variant="gold"
            size="xl"
            className="text-lg tracking-widest shadow-[var(--shadow-gold-glow)]"
            loading={isSubmitting || isUploading}
            disabled={isUploading}
          >
            {isUploading ? "UPLOADING LOGO..." : isSubmitting ? (editingClub ? "SAVING CLUB..." : "REGISTERING CLUB...") : (editingClub ? "SAVE CLUB" : isSelfRegistration ? "SUBMIT FOR APPROVAL" : "REGISTER CLUB")}
          </IKFButton>
        </div>
      </form>
    </div>
  );
}
