import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/config";
import { db, organizations } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  generateLicenseJwt,
  subscriptionStatusToLicenseStatus,
  applyLicenseOverride,
} from "@/lib/license";

/**
 * GET /api/organizations/:id/license
 *
 * Generates and returns a signed JWT license token for a VaultAI instance.
 * The JWT contains:
 * - org_id: Organization ID
 * - status: "active" | "suspended" | "cancelled" | "warning"
 * - iat: Issued at timestamp
 * - exp: Expiration (7 days from now)
 * - features: Array of enabled features (future use)
 * - warning_message: Optional message for warning status
 *
 * The JWT is signed with the private key, and VaultAI instances verify
 * it using the public key hardcoded in their config/defaults.ts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Vérifier l'authentification avec le token universel
    const authHeader = request.headers.get("authorization");
    if (!authenticateRequest(authHeader)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer l'organisation depuis la DB
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      // Organization not found in billing - return active status
      // This allows new instances to work before being registered
      console.log(
        `[License] Organization ${id} not found, returning active status`
      );
      const jwt = await generateLicenseJwt({
        org_id: id,
        status: "active",
        features: [],
      });

      return NextResponse.json({
        jwt,
        status: "active",
        message: "Organization not registered in billing system",
      });
    }

    // Map subscription status to license status
    const baseStatus = subscriptionStatusToLicenseStatus(
      org.subscription_status
    );

    // Apply license override if set by admin
    const licenseOverride = (org as any).license_override as string | null;
    const licenseOverrideReason = (org as any).license_override_reason as string | null;
    const finalStatus = applyLicenseOverride(baseStatus, licenseOverride);

    // Generate the signed JWT
    const jwt = await generateLicenseJwt({
      org_id: org.id,
      status: finalStatus,
      features: [], // Future: add features based on plan
      // Include warning message if status is warning
      warning_message: finalStatus === "warning" ? licenseOverrideReason || "Please contact VaultAI support" : undefined,
    });

    console.log(
      `[License] Generated JWT for org ${org.id} (${org.name}) with status: ${finalStatus}${licenseOverride ? ` (override: ${licenseOverride})` : ""}`
    );

    return NextResponse.json({
      jwt,
      status: finalStatus,
      organization_name: org.name,
      subscription_status: org.subscription_status,
      license_override: licenseOverride,
    });
  } catch (error) {
    console.error("[License] Error generating license JWT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
