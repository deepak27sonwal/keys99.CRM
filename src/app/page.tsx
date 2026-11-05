import Link from "next/link";
import { ArrowRight, Calendar, CalendarCheck, ChevronDown, Phone, Users2, Wallet, CheckCircle2, Coins, Building2, UserPlus } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import Avatar from "@/components/Avatar";
import { CommissionBars, LeadSourceDonut, LeadTrendChart } from "@/components/DashboardCharts";
import {
  dashboardKpis, developerBookings, pipeline, recentLeads, todaysFollowUps, topAgents, upcomingVisits,
} from "@/lib/data";

function CardHeader({ icon: Icon, title, extra, link = true }: { icon?: React.ElementType; title: React.ReactNode; extra?: React.ReactNode; link?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && <Icon size={20} className="text-brand-500" />}
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {extra}
      {link && (
        <Link href="#" className="ml-auto flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
          View All <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

const funnelColors = ["bg-brand-600", "bg-brand-500", "bg-gold-500", "bg-gold-400", "bg-gold-500"];
const visitStatus: Record<string, string> = { Scheduled: "bg-amber-100 text-amber-800", Confirmed: "bg-green-100 text-green-700" };
const medal = ["bg-gold-400", "bg-slate-300", "bg-orange-400"];

export default function Dashboard() {
  const max = pipeline[0].count;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Good Evening, Deepak! 👋</h1>
          <p className="text-sm text-slate-600">Here&apos;s your Keys99 business overview for Nov 2026.</p>
        </div>
        <button className="btn"><Calendar size={16} /> Nov 01, 2026 – Nov 30, 2026 <ChevronDown size={14} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {dashboardKpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="card p-4 xl:col-span-5">
          <CardHeader title="Lead Trend" link={false} extra={
            <div className="ml-auto flex gap-4 text-xs text-slate-700">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-brand-500" />New Leads</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-gold-500" />Conversions</span>
            </div>} />
          <LeadTrendChart />
        </section>
        <section className="card p-4 xl:col-span-4">
          <CardHeader title="Lead Source" link={false} />
          <LeadSourceDonut />
        </section>
        <section className="card p-4 xl:col-span-3">
          <CardHeader title="Sales Pipeline" />
          <div className="space-y-2">
            {pipeline.map((p, i) => (
              <div key={p.stage} className="flex items-center gap-2">
                <div className="flex-1 rounded bg-slate-100">
                  <div
                    className={`${funnelColors[i]} rounded py-1.5 text-center text-xs font-semibold text-white`}
                    style={{ width: `${Math.max(55, (p.count / max) * 100 - i * 4)}%`, margin: "0 auto" }}
                  >
                    {p.stage}
                  </div>
                </div>
                <span className="w-10 text-right text-sm font-bold">{p.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <CardHeader icon={CalendarCheck} title="Upcoming Site Visits" />
          <ul className="divide-y divide-slate-100 text-sm">
            {upcomingVisits.map((v, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <div className="w-9 rounded bg-slate-100 text-center text-[10px] leading-tight"><div>{v.date}</div><div className="text-sm font-bold">{v.day}</div></div>
                <span className="w-16 text-xs text-slate-600">{v.time}</span>
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{v.project}</div><div className="text-xs text-slate-500">{v.customer}</div></div>
                <Phone size={16} className="text-green-600" />
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${visitStatus[v.status]}`}>{v.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <CardHeader icon={CheckCircle2} title="Today's Follow-ups (8)" />
          <ul className="divide-y divide-slate-100 text-sm">
            {todaysFollowUps.map((f) => (
              <li key={f.name} className="flex items-center gap-3 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{f.initials}</span>
                <div className="flex-1"><div className="font-semibold">{f.name}</div><div className="text-xs text-slate-500">{f.note}</div></div>
                <span className="text-xs text-slate-600">{f.time}</span>
                <Phone size={16} className="text-green-600" />
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <CardHeader icon={Users2} title={<>Top Performing Agents <span className="text-xs font-normal text-slate-500">(This Month)</span></>} />
          <ul className="space-y-3 text-sm">
            {topAgents.map((a, i) => (
              <li key={a.name} className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${medal[i]}`}>{a.rank}</span>
                <Avatar name={a.name} size={36} />
                <span className="flex-1 font-semibold">{a.name}</span>
                <span className="text-xs text-slate-600">{a.bookings} Bookings</span>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{a.amount}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <CardHeader icon={Wallet} title="Bookings & Commission" link={false} />
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-slate-200 p-2"><div className="text-slate-600">Total Bookings</div><div className="text-xl font-bold">136 <span className="text-xs text-green-600">↑ +28%</span></div></div>
              <div className="rounded-lg border border-slate-200 p-2"><div className="flex items-center gap-1 text-slate-600"><Coins size={12} className="text-gold-500" />Commission Due</div><div className="text-lg font-bold">₹ 24.8 L</div></div>
              <div className="rounded-lg border border-slate-200 p-2"><div className="flex items-center gap-1 text-slate-600"><CheckCircle2 size={12} className="text-gold-500" />Commission Received</div><div className="text-lg font-bold">₹ 18.6 L <span className="text-xs text-green-600">+32%</span></div></div>
            </div>
            <div><div className="text-xs font-semibold text-slate-700">Monthly Commission (Received)</div><CommissionBars /></div>
          </div>
        </section>
        <section className="card p-4">
          <CardHeader icon={Building2} title="Developer-wise Bookings" />
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-600"><th className="py-1 font-medium">Developer</th><th className="font-medium">Bookings</th><th className="text-right font-medium">Commission (₹)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {developerBookings.map((d) => (
                <tr key={d.name}><td className="py-2 font-medium">{d.name}</td><td>{d.bookings}</td><td className="text-right font-semibold">{d.commission}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card p-4">
          <CardHeader icon={UserPlus} title="Recent Leads" />
          <ul className="space-y-3 text-sm">
            {recentLeads.map((l) => (
              <li key={l.name} className="flex items-center gap-3">
                <Avatar name={l.name} size={34} />
                <div className="flex-1"><div className="font-semibold">{l.name}</div><div className="text-xs text-slate-500">{l.req}</div></div>
                <div className="text-right"><StatusBadge status={l.status} /><div className="mt-0.5 text-[11px] text-slate-500">{l.ago}</div></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
