import Link from "next/link";
import { Suspense } from "react";
import { ClearCart } from "@/components/ClearCart";
import { Wordmark } from "@/components/Wordmark";
import { captureOrder } from "@/lib/paypal";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// PayPal sends the buyer back here with ?token=<orderId> after approval
export default function CheckoutReturn({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <Link href="/">
        <Wordmark />
      </Link>
      <Suspense fallback={<Message title="Confirming your payment…" text="This takes a few seconds." />}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Confirmation({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  if (typeof token !== "string") return <Message title="Missing order" text="No PayPal order in the link." />;

  let order;
  try {
    order = await captureOrder(token);
  } catch (error) {
    console.error(error);
    return <Message title="Payment not completed" text={(error as Error).message} />;
  }

  const unit = order.purchase_units[0];
  const capture = unit?.payments?.captures?.[0];
  const address = unit?.shipping?.address;
  if (order.status !== "COMPLETED" || !capture) {
    return <Message title="Payment pending" text={`PayPal status: ${order.status}`} />;
  }
  const shipping = unit.amount?.breakdown?.shipping?.value;

  return (
    <div className="animate-fade-up mt-12">
      <ClearCart ids={unit.custom_id?.split(",") ?? []} />
      <div className="flex size-12 items-center justify-center rounded-full bg-paypal-soft text-2xl">🎁</div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">You&apos;ve been Gifted.</h1>
      <p className="mt-2 text-zinc-500">
        Paid with PayPal{unit.shipping?.name?.full_name ? `, shipping to ${unit.shipping.name.full_name}` : ""}.
      </p>

      <ul className="mt-8 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 px-5">
        {(unit.items ?? []).map((item, i) => (
          <li key={i} className="flex justify-between gap-4 py-3 text-sm">
            <span>{item.name}</span>
            <span className="shrink-0 text-zinc-600">${item.unit_amount.value}</span>
          </li>
        ))}
        {shipping && (
          <li className="flex justify-between py-3 text-sm text-zinc-600">
            <span>Shipping</span>
            <span>{Number(shipping) === 0 ? "Free" : `$${shipping}`}</span>
          </li>
        )}
        <li className="flex justify-between py-3 font-semibold">
          <span>Total paid</span>
          <span>
            ${capture.amount.value} {capture.amount.currency_code}
          </span>
        </li>
      </ul>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {address && (
          <>
            <dt className="text-zinc-500">Ships to</dt>
            <dd>
              {address.address_line_1}, {address.admin_area_2}, {address.admin_area_1} {address.postal_code}
            </dd>
          </>
        )}
        <dt className="text-zinc-500">Order</dt>
        <dd className="font-mono text-xs leading-5">{order.id}</dd>
        <dt className="text-zinc-500">Payment</dt>
        <dd className="font-mono text-xs leading-5">{capture.id}</dd>
      </dl>

      <Link
        href="/"
        className="mt-10 inline-block rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Find another gift
      </Link>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-zinc-600">{text}</p>
      <Link href="/" className="mt-8 inline-block text-sm underline underline-offset-4">
        Back to start
      </Link>
    </div>
  );
}
