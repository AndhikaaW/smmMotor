import type { CartItem, PaymentMethod } from "@/types";

export interface HeldCart {
  id: string;
  createdAt: number;
  vehicleType: string;
  method: PaymentMethod;
  items: CartItem[];
}

const KEY = "pos-held-carts";
export const MAX_HELD = 20;

function isValidItem(i: unknown): i is CartItem {
  if (typeof i !== "object" || i === null) return false;
  const o = i as Record<string, unknown>;
  return (
    (o.type === "product" || o.type === "service") &&
    typeof o.name === "string" &&
    typeof o.price === "number" &&
    typeof o.quantity === "number" &&
    typeof o.subtotal === "number"
  );
}

export function loadHeldCarts(): HeldCart[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (h): h is HeldCart =>
          typeof h === "object" &&
          h !== null &&
          typeof (h as HeldCart).id === "string" &&
          Array.isArray((h as HeldCart).items) &&
          (h as HeldCart).items.every(isValidItem),
      )
      .slice(0, MAX_HELD);
  } catch {
    return [];
  }
}

export function saveHeldCarts(carts: HeldCart[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(carts.slice(0, MAX_HELD)));
  } catch {
    // ponytail: localStorage penuh/diblokir — tahan tetap jalan di memori sesi ini.
  }
}

export function newHeldId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
