import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { RING, ringSegments } from "@/lib/ring";
import { peekGroup } from "@/lib/groups";
import { giftFor } from "@/lib/words";

// The picture a shared group link shows in WhatsApp, iMessage, Slack, X:
// the ring with the gift and the live state, plus what each person pays.

export const alt = "A Gifted group gift: who's in and what each person pays";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#faf7f2";
const INK = "#1a1714";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // live state, never prerendered
  const { id } = await params;
  const group = await peekGroup(id);

  const people = group?.shares.length ?? 5;
  const joined = group?.contributions.length ?? 0;
  const captured = group?.status === "complete";
  const reserved = group?.status === "cancelled" ? 0 : joined;
  const each = group ? `$${(group.shares[0] ?? group.quote.total).toFixed(2)}` : "";
  const state = !group
    ? "Group gifts, handled."
    : captured
      ? `All ${people} in · gift bought`
      : group.status === "cancelled"
        ? "Closed · nobody was charged"
        : `${joined} of ${people} in`;
  const headline = group ? `Chip in for ${giftFor(group.recipient)}` : "Group gifts without chasing anyone for money.";
  const kicker = group ? `${group.organizer} started a group gift` : "Gifted";
  const footer = "Charged only when everyone is in · PayPal";

  const [display, image] = await Promise.all([
    loadFont(`${kicker}${headline}${each}${state}${footer} each0123456789$.`),
    group?.product.imageUrl ? loadImage(group.product.imageUrl) : null,
  ]);

  const ring = 420;
  const stroke = 26;
  const segments = ringSegments(people, ring, stroke, 14);
  const inner = ring - 2 * (stroke + 18);
  const displayFamily = display ? "Fraunces" : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: PAPER,
          padding: "0 80px",
          gap: 72,
          color: INK,
        }}
      >
        <div style={{ position: "relative", display: "flex", width: ring, height: ring, flexShrink: 0 }}>
          <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} style={{ position: "absolute", top: 0, left: 0 }}>
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={ring / 2}
                cy={ring / 2}
                r={seg.r}
                fill="none"
                stroke={captured ? RING.captured : i < reserved ? RING.reserved : RING.open}
                strokeWidth={stroke}
                strokeLinecap={people > 1 ? "round" : "butt"}
                strokeDasharray={seg.dash}
                transform={`rotate(${seg.rotate} ${ring / 2} ${ring / 2})`}
              />
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              top: (ring - inner) / 2,
              left: (ring - inner) / 2,
              width: inner,
              height: inner,
              borderRadius: inner,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={image} width={inner * 0.68} height={inner * 0.68} style={{ objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", fontSize: 64, fontFamily: displayFamily, fontWeight: 600 }}>{each}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, color: "rgba(26,23,20,0.6)" }}>
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 64,
              lineHeight: 1.08,
              fontFamily: displayFamily,
              fontWeight: 600,
              letterSpacing: -1.5,
            }}
          >
            {headline}
          </div>
          {group && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 36 }}>
              <span style={{ fontSize: 76, fontFamily: displayFamily, fontWeight: 600 }}>{each}</span>
              <span style={{ fontSize: 34, color: "rgba(26,23,20,0.7)" }}>each</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 34,
              fontWeight: 600,
              color: captured ? RING.captured : group?.status === "cancelled" ? INK : RING.reserved,
            }}
          >
            {state}
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 24, color: "rgba(26,23,20,0.6)" }}>
            {footer}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: display ? [{ name: "Fraunces", data: display, weight: 600, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=60" }, // state changes as friends join
    },
  );
}

// Fraunces from Google Fonts, only the glyphs we draw. Falls back to the default font.
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const glyphs = encodeURIComponent([...new Set(text)].join(""));
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Fraunces:wght@600&text=${glyphs}`, {
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// The product photo as a data URI. The renderer reads PNG/JPEG only, so WebP/AVIF (Channel3's CDN
// serves WebP) goes through sharp, which ships with Next. Any failure falls back to the price.
async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5_000_000) return null;
    if (type === "image/png" || type === "image/jpeg") return `data:${type};base64,${buf.toString("base64")}`;
    const sharp = (await import("sharp")).default;
    const png = await sharp(buf).resize(400, 400, { fit: "inside" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
