export const statusStyles: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-amber-100 text-amber-800",
  Interested: "bg-violet-100 text-violet-700",
  Qualified: "bg-green-100 text-green-700",
  "Site Visit": "bg-lime-100 text-lime-700",
  Negotiation: "bg-indigo-100 text-indigo-700",
  Booked: "bg-emerald-100 text-emerald-700",
  Lost: "bg-red-100 text-red-700",
};

const palette = ["#0f7a6b", "#e8a91f", "#3b6fe0", "#9b6fe0", "#d9534f", "#2e86de"];
export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}
export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
