// The share ring: one segment per person. Open = faint, reserved (PayPal AUTHORIZE) = accent,
// collected (CAPTURE) = green. When everyone is in, the ring closes. Used as logo, on cards,
// on the group page and in the link preview.

import { RING, ringSegments } from "@/lib/ring";

type Props = {
  shares: number;
  reserved: number;
  captured?: boolean;
  size: number;
  stroke?: number;
  gap?: number; // px between segments
  className?: string;
  label?: string; // accessible text; decorative when omitted
  children?: React.ReactNode; // shown round in the middle (product image)
};

export function ShareRing({
  shares,
  reserved,
  captured = false,
  size,
  stroke = 10,
  gap = 8,
  className = "",
  label,
  children,
}: Props) {
  const c = size / 2;
  const segments = ringSegments(shares, size, stroke, gap);
  const color = (i: number) => (captured ? RING.captured : i < reserved ? RING.reserved : RING.open);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {segments.map((seg, i) => (
          <circle
            key={i}
            className="ring-segment"
            cx={c}
            cy={c}
            r={seg.r}
            fill="none"
            stroke={color(i)}
            strokeWidth={stroke}
            strokeLinecap={segments.length > 1 ? "round" : "butt"}
            strokeDasharray={seg.dash}
            transform={`rotate(${seg.rotate} ${c} ${c})`}
            style={{ transition: "stroke 600ms ease-out" }}
          />
        ))}
      </svg>
      {children && (
        <div
          className="absolute overflow-hidden rounded-full bg-white"
          style={{ inset: stroke + Math.max(4, Math.round(size * 0.04)) }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
