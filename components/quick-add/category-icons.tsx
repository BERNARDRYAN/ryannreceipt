import {
  Car,
  HeartPulse,
  Lightbulb,
  MoreHorizontal,
  ReceiptText,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { Category } from "@/lib/validators/receipt-schema";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  General: ReceiptText,
  "Food & Drink": UtensilsCrossed,
  Groceries: ShoppingBasket,
  Electronics: Smartphone,
  Transport: Car,
  Shopping: ShoppingBag,
  Utilities: Lightbulb,
  Health: HeartPulse,
  Other: MoreHorizontal,
};

/** Rounded tile with the category's icon, tinted in its own calm hue (see `.cat-tile`). */
export function CategoryTile({ category, className = "size-10" }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? ReceiptText;
  return (
    <span aria-hidden data-cat={category} className={`cat-tile flex shrink-0 items-center justify-center rounded-xl ${className}`}>
      <Icon className="size-[45%]" strokeWidth={2} />
    </span>
  );
}
