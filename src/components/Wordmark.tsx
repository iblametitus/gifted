// "Gifted" plus the agent claim, so judges see at a glance that it's an agent
export function Wordmark() {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-semibold tracking-tight">Gifted</span>
      <span className="hidden text-sm text-zinc-500 sm:inline">Your AI gift agent</span>
    </span>
  );
}
