import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Ban, Calendar, CalendarCheck, Check, ChevronRight, Coins, Copy, FileText, Flag,
  Handshake, Mail, MapPin, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, RefreshCw, Star, Target,
  User, Users, X, ExternalLink, Building2, Zap, ListChecks, ChevronDown, Briefcase, Bell,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import StatusBadge from "@/components/StatusBadge";
import PropertyThumb from "@/components/PropertyThumb";
import { customerProfile as c } from "@/lib/data";

const statIcons: Record<string, React.ElementType> = { users: Users, calendar: CalendarCheck, handshake: Handshake, coins: Coins };
const projectChip: Record<string, string> = {
  "Site Visited": "bg-green-100 text-green-700", Interested: "bg-blue-100 text-blue-700", Shortlisted: "bg-amber-100 text-amber-800",
};
const timelineStyle: Record<string, { bg: string; icon: React.ElementType }> = {
  call: { bg: "bg-green-600", icon: Phone }, visit: { bg: "bg-blue-500", icon: CalendarCheck },
  doc: { bg: "bg-gold-500", icon: FileText }, new: { bg: "bg-slate-400", icon: Plus },
};

function Title({ icon: Icon, children, action }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={20} className="text-brand-500" />
      <h3 className="text-base font-bold">{children}</h3>
      <div className="ml-auto">{action}</div>
    </div>
  );
}

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
          <dt className="text-slate-600">{k}</dt><dd className="font-medium text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CustomerProfile() {
  const order = ["New", "Contacted", "Interested", "Qualified", "Site Visit", "Negotiation", "Booking"];
  const cur = order.indexOf("Qualified");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-slate-700">Customers <ChevronRight size={14} /> <b>{c.name}</b></div>
          <h1 className="text-3xl font-extrabold tracking-tight">Customer Profile</h1>
          <p className="text-sm text-slate-700">Complete customer view with requirements, interactions, site visits and deal history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads" className="btn btn-brand"><ArrowLeft size={16} />Back</Link>
          <button className="btn"><Pencil size={15} />Edit Profile</button>
          <button className="btn btn-gold"><Handshake size={16} />Convert to Deal</button>
          <button className="btn"><Calendar size={15} />Add Task</button>
          <button className="btn">More <ChevronDown size={14} /></button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
        <section className="card flex gap-4 p-4">
          <Avatar name={c.name} size={110} />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><h2 className="text-xl font-bold">{c.name}</h2><StatusBadge status={c.status} /><Pencil size={15} className="ml-auto text-slate-500" /></div>
            <div className="flex items-center gap-2"><Phone size={15} className="text-brand-500" />{c.mobile}<MessageCircle size={17} className="text-green-500" /></div>
            <div className="flex items-center gap-2"><Mail size={15} className="text-brand-500" />{c.email}</div>
            <div className="flex items-center gap-2"><MapPin size={15} className="text-brand-500" />{c.location}</div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"><Star size={13} className="fill-gold-500 text-gold-500" />{c.priority}</span>
          </div>
        </section>

        <section className="card p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {c.stats.map((s) => {
              const Icon = statIcons[s.icon];
              return (
                <div key={s.label} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <Icon size={30} strokeWidth={1.6} className="text-brand-500" />
                  <div><div className="text-xl font-bold leading-tight">{s.value}</div><div className="text-xs text-slate-600">{s.label}</div></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-start">
            {order.map((s, i) => (
              <div key={s} className="relative flex flex-1 flex-col items-center text-xs">
                {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= cur ? "bg-green-700" : "bg-slate-200"}`} />}
                <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  i < cur ? "border-green-700 bg-green-700 text-white" : i === cur ? "border-gold-500 bg-gold-500 text-white" : "border-slate-300 bg-white"}`}>
                  {i <= cur && <Check size={13} />}
                </span>
                <span className={`mt-1 ${i === cur ? "font-bold text-gold-600" : "text-slate-700"}`}>{s}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="card flex flex-wrap gap-1 p-1.5 text-sm">
        {c.tabs.map((t, i) => (
          <button key={t} className={`rounded-lg px-4 py-2 ${i === 0 ? "bg-brand-700 font-semibold text-white" : "text-slate-700 hover:bg-slate-50"}`}>{t}</button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_340px]">
        <div className="space-y-4">
          <section className="card p-4">
            <Title icon={User}>Customer Details</Title>
            <KeyValues rows={[
              ["Customer ID", <span key="i" className="flex items-center gap-2">{c.id}<Copy size={13} className="text-slate-500" /></span>],
              ["Name", c.name],
              ["Mobile", <span key="m" className="flex items-center gap-2">{c.mobile}<MessageCircle size={15} className="text-green-500" /></span>],
              ["Email", c.email], ["Location", c.location], ["Age", c.age], ["Occupation", c.occupation], ["Family", c.family],
              ["Assigned Agent", <span key="a" className="flex items-center gap-2"><Avatar name={c.agent} size={22} />{c.agent}</span>],
              ["Created On", c.createdOn], ["Lead Source", c.source],
            ]} />
          </section>
          <section className="card p-4">
            <Title icon={Building2} action={<button className="btn px-2.5 py-1 text-xs"><Plus size={13} />Add Project</button>}>Interested Projects ({c.interestedProjects.length})</Title>
            <ul className="space-y-2.5">
              {c.interestedProjects.map((p) => (
                <li key={p.name} className="flex items-center gap-3">
                  <PropertyThumb className="h-14 w-20 shrink-0" />
                  <div className="min-w-0 flex-1 text-xs leading-tight">
                    <div className="text-sm font-bold">{p.name}</div>
                    <div className="text-slate-600">By {p.developer}</div>
                    <div className="flex items-center gap-1 text-slate-600"><MapPin size={11} className="text-brand-500" />{p.location}</div>
                  </div>
                  <span className={`rounded px-2.5 py-1 text-xs font-semibold ${projectChip[p.status]}`}>{p.status}</span>
                  <ExternalLink size={15} className="text-brand-500" />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-4">
            <Title icon={Target} action={<Pencil size={15} className="text-slate-500" />}>Requirement &amp; Preferences</Title>
            <KeyValues rows={c.requirement} />
          </section>
          <section className="card p-4">
            <Title icon={Zap}>Current Status &amp; Next Action</Title>
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-[110px_1fr] items-center gap-2"><dt className="text-slate-600">Lead Status</dt>
                <dd className="flex items-center justify-between rounded bg-green-100 px-3 py-1 font-semibold text-green-700">Qualified <ChevronDown size={14} /></dd></div>
              <div className="grid grid-cols-[110px_1fr] items-center gap-2"><dt className="text-slate-600">Next Follow-up</dt>
                <dd className="flex items-center gap-2"><Calendar size={14} className="text-slate-600" />Nov 05, 2026, 04:00 PM<Pencil size={13} className="ml-auto text-slate-500" /></dd></div>
              <div className="grid grid-cols-[110px_1fr] items-center gap-2"><dt className="text-slate-600">Action</dt>
                <dd className="flex items-center gap-2"><ListChecks size={14} className="text-slate-600" />Share pricing &amp; schedule site visit</dd></div>
            </dl>
          </section>
          <section className="card p-4">
            <Title icon={Handshake} action={<Link href="#" className="btn px-2.5 py-1 text-xs">View Deal <ArrowRight size={12} /></Link>}>Deal / Booking Summary</Title>
            <div className="grid grid-cols-[1fr_150px] gap-3">
              <KeyValues rows={[...c.deal, ["Commission Status", <span key="s" className="rounded bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pending</span>]]} />
              <PropertyThumb className="h-32 w-full" />
            </div>
          </section>
        </div>

        <section className="card p-4">
          <Title icon={Bell}>Activity Timeline</Title>
          <ol className="space-y-4">
            {c.timeline.map((t, i) => {
              const s = timelineStyle[t.type];
              const Icon = s.icon;
              return (
                <li key={i} className="relative flex gap-3">
                  {i < c.timeline.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-slate-200" />}
                  <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${s.bg}`}><Icon size={15} /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex justify-between gap-2"><b>{t.title}</b><span className="whitespace-nowrap text-xs text-slate-600">{t.time}</span></div>
                    <div className="flex justify-between gap-2"><p className="text-xs text-slate-600">{t.desc}</p>{t.by && <span className="whitespace-nowrap text-xs text-slate-600">{t.by}</span>}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="card flex flex-wrap items-center gap-4 p-4">
        <Flag size={34} strokeWidth={1.5} className="text-brand-600" />
        <div className="mr-2"><h3 className="text-lg font-bold">Lead Outcome</h3><p className="text-xs text-slate-600">Update final status for this lead.</p></div>
        <button className="btn border-green-400 bg-green-50 text-green-700"><Check size={16} />Keep Active</button>
        <button className="btn border-gold-400 bg-amber-50 text-amber-800"><RefreshCw size={15} />Reopen Lead</button>
        <button className="btn border-red-300 bg-red-50 text-red-600"><X size={16} />Mark as Lost</button>
        <button className="btn"><Ban size={15} />Mark as Spam</button>
        <div className="ml-auto min-w-56 border-l border-slate-200 pl-4">
          <label className="text-xs font-semibold" htmlFor="lost">Lost Reason (If Lost)</label>
          <select id="lost" className="select mt-1 w-full"><option>Select reason...</option><option>Budget mismatch</option><option>Bought elsewhere</option><option>Not responding</option><option>Location not suitable</option></select>
        </div>
      </section>
    </div>
  );
}
