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
import { COUNTRIES } from "@/lib/countries";
import { uploadProfileImage } from "@/lib/imgbb";

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
  const router = useRouter();
  const params = useSearchParams();
  const editId = params?.get("edit");
  const { clubs, addClub, updateClub } = useTournamentStore();
  const editingClub = editId ? clubs.find(c => c.id === editId) : null;

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
      country: editingClub.country,
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
      toast.success(storedRemotely ? "Logo uploaded successfully" : "Logo saved directly to the database");
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
      toast.success(`${data.name} updated successfully`);
      router.push("/clubs");
      return;
    }

    const countryCode = data.country.match(/[A-Z]{2,}/)?.[0]?.slice(0, 2) ?? data.country.slice(0, 2).toUpperCase();
    const affiliationNumber = `IKF-${countryCode}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newClub: Club = {
      id: uuidv4(),
      name: data.name,
      country: data.country,
      presidentName: data.presidentName,
      email: data.email,
      phone: data.phone,
      affiliationNumber,
      expectedAthletes: data.expectedAthletes,
      status: "Active",
      notes: data.notes,
      logoUrl: logoUrl,
    };
    
    addClub(newClub);
    
    toast.success(
      <div>
        <p className="font-bold">Club Registered!</p>
        <p className="text-sm font-mono mt-1">{data.name}</p>
      </div>,
      { duration: 5000 }
    );
    
    router.push("/clubs");
  };

  return (
    <div className="p-8 max-w-[800px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category="REGISTRATION"
        title={editingClub ? "EDIT CLUB" : "NEW CLUB"}
        subtitle={editingClub ? `Editing: ${editingClub.name}` : "Register a club or national delegation"}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <IKFCard padding="lg">
          <SectionDivider label="CLUB DETAILS" accent="gold" className="mt-0 mb-6" icon={<Building2 size={14} />} />
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Club Official Name *</label>
              <IKFInput {...register("name")} placeholder="e.g. Kenshido Elite Academy" error={errors.name?.message} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Country *</label>
              <select 
                {...register("country")}
                className={`w-full bg-[var(--bg-elevated)] border rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors ${errors.country ? 'border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)]' : 'border-[var(--border-default)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red-muted)]'}`}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.country && <p className="text-[var(--ikf-red)] text-xs mt-1.5">{errors.country.message}</p>}
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
          <IKFButton variant="ghost" type="button" onClick={() => router.push("/clubs")}>Cancel</IKFButton>
          <IKFButton
            type="submit"
            variant="gold"
            size="xl"
            className="text-lg tracking-widest shadow-[var(--shadow-gold-glow)]"
            loading={isSubmitting || isUploading}
            disabled={isUploading}
          >
            {isUploading ? "UPLOADING LOGO..." : isSubmitting ? (editingClub ? "SAVING CLUB..." : "REGISTERING CLUB...") : (editingClub ? "SAVE CLUB" : "REGISTER CLUB")}
          </IKFButton>
        </div>
      </form>
    </div>
  );
}
