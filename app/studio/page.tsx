import type { Metadata } from "next";
import { Suspense } from "react";

import { StudioClient } from "./studio-client";

export const metadata: Metadata = {
  title: "Studio",
  description: "Design a thermal receipt and export it as a high-resolution PNG, PDF or print.",
};

export default function StudioPage() {
  // useSearchParams (for ?id=) needs a Suspense boundary under Cache Components.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-desk" />}>
      <StudioClient />
    </Suspense>
  );
}
