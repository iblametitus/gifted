// Share-ring colors and geometry, shared by <ShareRing> and the link preview (which has no CSS classes)

export const RING = { open: "rgba(26,23,20,0.1)", reserved: "#f2542d", captured: "#1f8a5b" };

export function ringSegments(shares: number, size: number, stroke: number, gap: number) {
  const n = Math.max(1, Math.round(shares));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Round caps reach stroke/2 into the gap on both sides, so the visible gap needs `stroke` extra.
  // Small rings get proportionally smaller gaps so the segments stay visible.
  const space = n === 1 ? 0 : Math.min(gap, (circumference / n) * 0.3) + stroke;
  const len = Math.max(0.5, circumference / n - space);
  const offset = n === 1 ? 0 : (space / 2 / circumference) * 360;
  return Array.from({ length: n }, (_, i) => ({
    r,
    dash: `${len} ${circumference - len}`,
    rotate: (i * 360) / n - 90 + offset,
  }));
}
