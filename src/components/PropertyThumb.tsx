export function BuildingArt() {
  return (
    <svg viewBox="0 0 240 180" className="h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb7c9" /><stop offset="1" stopColor="#d9c07a" />
        </linearGradient>
      </defs>
      <rect width="240" height="180" fill="url(#bg)" opacity=".35" />
      {[[20, 70, 40], [70, 30, 50], [130, 55, 45], [180, 80, 40]].map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={180 - y} fill="#e8eef0" />
          {Array.from({ length: Math.floor((180 - y) / 14) }).map((_, r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={x + 6 + c * ((w - 12) / 3)} y={y + 6 + r * 14} width={(w - 12) / 3 - 4} height="8" fill="#3d7f95" opacity=".75" />
            ))
          )}
        </g>
      ))}
    </svg>
  );
}

export default function PropertyThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg bg-sky-100 ${className}`}>
      <BuildingArt />
    </div>
  );
}
