import { NextResponse, type NextRequest } from "next/server";

/**
 * Fallback for the Web Share Target when the service worker isn't active yet:
 * open the scanner (the shared file can't be handed over without it).
 */
export function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/studio?scan=1", request.url), 303);
}
