/* eslint-disable */
"use client";
import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  getFilteredRowModel, flexRender, createColumnHelper,
} from "@tanstack/react-table";
import { Search, Eye, Edit2, Trash2, User, UserPlus, Download, X, CheckCircle2 } from "lucide-react";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete } from "@/types/tournament";
import { PageHeader, IKFButton, IKFBadge, IKFEmptyState } from "@/components/ui";
import toast from "react-hot-toast";
import { t } from "@/lib/i18n";

const columnHelper = createColumnHelper<Athlete>();

// ─── Profile Modal ────────────────────────────────────────────────────────────
function AthleteModal({ athlete, onClose }: { athlete: Athlete; onClose: () => void }) {
  const { settings } = useTournamentStore();
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{t('athlete_profile', settings.language)}</div>
            <h2 className="font-display text-3xl text-white">{athlete.fullName}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center mb-6">
          <User size={28} className="text-[var(--text-muted)]" />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            [t('license_number', settings.language), athlete.licenseNumber], [t('dob', settings.language), athlete.dob],
            [t('gender', settings.language), athlete.gender], [t('country', settings.language), athlete.country],
            [t('club', settings.language), athlete.clubName], [t('age_group', settings.language), athlete.ageGroup],
            [t('weight_category', settings.language), athlete.weightCategory], [t('license_type', settings.language), athlete.licenseType],
            [t('medical_clearance', settings.language), athlete.medicalClearance ? "✅ " + t('confirmed', settings.language) : "❌ " + t('pending', settings.language)],
            [t('registration', settings.language), athlete.registrationStatus],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{label}</div>
              <div className="text-white font-semibold">{val}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <IKFBadge variant={athlete.weighInStatus === "Confirmed" ? "win" : athlete.weighInStatus === "Overweight" ? "cancelled" : "pending"} label={`${t('weigh_in', settings.language)}: ${athlete.weighInStatus}`} />
          <IKFBadge variant={athlete.registrationStatus === "Active" ? "win" : athlete.registrationStatus === "Suspended" ? "cancelled" : "loss"} label={athlete.registrationStatus} />
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ athlete, onConfirm, onCancel }: { athlete: Athlete; onConfirm: () => void; onCancel: () => void }) {
  const { settings } = useTournamentStore();
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--ikf-red)] rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        <div className="w-16 h-16 rounded-full bg-[rgba(200,16,46,0.1)] border border-[var(--ikf-red)] flex items-center justify-center mx-auto mb-4">
          <Trash2 size={28} className="text-[var(--ikf-red)]" />
        </div>
        <h2 className="font-display text-2xl text-white mb-2">{t('remove_athlete', settings.language)}</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          {t('remove_athlete_desc', settings.language).replace('{name}', athlete.fullName).replace('{license}', athlete.licenseNumber)}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-12 rounded-xl border-2 border-[var(--border-default)] text-white font-bold hover:bg-[rgba(255,255,255,0.05)] transition-all">{t('cancel', settings.language)}</button>
          <button onClick={onConfirm} className="flex-1 h-12 rounded-xl bg-[var(--ikf-red)] text-white font-bold hover:bg-[#a00d25] transition-all">{t('remove', settings.language)}</button>
        </div>
      </div>
    </div>
  );
}

export default function AthletesPage() {
  const { athletes, deleteAthlete, settings } = useTournamentStore();
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [weightFilter, setWeightFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [viewAthlete, setViewAthlete] = useState<Athlete | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Athlete | null>(null);

  const handleDelete = useCallback((a: Athlete) => {
    deleteAthlete(a.id);
    toast.success(`${a.fullName} removed from registry`);
    setDeleteTarget(null);
  }, [deleteAthlete]);

  const handleExportCSV = () => {
    const headers = ["License #", "Full Name", "DOB", "Gender", "Country", "Club", "Weight Category", "Age Group", "Weigh-in Status", "Registration Status"];
    const rows = athletes.map(a => [
      a.licenseNumber, a.fullName, a.dob, a.gender, a.country,
      a.clubName, a.weightCategory, a.ageGroup, a.weighInStatus, a.registrationStatus,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `IKF-Athletes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Athletes list exported as CSV");
  };

  const filteredData = useMemo(() => {
    return athletes.filter(a => {
      const search = globalFilter.toLowerCase();
      const matchSearch = !search || a.fullName.toLowerCase().includes(search) ||
        a.licenseNumber.toLowerCase().includes(search) || a.clubName.toLowerCase().includes(search) ||
        a.country.toLowerCase().includes(search);
      return matchSearch &&
        (!countryFilter || a.country === countryFilter) &&
        (!weightFilter || a.weightCategory === weightFilter) &&
        (!ageFilter || a.ageGroup === ageFilter);
    });
  }, [athletes, globalFilter, countryFilter, weightFilter, ageFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("licenseNumber", {
      header: t('license_number', settings.language),
      cell: info => <span className="font-mono text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor("photoUrl", {
      header: "",
      cell: () => (
        <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
          <User size={14} className="text-[var(--text-muted)]" />
        </div>
      ),
    }),
    columnHelper.accessor("fullName", {
      header: t('full_name', settings.language),
      cell: info => <span className="font-semibold text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor("ageGroup", {
      header: t('age_group', settings.language),
      cell: info => <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-[var(--border-default)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor("weightCategory", {
      header: t('weight', settings.language),
      cell: info => <span className="font-mono text-sm text-[var(--text-primary)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor("clubName", {
      header: t('club', settings.language),
      cell: info => <span className="text-sm text-[var(--text-secondary)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor("country", {
      header: t('country', settings.language),
      cell: info => <span className="text-sm">{info.getValue()}</span>,
    }),
    columnHelper.accessor("weighInStatus", {
      header: t('weigh_in', settings.language),
      cell: info => {
        const v = info.getValue();
        return <IKFBadge variant={v === "Confirmed" ? "win" : v === "Overweight" ? "cancelled" : "pending"} label={v} size="sm" />;
      },
    }),
    columnHelper.accessor("registrationStatus", {
      header: t('status', settings.language),
      cell: info => {
        const v = info.getValue();
        return <IKFBadge variant={v === "Active" ? "win" : v === "Suspended" ? "cancelled" : "loss"} label={v} size="sm" />;
      },
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewAthlete(row.original)} className="p-1.5 text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] rounded transition-colors" title={t('view_profile', settings.language)}><Eye size={14} /></button>
          <button onClick={() => router.push(`/athletes/register?edit=${row.original.id}`)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--ikf-gold)] hover:bg-[var(--bg-elevated)] rounded transition-colors" title={t('edit', settings.language)}><Edit2 size={14} /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--ikf-red)] hover:bg-[var(--bg-elevated)] rounded transition-colors" title={t('delete', settings.language)}><Trash2 size={14} /></button>
        </div>
      ),
    }),
  ], [router, settings.language]);

  const table = useReactTable({
    data: filteredData, columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 15 } },
  });

  const countries = Array.from(new Set(athletes.map(a => a.country))).sort();
  const weightCats = Array.from(new Set(athletes.map(a => a.weightCategory))).sort();
  const ageGroups = Array.from(new Set(athletes.map(a => a.ageGroup))).sort();

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      {viewAthlete && <AthleteModal athlete={viewAthlete} onClose={() => setViewAthlete(null)} />}
      {deleteTarget && <DeleteConfirmModal athlete={deleteTarget} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />}

      <PageHeader
        category={t('management', settings.language)} title={t('athlete_registry', settings.language)}
        subtitle={`${athletes.length} ${t('competitors_registered', settings.language)}`}
        actions={
          <div className="flex gap-3">
            <IKFButton variant="secondary" leftIcon={<Download size={16} />} onClick={handleExportCSV}>{t('export_csv', settings.language)}</IKFButton>
            <IKFButton variant="primary" leftIcon={<UserPlus size={16} />} onClick={() => router.push('/athletes/register')}>{t('register_athlete', settings.language)}</IKFButton>
          </div>
        }
      />

      {/* FILTER BAR */}
      <div className="flex flex-col xl:flex-row gap-4 items-center bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-default)] shadow-card">
        <div className="flex-1 w-full relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" placeholder={t('search_athletes', settings.language)}
            value={globalFilter ?? ""}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--ikf-red)] focus:ring-1 focus:ring-[var(--ikf-red)] outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-4 w-full xl:w-auto">
          {[
            { value: countryFilter, onChange: setCountryFilter, options: countries, placeholder: t('all_countries', settings.language) },
            { value: weightFilter, onChange: setWeightFilter, options: weightCats, placeholder: t('all_weights', settings.language) },
            { value: ageFilter, onChange: setAgeFilter, options: ageGroups, placeholder: t('all_ages', settings.language) },
          ].map(({ value, onChange, options, placeholder }) => (
            <select key={placeholder}
              className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ikf-red)] min-w-[150px] flex-1 md:flex-none"
              value={value} onChange={e => onChange(e.target.value)}>
              <option value="">{placeholder}</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)]">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th key={h.id} className="px-4 py-3.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] whitespace-nowrap">
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(200,16,46,0.06)] transition-colors group">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3.5 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-0">
                    <IKFEmptyState icon={<User size={48} />} title={t('no_athletes_found', settings.language)}
                      subtitle={t('no_athletes_match', settings.language)}
                      actionLabel={t('register_first_athlete', settings.language)} onAction={() => router.push('/athletes/register')} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-card)]">
          <span className="text-sm text-[var(--text-muted)] font-medium">
            {t('showing', settings.language)} <span className="text-[var(--text-primary)]">{table.getRowModel().rows.length}</span> {t('of', settings.language)}{" "}
            <span className="text-[var(--text-primary)]">{filteredData.length}</span> {t('athletes_lower', settings.language)}
          </span>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="px-4 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm font-medium disabled:opacity-30 hover:bg-[rgba(255,255,255,0.05)] hover:text-white text-[var(--text-secondary)] transition-colors">
              {t('previous', settings.language)}
            </button>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="px-4 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm font-medium disabled:opacity-30 hover:bg-[rgba(255,255,255,0.05)] hover:text-white text-[var(--text-secondary)] transition-colors">
              {t('next', settings.language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

