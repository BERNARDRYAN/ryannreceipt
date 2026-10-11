import type { Metadata } from "next";

import { HistoryClient } from "./history-client";

export const metadata: Metadata = {
  title: "Spending",
  description: "Log expenses in one tap and see today, this month, budgets, categories and warranties.",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
