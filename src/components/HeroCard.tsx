import { ShareRing } from "./ShareRing";

// Static example of a group gift, so visitors see the product before they type
export function HeroCard() {
  const people = ["A", "B", "C"];
  return (
    <figure
      aria-label="Example: a group gift for Lena's 30th, 3 of 5 friends in, $24.80 each"
      className="mx-auto w-full max-w-[280px] rounded-3xl border border-black/10 bg-white p-5 sm:max-w-[320px] sm:p-6"
    >
      <div aria-hidden>
        <p className="text-xs font-medium uppercase tracking-wider text-ink/60">Lena&apos;s 30th</p>
        <div className="mt-4 flex justify-center">
          <ShareRing shares={5} reserved={3} size={168} stroke={11}>
            <span className="flex size-full flex-col items-center justify-center bg-paper">
              <span className="font-display text-3xl font-semibold tracking-tight">$24.80</span>
              <span className="text-xs text-ink/60">each</span>
            </span>
          </ShareRing>
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {people.map((p) => (
            <span
              key={p}
              className="flex size-8 items-center justify-center rounded-full border-2 border-accent bg-accent-soft text-xs font-semibold"
            >
              {p}
            </span>
          ))}
          <span className="size-8 rounded-full border-2 border-dashed border-black/20" />
          <span className="size-8 rounded-full border-2 border-dashed border-black/20" />
        </div>
        <p className="mt-3 text-center text-sm">
          <span className="font-medium">3 of 5 in</span> <span className="text-ink/60">· nobody charged yet</span>
        </p>
      </div>
    </figure>
  );
}

// Find · Everyone reserves · Charged only when all are in, each with a ring that fills up
export function ThreeSteps() {
  const steps = [
    { title: "Find", text: "One sentence. Three gifts that fit the person and the budget per head.", reserved: 0 },
    { title: "Everyone reserves", text: "Share one link. Each friend reserves their part with PayPal.", reserved: 2 },
    { title: "Charged only when all are in", text: "Then the gift is bought. Otherwise nobody pays.", reserved: 4 },
  ];
  return (
    <ol className="grid gap-6 sm:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <ShareRing shares={4} reserved={step.reserved} captured={i === 2} size={40} stroke={5} gap={3} />
          <div>
            <p className="font-medium">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
