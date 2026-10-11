import type { Metadata } from "next";

import { H2, LegalPage, SUPPORT_EMAIL, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using RyannReceipt.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="11 October 2026">
      <p>By using RyannReceipt you agree to these terms. If you don&apos;t agree, please don&apos;t use the app.</p>

      <H2>What RyannReceipt is for</H2>
      <p>
        RyannReceipt helps you design receipt-style records and keep track of your own spending, warranties and shared bills.
        It is free to use.
      </p>

      <H2>Acceptable use</H2>
      <p>You agree not to use RyannReceipt to:</p>
      <UL>
        <li>
          make fake or altered receipts to deceive anyone, for example for expense claims, refunds, warranty claims, tax
          deductions or proof of purchase;
        </li>
        <li>impersonate a real business or person;</li>
        <li>share illegal, abusive or infringing content through share links;</li>
        <li>attack, overload or try to get around the security of the service.</li>
      </UL>
      <p>We may remove share links or suspend access when these rules are broken.</p>

      <H2>Your content</H2>
      <p>
        Your receipts and data belong to you. You are responsible for what you create and share, and for keeping your own
        backups when not signed in.
      </p>

      <H2>Figures and estimates</H2>
      <UL>
        <li>Receipt scanning can misread text. Check scanned amounts before relying on them.</li>
        <li>Currency conversions use reference rates and are approximate.</li>
        <li>
          Tax relief summaries are a convenience for your own records, not tax advice. Check current LHDN rules or a tax
          professional.
        </li>
        <li>Bill-split amounts are calculated for you; settling up is between you and your friends.</li>
      </UL>

      <H2>The service</H2>
      <p>
        RyannReceipt is provided &quot;as is&quot;, without warranties of any kind. Features may change, and the service may be
        unavailable from time to time. To the extent the law allows, we are not liable for indirect losses or lost data arising
        from using the app.
      </p>

      <H2>Law</H2>
      <p>These terms are governed by the laws of Malaysia.</p>

      <H2>Contact</H2>
      <p>
        Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
