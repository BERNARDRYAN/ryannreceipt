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
