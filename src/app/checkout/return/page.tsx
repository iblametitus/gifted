import Link from "next/link";
import { Suspense } from "react";
import { captureOrder } from "@/lib/paypal";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// PayPal sends the buyer back here with ?token=<orderId> after approval
export default function CheckoutReturn({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Message title="Confirming your payment…" text="This takes a few seconds." />}>
      <Confirmation searchParams={searchParams} />
    </Suspense>
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

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Gift handled 🎁</h1>
      <p className="mt-4">{unit.description}</p>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Paid</dt>
        <dd>
          ${capture.amount.value} {capture.amount.currency_code}
        </dd>
        <dt className="text-zinc-500">Ships to</dt>
        <dd>
          {unit.shipping?.name?.full_name}
          {address && `, ${address.address_line_1}, ${address.admin_area_2}, ${address.admin_area_1} ${address.postal_code}`}
        </dd>
        <dt className="text-zinc-500">Order</dt>
        <dd className="font-mono">{order.id}</dd>
        <dt className="text-zinc-500">Payment</dt>
        <dd className="font-mono">{capture.id}</dd>
      </dl>
      <Link href="/" className="mt-8 inline-block underline">
        Find another gift
      </Link>
    </main>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-zinc-600">{text}</p>
      <Link href="/" className="mt-8 inline-block underline">
        Back to start
      </Link>
    </main>
  );
}
