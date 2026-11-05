import { statusStyles } from "@/lib/utils";

export default function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span className={`inline-block rounded-md px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-slate-100 text-slate-700"} ${className}`}>
      {status}
    </span>
  );
}
