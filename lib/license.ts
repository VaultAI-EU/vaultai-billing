/**
 * License JWT Generation for VaultAI instances
 *
 * This module generates signed JWT tokens that VaultAI instances use
 * to verify their license status.
 *
 * Security:
 * - Private key is stored in environment variable LICENSE_PRIVATE_KEY
 * - Public key is hardcoded in VaultAI instances (config/defaults.ts)
 * - JWT contains org_id, status, exp, iat - all protected by signature
 */

import * as jose from "jose";

// Private key for signing (from environment variable)
// REQUIRED: Must be set via environment variable LICENSE_PRIVATE_KEY
// In Vercel, this is configured in the project settings
// For local development, add it to .env.local
function getPrivateKeyFromEnv(): string {
  const key = process.env.LICENSE_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "[License] LICENSE_PRIVATE_KEY environment variable is not set. " +
      "This is required for JWT signing. Please configure it in your environment."
    );
  }
  return key;
}

// Cache for the private key
let privateKeyCache: Awaited<ReturnType<typeof jose.importPKCS8>> | null = null;

/**
 * Get the private key for signing JWTs
 * Throws an error if LICENSE_PRIVATE_KEY is not configured
 */
async function getPrivateKey() {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  const privateKeyPem = getPrivateKeyFromEnv();
  privateKeyCache = await jose.importPKCS8(privateKeyPem, "RS256");
  return privateKeyCache;
}

export type LicenseStatus = "active" | "suspended" | "cancelled" | "warning";

export type LicenseJwtPayload = {
  org_id: string;
  status: LicenseStatus;
  features?: string[];
  warning_message?: string; // Optional warning message to display
};

/**
 * Generate a signed license JWT for an organization
 *
 * @param payload - The license information
 * @param validityDays - How many days the JWT is valid (default: 7)
 * @returns The signed JWT string
 */
export async function generateLicenseJwt(
  payload: LicenseJwtPayload,
  validityDays: number = 7
): Promise<string> {
  const privateKey = await getPrivateKey();

  const jwtPayload: Record<string, unknown> = {
    org_id: payload.org_id,
    status: payload.status,
    features: payload.features || [],
  };

  // Add warning message if provided
  if (payload.warning_message) {
    jwtPayload.warning_message = payload.warning_message;
  }

  const jwt = await new jose.SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer("billing.vaultai.eu")
    .setExpirationTime(`${validityDays}d`)
    .sign(privateKey);

  return jwt;
}

/**
 * Map subscription status to license status
 */
export function subscriptionStatusToLicenseStatus(
  subscriptionStatus: string | null
): LicenseStatus {
  switch (subscriptionStatus) {
    case "active":
    case "trialing":
    case "trial":
      return "active";
    case "past_due":
    case "unpaid":
      return "suspended";
    case "canceled":
    case "cancelled":
    case "incomplete_expired":
      return "cancelled";
    default:
      // pending, incomplete, etc. - treat as active for now (soft approach)
      return "active";
  }
}

/**
 * Apply license override if set
 * Returns the final license status considering admin overrides
 */
export function applyLicenseOverride(
  baseStatus: LicenseStatus,
  licenseOverride: string | null
): LicenseStatus {
  if (!licenseOverride) {
    return baseStatus;
  }

  switch (licenseOverride) {
    case "suspended":
      return "suspended";
    case "warning":
      return "warning";
    case "active":
      return "active";
    default:
      return baseStatus;
  }
}
