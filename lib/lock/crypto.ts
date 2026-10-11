"use client";

/**
 * App lock helpers. The PIN is never stored: only a salted PBKDF2 hash.
 * Biometrics use WebAuthn with a platform authenticator (Touch ID, Windows
 * Hello, Android fingerprint) purely as a local user-presence check.
 *
 * This is a privacy screen for a shared device, not encryption: receipts in
 * browser storage are not encrypted by it.
 */

const ITERATIONS = 150_000;

const toB64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    key,
    256,
  );
  return toB64(bits);
}

export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: await derive(pin, salt) };
}

export async function verifyPin(pin: string, salt: string, hash: string) {
  const candidate = await derive(pin, fromB64(salt));
  // Constant-time-ish compare (lengths are fixed).
  let diff = candidate.length ^ hash.length;
  for (let i = 0; i < Math.min(candidate.length, hash.length); i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export async function biometricAvailable() {
  try {
    return (
      typeof PublicKeyCredential !== "undefined" &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Register a device credential; returns its id to store, or null if cancelled. */
export async function registerBiometric(): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "RyannReceipt", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "ryannreceipt-lock", displayName: "RyannReceipt" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return cred ? toB64(cred.rawId) : null;
  } catch {
    return null;
  }
}

/** Ask the device to verify the user with the registered credential. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64(credentialId) as BufferSource }],
        userVerification: "required",
        rpId: location.hostname,
        timeout: 60_000,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
