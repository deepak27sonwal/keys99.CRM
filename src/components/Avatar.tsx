import { avatarColor, initials } from "@/lib/utils";

export default function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
