"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { UploadCloud, Building2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Club } from "@/types/tournament";
import { PageHeader, IKFCard, IKFInput, IKFButton, SectionDivider } from "@/components/ui";

const clubSchema = z.object({
  name: z.string().min(2, "Club name is required"),
  country: z.string().min(1, "Country is required"),
  presidentName: z.string().min(2, "President name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(5, "Phone number is required"),
  affiliationNumber: z.string().min(1, "Affiliation number is required"),
  expectedAthletes: z.number().min(1, "Must expect at least 1 athlete"),
  notes: z.string().optional(),
  logoUrl: z.string().optional(),
});

type ClubFormValues = z.infer<typeof clubSchema>;

const COUNTRIES = ["Tunisia 🇹🇳", "Algeria 🇩🇿", "France 🇫🇷", "Morocco 🇲🇦", "Egypt 🇪🇬", "Brazil 🇧🇷", "USA 🇺🇸", "Senegal 🇸🇳", "Italy 🇮🇹", "Spain 🇪🇸", "Japan 🇯🇵"];

export default function RegisterClubPage() {
  const router = useRouter();
  const { addClub } = useTournamentStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClubFormValues>({
    resolver: zodResolver(clubSchema),
  });

  const onSubmit = async (data: ClubFormValues) => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    
    const newClub: Club = {
      id: uuidv4(),
      name: data.name,
      country: data.country,
      presidentName: data.presidentName,
      email: data.email,
      phone: data.phone,
      affiliationNumber: data.affiliationNumber,
      expectedAthletes: data.expectedAthletes,
      status: "Active",
      notes: data.notes,
      logoUrl: data.logoUrl,
    };
    
    addClub(newClub);
    
    toast.success(
      <div>
        <p className="font-bold">Club Registered!</p>
        <p className="text-sm font-mono mt-1">{data.name} — {data.affiliationNumber}</p>
      </div>,
      { duration: 5000 }
    );
    
    router.push("/clubs");
  };

  return (
    <div className="p-8 max-w-[800px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader 
        category="REGISTRATION"
        title="NEW CLUB"
        subtitle="Register a club or national delegation"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">President / Head of Delegation *</label>
                <IKFInput {...register("presidentName")} placeholder="Full Name" error={errors.presidentName?.message} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-[var(--text-secondary)] uppercase tracking-wider">Official Affiliation # *</label>
                <IKFInput {...register("affiliationNumber")} placeholder="e.g. IKF-XX-000" className="font-mono uppercase" error={errors.affiliationNumber?.message} />
              </div>
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
              <div className="border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] rounded-lg p-10 flex flex-col items-center justify-center text-center hover:border-[var(--ikf-gold)] transition-colors cursor-pointer group">
                <div className="w-14 h-14 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[rgba(212,160,23,0.1)] transition-all">
                  <UploadCloud size={24} className="text-[var(--text-muted)] group-hover:text-[var(--ikf-gold)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">Drop club logo here or click to upload</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">Vector (SVG) or High-Res PNG (Max 5MB)</p>
              </div>
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
            loading={isSubmitting}
          >
            {isSubmitting ? "REGISTERING CLUB..." : "REGISTER CLUB"}
          </IKFButton>
        </div>
      </form>
    </div>
  );
}
