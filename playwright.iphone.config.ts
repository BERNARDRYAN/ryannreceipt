import { devices } from "@playwright/test";

import base from "./playwright.config";

// Safari (WebKit) with an iPhone screen, for iOS-only layout bugs. Point it at
// the dev server: the production CSP's upgrade-insecure-requests makes WebKit
// load http://localhost assets over https, which fails locally.
//   E2E_BASE_URL=http://localhost:3000 npx playwright test -c playwright.iphone.config.ts
const config = {
  ...base,
  use: { ...base.use, channel: undefined },
  projects: [{ name: "iphone", use: { ...devices["iPhone 13"], channel: undefined } }],
};

export default config;
