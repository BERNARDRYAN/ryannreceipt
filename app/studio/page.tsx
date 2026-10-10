import type { Metadata } from "next";

import { StudioClient } from "./studio-client";

export const metadata: Metadata = {
  title: "Studio",
  description: "Design a thermal receipt and export it as a high-resolution PNG.",
};

export default function StudioPage() {
  return <StudioClient />;
}
