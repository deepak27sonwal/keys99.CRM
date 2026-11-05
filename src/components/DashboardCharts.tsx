"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { leadSources, leadTrend, monthlyCommission } from "@/lib/data";

export function LeadTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={leadTrend} margin={{ left: -15, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f7a6b" stopOpacity={0.3} /><stop offset="1" stopColor="#0f7a6b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef1f3" vertical={false} />
        <XAxis dataKey="d" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Area type="monotone" dataKey="n" name="New Leads" stroke="#0f7a6b" strokeWidth={2} fill="url(#gN)" dot={{ r: 4, fill: "#fff", stroke: "#0f7a6b", strokeWidth: 2 }} />
        <Area type="monotone" dataKey="c" name="Conversions" stroke="#e8a91f" strokeWidth={2} fill="#e8a91f" fillOpacity={0.12} dot={{ r: 4, fill: "#fff", stroke: "#e8a91f", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LeadSourceDonut() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={leadSources} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={1} stroke="none">
              {leadSources.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold">3,248</div>
          <div className="text-xs text-slate-600">Total Leads</div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {leadSources.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-slate-700">{s.name}</span>
            <span className="text-slate-600">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommissionBars() {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={monthlyCommission} margin={{ left: -25, right: 5 }}>
        <CartesianGrid stroke="#eef1f3" vertical={false} />
        <XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}L`} />
        <Tooltip formatter={(v: number) => [`₹ ${v} L`, "Received"]} />
        <Bar dataKey="v" radius={[4, 4, 0, 0]}>
          {monthlyCommission.map((d, i) => <Cell key={d.m} fill={i === monthlyCommission.length - 1 ? "#e8a91f" : "#0f7a6b"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
