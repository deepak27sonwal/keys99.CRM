"use client";
import { useState } from "react";
import {
  Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Mail, MessageCircle,
  Pencil, Phone, Plus, Upload, X, StickyNote, CalendarPlus, ListChecks, MapPin, IndianRupee,
  Home, Building2, User, Hash, Share2, Target, Layers,
} from "lucide-react";
import KpiCard from "./KpiCard";
import StatusBadge from "./StatusBadge";
import Avatar from "./Avatar";
import { leadDetailNote, leadKpis, leads, progressSteps, statusTabs, type Lead } from "@/lib/data";

const filters = ["Project: All", "Developer: All", "Source: All", "Agent: All", "Status: All"];

function Stepper({ current }: { current: string }) {
  const idx = progressSteps.indexOf(current);
  return (
    <div className="flex items-start">
      {progressSteps.map((s, i) => {
        const done = i < idx, active = i === idx;
        return (
          <div key={s} className="relative flex min-w-0 flex-1 flex-col items-center">
            {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= idx ? "bg-green-500" : "bg-slate-200"}`} />}
            <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white ${
              done ? "border-green-500 bg-green-500 text-white" : active ? "border-gold-500 text-gold-500" : "border-slate-300"}`}>
              {done ? <Check size={14} /> : active ? <Check size={14} /> : null}
            </span>
            <span className={`mt-1 whitespace-nowrap text-[9px] ${active ? "font-semibold text-gold-600" : "text-slate-600"}`}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

function DetailsDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const rows: [React.ElementType, string, string][] = [
    [Hash, "Lead ID", lead.id], [Share2, "Source", lead.source], [Target, "Requirement", lead.requirement.split(" • ")[0]],
    [Home, "Preferred", lead.propertyType], [IndianRupee, "Budget", lead.budget], [Layers, "BHK", lead.bhk],
    [Building2, "Project", lead.project], [MapPin, "Location", lead.location], [User, "Assigned Agent", lead.agent],
    [Calendar, "Next Follow-up", lead.followUp],
  ];
  return (
    <aside className="card flex w-full shrink-0 flex-col overflow-hidden xl:w-[370px]">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-3 text-white">
        <h2 className="text-lg font-bold">Lead Details</h2>
        <button onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-start gap-3">
          <Avatar name={lead.name} size={64} />
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex items-center gap-2"><h3 className="text-lg font-bold">{lead.name}</h3><StatusBadge status={lead.status} /></div>
            <div className="mt-1 flex items-center gap-2 text-slate-700"><Phone size={14} className="text-brand-500" />{lead.mobile}<MessageCircle size={16} className="text-green-500" /></div>
            <div className="mt-0.5 flex items-center gap-2 text-slate-700"><Mail size={14} className="text-brand-500" />{lead.email}</div>
          </div>
          <Pencil size={16} className="text-slate-500" />
        </div>
        <div className="flex gap-4 whitespace-nowrap border-b border-slate-200 text-sm">
          {["Overview", "Activities", "Site Visits", "Documents"].map((t, i) => (
            <button key={t} className={`pb-2 ${i === 0 ? "border-b-2 border-brand-600 font-semibold text-brand-700" : "text-slate-600"}`}>{t}</button>
          ))}
        </div>
        <dl className="rounded-lg border border-slate-200 p-3 text-sm">
          {rows.map(([Icon, k, v]) => (
            <div key={k} className="flex items-center gap-2 border-b border-slate-100 py-1.5 last:border-0">
              <Icon size={15} className="text-brand-500" />
              <dt className="w-32 text-slate-600">{k}</dt><dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-slate-200 p-3">
          <h4 className="mb-3 font-bold">Lead Progress</h4>
          <Stepper current={lead.status === "Qualified" ? "Qualified" : lead.status} />
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <h4 className="mb-2 font-bold">Notes</h4>
          <div className="flex gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <StickyNote size={20} className="shrink-0 text-gold-500" />
            <div><p>{leadDetailNote.text}</p><p className="mt-1 text-xs text-slate-500">{leadDetailNote.meta}</p></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-4">
        <button className="btn justify-center border-brand-500 text-brand-700"><ListChecks size={16} />Add Note</button>
        <button className="btn btn-gold justify-center"><CalendarPlus size={16} />Schedule</button>
      </div>
    </aside>
  );
}

export default function LeadsView() {
  const [tab, setTab] = useState("All Leads");
  const [selected, setSelected] = useState<Lead | null>(leads[0]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const rows = tab === "All Leads" ? leads : leads.filter((l) => (tab === "Booked" ? l.status === "Booked" : l.status === tab));

  const toggle = (id: string) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Leads Management</h1>
            <p className="text-sm text-slate-700">Capture, track and convert your property enquiries.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn"><Upload size={16} />Import Leads</button>
            <button className="btn"><Download size={16} />Export</button>
            <button className="btn btn-gold"><Plus size={16} />Add Lead</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {leadKpis.map((k) => <KpiCard key={k.label} {...k} />)}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((t) => (
            <button key={t.label} onClick={() => setTab(t.label)}
              className={`rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap ${tab === t.label ? "border-brand-700 bg-brand-700 font-semibold text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => <button key={f} className="select flex items-center gap-4 whitespace-nowrap">{f}<ChevronDown size={14} /></button>)}
          <button className="select flex items-center gap-2"><Calendar size={15} />Nov 01, 2026 – Nov 30, 2026</button>
          <button className="select text-gold-600" aria-label="More filters"><Filter size={16} /></button>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-700">
                <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all" onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                {["Lead ID", "Customer", "Mobile", "Requirement", "Project / Location", "Agent", "Status", "Next Follow-up", "Actions"].map((h) => <th key={h} className="px-2 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => setSelected(l)}
                  className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-brand-50/50 ${selected?.id === l.id ? "bg-brand-50/60" : ""}`}>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} /></td>
                  <td className="whitespace-nowrap px-2 text-slate-700">{l.id}</td>
                  <td className="px-2"><div className="flex items-center gap-2"><Avatar name={l.name} size={32} /><span className="whitespace-nowrap font-semibold">{l.name}</span></div></td>
                  <td className="whitespace-nowrap px-2">{l.mobile}</td>
                  <td className="px-2 text-xs leading-tight"><div>{l.requirement}</div><div className="text-slate-600">{l.budget}</div></td>
                  <td className="whitespace-nowrap px-2 text-xs leading-tight"><div className="font-semibold">{l.project}</div><div className="text-slate-600">{l.location}</div></td>
                  <td className="px-2"><div className="flex items-center gap-1.5 whitespace-nowrap"><Avatar name={l.agent} size={24} />{l.agent}</div></td>
                  <td className="px-2"><StatusBadge status={l.status} /></td>
                  <td className="whitespace-nowrap px-2 text-xs"><Calendar size={12} className="mr-1 inline text-slate-500" />{l.followUp}</td>
                  <td className="px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2.5">
                      <Phone size={16} className="text-green-600" /><MessageCircle size={17} className="text-green-500" /><Pencil size={15} className="text-slate-600" />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-slate-500">No leads in this stage in the sample data.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-700">Showing 1 – {rows.length} of 3,248 leads</span>
          <div className="flex items-center gap-2">
            <button className="btn px-2" aria-label="Previous"><ChevronLeft size={16} /></button>
            {["1", "2", "3", "4", "5", "…", "406"].map((p, i) => (
              <button key={i} className={`h-9 min-w-9 rounded-lg border px-2 ${p === "1" ? "border-brand-700 bg-brand-700 font-semibold text-white" : "border-slate-200 bg-white"}`}>{p}</button>
            ))}
            <button className="btn px-2" aria-label="Next"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      {selected && <DetailsDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
