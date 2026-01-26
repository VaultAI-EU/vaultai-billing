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
// In production, this should be set via Vercel environment variables
const LICENSE_PRIVATE_KEY =
  process.env.LICENSE_PRIVATE_KEY ||
  `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCXjCilhtWEz/gc
mNEhcgDw2pAE6gj8etskFiN8jjGSE67HoP7MgmG6cK5attXWUlNlZpOmfZ7uYOLF
VxH9Bba8odb9sjcHPF8RsUTNF966DzewNKmfNWk/Oq4N2yo/4BoUr5oujVrb9i0w
YeXdApABhnKm/Li2LWZFhjNmzryAfEWjuaJzx/XvUvePWtvB0+rnJV1qnmghfPN9
fu5nNK14gytNhdCumH8S6DGMzXAnpv4eufVbKfOBheJw3p4jmn/Ij6sZZHNuFI8N
ax6mzNrbPyjfoOSGvdjiMRIRspEXKeJkYt4RnJixZTs+9GI11olzS1b7E8BLVlTC
aYcJOBONAgMBAAECggEABc9VRZdIO0m/0NTY+6fDungemlmgk5FgMl94588Jvnhr
tHKLIisDdSLZxFeLFibc1J/cnD7np2rmdrtSULl12oB33g0FiAz79hEuOpCmNMrd
jy9Nq3FgQhDNWHGlCoLcbRuYVR2NNK6Y5+hw6Aqvm6dcYOOCb1WJPLQa51+YoXJT
HHYzatbu3d6i91rYXUzB4KvbKxkB9S/7s20ztrNZcukm9l2GLOr8SDJm+AW+w7j5
bsHKZCFkZGiMpCzbZW+EbuGqyK9/kcv63TaWzdw0q2UQEOk7xMtIAI524uhL94Vm
isbfARAO4NlGpJbTNAJNuyrS0MDLU20pXJuOm3pEnwKBgQDH7/sRHKweWTVQSriu
2bjj0XU/UH2p4hxSXpOX3iR/u7HNVvod+59Z5gz0e8QSMa6uXrRux9WjxY/4Z05W
0mpEeNr4IwNCBRLLeQZgkLZyDUytHhFlDQFpPq+2NMAX9TResvGfIB2OhpEtELuf
e4hO9vdE5riuqW9qtVZuCwoaRwKBgQDCCqAQV7w/btYxoubGvyIXSubmbHACI0L9
mHwPK8amP2FZ78V3QHuYfypJ6ZVI0mLFdga7uC9SqI5wdYRMlewhmCPLOjXC+1ER
ws83ZGOwup2CvP7yqPUOmr8CKViupMzNfqilTJR+YgmMfNVjOOdlfIbQWjDGuGvN
FjO7TQ45iwKBgFY0iZryMuAO9Ka+4Ow64bYQnK4E5Xm3DSESuC510GTmp53yj3sX
/7gCMbnEF2EE3N0/5ioRrXKkfxPKbwOOS9VkCn2Mkx4HE/h5IR/HpXJ9e371BOj9
94rKRXaZPe3WgpMGMpm6fiPyr2uv2EXGPJpXb3vcwupEEc7/itl9lwiHAoGBALd2
bFiHW4luNj7AEwqe9JCpVR9QL6cVx+UWI1YEwdG140mxljZmVXWd5lHz9B3iLVkd
eshKIRQ6IlLaCbiPl687tbwU0XgFPmVYl6t703XpO7u9DiBI90pTrX1RsnONhcZV
lwaTHWNRNk4KSYeC6eXek2iznaKGBAbokwjoliZ5AoGAIPJC0XFzNQwS72DDm+3/
IdPipXoO2M4eRc/IFF+S87xxR6Aqm7nZ+UInQgVBAVRHy/VSpaYod75JBQOPebMk
qim3W3Ok/CkS+uQvvMR5jil0u59CLc1J+b+KjrnG2U+jU3L87PRswLZictq40U1k
PjlD4llr87yR2eMRjQVWG0c=
-----END PRIVATE KEY-----`;

// Cache for the private key
let privateKeyCache: Awaited<ReturnType<typeof jose.importPKCS8>> | null = null;

/**
 * Get the private key for signing JWTs
 */
async function getPrivateKey() {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  privateKeyCache = await jose.importPKCS8(LICENSE_PRIVATE_KEY, "RS256");
  return privateKeyCache;
}

export type LicenseJwtPayload = {
  org_id: string;
  status: "active" | "suspended" | "cancelled";
  features?: string[];
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

  const jwt = await new jose.SignJWT({
    org_id: payload.org_id,
    status: payload.status,
    features: payload.features || [],
  })
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
): "active" | "suspended" | "cancelled" {
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
