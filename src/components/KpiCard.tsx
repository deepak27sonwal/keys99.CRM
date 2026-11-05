import {
  ArrowUp, CalendarCheck, CheckSquare, Coins, Handshake, TrendingUp, UserPlus, Users,
} from "lucide-react";

const icons = {
  users: Users, userPlus: UserPlus, check: CheckSquare, calendar: CalendarCheck,
  handshake: Handshake, chart: TrendingUp, coins: Coins, coinsGreen: Coins,
};
export type IconKey = keyof typeof icons;

export default function KpiCard({
  label, value, delta, icon, primary,
}: { label: string; value: string; delta: string; icon: string; primary?: boolean }) {
  const Icon = icons[icon as IconKey] ?? Users;
  const iconColor = primary ? "text-white" : icon === "coinsGreen" ? "text-brand-500" : "text-gold-500";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-4 shadow-card ${
      primary ? "border-brand-700 bg-gradient-to-br from-brand-500 to-brand-800 text-white" : "border-slate-200/70 bg-white"
    }`}>
      <Icon size={34} strokeWidth={1.6} className={`shrink-0 ${iconColor}`} />
      <div className="min-w-0">
        <div className={`whitespace-nowrap text-xs ${primary ? "text-brand-50" : "text-slate-600"}`}>{label}</div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${primary ? "text-green-200" : "text-green-600"}`}>
          <ArrowUp size={12} /> {delta}
        </div>
      </div>
    </div>
  );
}
