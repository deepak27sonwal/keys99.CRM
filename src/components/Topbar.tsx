import { Bell, CalendarDays, ChevronDown, Menu, MessageCircle, Search } from "lucide-react";
import Avatar from "./Avatar";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-200/70 bg-white/90 px-6 py-3 backdrop-blur">
      <Menu className="text-slate-700 lg:hidden" />
      <div className="relative max-w-2xl flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          placeholder="Search leads, customers, projects, developers..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-brand-500"
        />
      </div>
      <div className="ml-auto flex items-center gap-5">
        <button className="relative text-slate-700" aria-label="Notifications">
          <Bell size={22} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        </button>
        <MessageCircle className="text-green-500" size={24} />
        <CalendarDays className="text-slate-700" size={22} />
        <div className="flex items-center gap-2.5">
          <Avatar name="Deepak Mahto" size={40} />
          <div className="hidden text-sm leading-tight sm:block">
            <div className="font-semibold">Deepak Mahto</div>
            <div className="flex items-center gap-1 text-slate-600">Admin <ChevronDown size={14} /></div>
          </div>
        </div>
      </div>
    </header>
  );
}
