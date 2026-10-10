import type { Metadata } from "next";

import { HistoryClient } from "./history-client";

export const metadata: Metadata = {
  title: "History",
  description: "Your receipt archive with monthly spending, categories and warranty reminders.",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
