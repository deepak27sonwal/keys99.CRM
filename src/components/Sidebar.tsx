"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UserSearch, Users, Building2, Landmark, MapPin, Filter,
  FileSignature, Wallet, UsersRound, Megaphone, ListChecks, FileText, BarChart3, Settings,
} from "lucide-react";
import { BuildingArt } from "./PropertyThumb";

const items = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads Management", href: "/leads", icon: UserSearch },
  { label: "Customers", href: "/customers/C-10586", match: "/customers", icon: Users },
  { label: "Developers", href: "#", icon: Building2 },
  { label: "Projects", href: "#", icon: Landmark },
  { label: "Site Visits", href: "#", icon: MapPin },
  { label: "Sales Pipeline", href: "#", icon: Filter },
  { label: "Bookings & Deals", href: "#", icon: FileSignature },
  { label: "Commissions", href: "#", icon: Wallet },
  { label: "Agents & Teams", href: "#", icon: UsersRound },
  { label: "Marketing & Campaigns", href: "#", icon: Megaphone },
  { label: "Tasks & Follow-ups", href: "#", icon: ListChecks },
  { label: "Documents", href: "#", icon: FileText },
  { label: "Reports & Analytics", href: "#", icon: BarChart3 },
  { label: "Settings", href: "#", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const isActive = (i: (typeof items)[number]) =>
    i.href === "/" ? path === "/" : i.href !== "#" && path.startsWith(i.match ?? i.href);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-brand-700 via-brand-800 to-brand-900 text-white lg:flex">
      <div className="px-5 pb-4 pt-5 text-center">
        <div className="text-3xl font-extrabold tracking-tight">
          Keys<span className="text-gold-400">99</span>
          <span className="ml-1.5 rounded-md bg-gold-500 px-1.5 py-0.5 align-middle text-xs font-bold text-brand-900">CRM</span>
        </div>
        <div className="mt-1 text-xs text-brand-100">Channel Partner CRM</div>
      </div>
      <nav className="relative z-10 flex-1 space-y-0.5 px-2 text-sm">
        {items.map((i) => {
          const Icon = i.icon;
          const active = isActive(i);
          return (
            <Link
              key={i.label}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                active
                  ? "bg-gradient-to-r from-gold-400 to-gold-500 font-semibold text-brand-900 shadow"
                  : "text-brand-50/90 hover:bg-white/10"
              }`}
            >
              <Icon size={18} />
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 opacity-80">
        <BuildingArt />
      </div>
    </aside>
  );
}
