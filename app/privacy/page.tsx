import type { Metadata } from "next";

import { H2, LegalPage, SUPPORT_EMAIL, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What RyannReceipt stores, where, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="11 October 2026">
      <p>
        RyannReceipt is a receipt maker and expense tracker in the Ryann Suite. This page explains what data it handles, where
        that data lives, and how you can remove it. In short: without an account everything stays in your browser; with an
        account your receipts are stored in our database and only you can read them. We don&apos;t sell data, show ads, or use
        analytics trackers.
      </p>

      <H2>Using RyannReceipt without an account</H2>
      <UL>
        <li>Receipts, settings and preferences are saved in your browser&apos;s local storage on this device. They are not sent to us.</li>
        <li>Clearing your browser&apos;s site data deletes them. Use Settings → Backup &amp; restore to keep a copy.</li>
        <li>
          Scanning a receipt runs text recognition on your device. The recognition engine and language files are downloaded from
          the jsDelivr CDN; your photo is not uploaded.
        </li>
        <li>CSV statements you import are read on your device; only the expenses you choose to import are saved.</li>
      </UL>

      <H2>When you sign in with Google</H2>
      <UL>
        <li>
          Google shares your name, email address and profile picture with us. Your sign-in is shared with the other Ryann Suite
          apps, which use the same account system.
        </li>
        <li>
          Your receipts (including any friend names you add when splitting a bill), budgets, recurring expenses, payment details
          you enter for split bills, and receipt photos you choose to keep are stored with Supabase, our database provider.
        </li>
        <li>Database rules make sure each record can only be read or changed by the account that owns it.</li>
      </UL>

      <H2>Share links</H2>
      <p>
        If you create a share link, anyone who has that link can view a read-only copy of that one receipt. The copy leaves out
        bill-split details, wallet, tags and photos. You can turn a link off at any time, and deleting the receipt removes it.
      </p>

      <H2>Cookies and local storage</H2>
      <UL>
        <li>Signed in: secure, httpOnly session cookies keep you signed in. A short-lived cookie protects the sign-in step.</li>
        <li>Local storage holds your receipts (without an account), language, theme, and app-lock settings.</li>
        <li>We use no advertising or analytics cookies.</li>
      </UL>

      <H2>Services we rely on</H2>
      <UL>
        <li>Cloudflare hosts the app. Like any web host it processes IP addresses to deliver pages and limit abuse.</li>
        <li>Supabase stores account data and receipts for signed-in users.</li>
        <li>Google provides sign-in.</li>
        <li>Frankfurter (European Central Bank data) provides currency rates. Requests contain no personal data.</li>
        <li>Brevo sends service emails, if any are needed.</li>
      </UL>

      <H2>App lock</H2>
      <p>
        The app-lock PIN is stored on your device only as a salted hash, and fingerprint or face unlock uses your device&apos;s
        own security. It is a privacy screen for this device, not encryption.
      </p>

      <H2>Keeping and deleting your data</H2>
      <UL>
        <li>We keep your data until you delete it.</li>
        <li>
          Signed in, open your account menu and choose <strong>Delete my RyannReceipt data</strong>. This permanently removes your
          receipts, settings, photos and share links.
        </li>
        <li>
          Your sign-in account is shared with the other Ryann Suite apps, so it is not removed by that button. To delete it
          entirely, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </li>
        <li>You can ask us for a copy of your data, or for corrections, at the same address.</li>
      </UL>

      <H2>Children</H2>
      <p>RyannReceipt is not meant for children under 13, and we don&apos;t knowingly collect their data.</p>

      <H2>Changes</H2>
      <p>If this policy changes, we&apos;ll update this page and the date at the top.</p>
    </LegalPage>
  );
}
