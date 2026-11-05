"use client";

import { useEffect } from "react";
import { removeFromCart } from "@/lib/saved";

// Paid gifts leave the cart (runs once on the confirmation page)
export function ClearCart({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (key) removeFromCart(key.split(","));
  }, [key]);
  return null;
}
