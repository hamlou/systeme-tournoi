/* eslint-disable */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { differenceInYears } from "date-fns";
import toast from "react-hot-toast";
import { UploadCloud } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, AgeGroup } from "@/types/tournament";
import { PageHeader, IKFCard, IKFInput, IKFButton, SectionDivider } from "@/components/ui";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female"]),
  country: z.string().min(1, "Country is required"),
  nationalId: z.string().min(5, "National ID/Passport is required"),
  clubId: z.string().min(1, "Club is required"),
  weightCategory: z.string().min(1, "Weight category is required"),
  ageGroup: z.string().min(1, "Age group is required"),
  licenseType: z.enum(["Annual", "Tournament"]),
  medicalClearance: z.boolean().refine(val => val === true, { message: "Medical clearance must be confirmed" }),
});

type FormValues = z.infer<typeof registerSchema>;

const COUNTRIES = ["Tunisia 🇹🇳","Algeria 🇩🇿","France 🇫🇷","Morocco 🇲🇦","Egypt 🇪🇬","Brazil 🇧🇷","USA 🇺🇸","Senegal 🇸🇳","Italy 🇮🇹","Spain 🇪🇸","Germany 🇩🇪","UK 🇬🇧","Russia 🇷🇺","China 🇨🇳","Japan 🇯🇵","Mexico 🇲🇽"];
const WEIGHT_CATEGORIES = ["-40kg","-45kg","-50kg","-55kg","-60kg","-65kg","-70kg","-75kg","-80kg","-85kg","-90kg","+90kg"];

function calculateAgeGroup(dobString: string): AgeGroup {
  if (!dobString) return "Senior A";
  const age = differenceInYears(new Date(), new Date(dobString));
  if (age < 8) return "U8";
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  if (age < 25) return "Senior A";
  if (age < 35) return "Senior B";
  return "Senior C";
}

export default function RegisterAthletePage() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params?.get("edit");
  const { athletes, clubs, addAthlete, updateAthlete } = useTournamentStore();

  const editingAthlete = editId ? athletes.find(a => a.id === editId) : null;

  const licenseNumber = React.useMemo(() =>
    editingAthlete?.licenseNumber ?? `IKF-26-${Math.floor(1000 + Math.random() * 9000)}`, [editingAthlete]);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      licenseType: editingAthlete?.licenseType ?? "Annual",
      medicalClearance: editingAthlete?.medicalClearance ?? false,
      fullName: editingAthlete?.fullName ?? "",
      dob: editingAthlete?.dob ?? "",
      gender: editingAthlete?.gender ?? "Male",
      country: editingAthlete?.country ?? "",
      nationalId: editingAthlete?.nationalId ?? "",
      clubId: editingAthlete?.clubId ?? "",
      weightCategory: editingAthlete?.weightCategory ?? "",
      ageGroup: editingAthlete?.ageGroup ?? "",
    },
  });

  const dobValue = watch("dob");
  React.useEffect(() => {
    if (dobValue) setValue("ageGroup", calculateAgeGroup(dobValue), { shouldValidate: true });
  }, [dobValue, setValue]);

  const onSubmit = async (data: FormValues) => {
    await new Promise(r => setTimeout(r, 600));
    const selectedClub = clubs.find(c => c.id === data.clubId);

    if (editingAthlete) {
      updateAthlete(editingAthlete.id, {
        ...data,
        ageGroup: data.ageGroup as AgeGroup,
        clubName: selectedClub?.name ?? data.clubId,
      });
      toast.success(`${data.fullName} updated successfully`);
    } else {
      const newAthlete: Athlete = {
        id: uuidv4(), licenseNumber,
        ...data,
        ageGroup: data.ageGroup as AgeGroup,
        clubName: selectedClub?.name ?? data.clubId,
        weighInStatus: "Pending",
        registrationStatus: "Active",
      };
      addAthlete(newAthlete);
      toast.success(
        <div><p className="font-bold">Athlete Registered!</p><p className="text-sm font-mono mt-1">{data.fullName} — {licenseNumber}</p></div>,
        { duration: 4000, icon: "✅" }
      );
    }
    router.push("/athletes");
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-fade-in pb-20">
      <PageHeader
        category="MANAGEMENT"
        title={editingAthlete ? "EDIT ATHLETE" : "REGISTER ATHLETE"}
        subtitle={editingAthlete ? `Editing: ${editingAthlete.fullName}` : "Add a new competitor to the tournament registry"}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* LICENSE BADGE */}
        <div className="bg-[rgba(212,160,23,0.05)] border border-[rgba(212,160,23,0.2)] rounded-xl p-5 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-[10px] font-bold text-[var(--ikf-gold)] uppercase tracking-widest mb-1">Auto-Generated License Number</div>
            <div className="font-mono text-2xl font-bold text-white">{licenseNumber}</div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">This will be assigned to the athlete upon registration.</div>
        </div>

        {/* PERSONAL INFO */}
        <IKFCard padding="lg" className="space-y-6">
          <SectionDivider label="PERSONAL INFORMATION" accent="red" className="mt-0" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IKFInput label="Full Name *" placeholder="Enter full legal name" error={errors.fullName?.message} {...register("fullName")} />
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Date of Birth *</label>
              <input type="date" {...register("dob")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all" />
              {errors.dob && <p className="text-xs text-[var(--ikf-red)] mt-1">{errors.dob.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Gender *</label>
              <select {...register("gender")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Country *</label>
              <select {...register("country")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all">
                <option value="">Select country...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.country && <p className="text-xs text-[var(--ikf-red)] mt-1">{errors.country.message}</p>}
            </div>
            <IKFInput label="National ID / Passport *" placeholder="e.g. TN12345678" error={errors.nationalId?.message} {...register("nationalId")} />
          </div>
        </IKFCard>

        {/* COMPETITION INFO */}
        <IKFCard padding="lg" className="space-y-6">
          <SectionDivider label="COMPETITION DETAILS" accent="gold" className="mt-0" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Club / Delegation *</label>
              <select {...register("clubId")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all">
                <option value="">Select club...</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
              </select>
              {errors.clubId && <p className="text-xs text-[var(--ikf-red)] mt-1">{errors.clubId.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Weight Category *</label>
              <select {...register("weightCategory")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all">
                <option value="">Select weight...</option>
                {WEIGHT_CATEGORIES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              {errors.weightCategory && <p className="text-xs text-[var(--ikf-red)] mt-1">{errors.weightCategory.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Age Group (Auto-calculated)</label>
              <input {...register("ageGroup")} readOnly
                className="w-full bg-[rgba(212,160,23,0.05)] border border-[rgba(212,160,23,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--ikf-gold)] font-bold outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">License Type *</label>
              <select {...register("licenseType")} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-white focus:border-[var(--ikf-red)] outline-none transition-all">
                <option value="Annual">Annual</option>
                <option value="Tournament">Tournament</option>
              </select>
            </div>
          </div>

          {/* Medical clearance */}
          <div className="flex items-start gap-4 bg-[rgba(46,204,113,0.05)] border border-[rgba(46,204,113,0.2)] rounded-xl p-5">
            <input type="checkbox" id="medical" {...register("medicalClearance")} className="w-5 h-5 mt-0.5 accent-[var(--status-win)] cursor-pointer" />
            <label htmlFor="medical" className="cursor-pointer">
              <div className="font-semibold text-sm text-white">Medical Clearance Confirmed</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">I confirm this athlete has valid medical clearance for competition. Required for registration.</div>
            </label>
          </div>
          {errors.medicalClearance && <p className="text-xs text-[var(--ikf-red)]">{errors.medicalClearance.message}</p>}
        </IKFCard>

        {/* SUBMIT */}
        <div className="flex gap-4 justify-end">
          <IKFButton variant="ghost" type="button" onClick={() => router.push("/athletes")}>Cancel</IKFButton>
          <IKFButton variant="primary" type="submit" loading={isSubmitting} size="lg">
            {editingAthlete ? "Save Changes" : "Register Athlete"}
          </IKFButton>
        </div>
      </form>
    </div>
  );
}

