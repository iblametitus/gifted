import { ShareRing } from "./ShareRing";

// The ring mark (three shares, all in) + "Gifted" + what it does
export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <ShareRing shares={3} reserved={3} size={18} stroke={3.5} gap={2.5} />
      <span className="font-display text-xl font-semibold tracking-tight">Gifted</span>
      <span className="hidden text-sm text-ink/60 sm:inline">Group gifts, handled.</span>
    </span>
  );
}
