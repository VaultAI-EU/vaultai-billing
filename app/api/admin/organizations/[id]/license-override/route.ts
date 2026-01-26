import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/organizations/[id]/license-override
 *
 * Get the current license override status for an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!dbUser || dbUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;

    const [org] = await db
      .select({
        license_override: organizations.license_override,
        license_override_reason: organizations.license_override_reason,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      license_override: org.license_override,
      license_override_reason: org.license_override_reason,
    });
  } catch (error) {
    console.error("[Admin] Error fetching license override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]/license-override
 *
 * Update the license override status for an organization
 *
 * Body:
 * {
 *   license_override: "suspended" | "warning" | "active" | null,
 *   reason: string (optional, but recommended)
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!dbUser || dbUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;
    const body = await request.json();
    const { license_override, reason } = body;

    // Validate license_override value
    const validOverrides = ["suspended", "warning", "active", null];
    if (!validOverrides.includes(license_override)) {
      return NextResponse.json(
        {
          error: "Invalid license_override value",
          valid_values: validOverrides,
        },
        { status: 400 }
      );
    }

    // Check if organization exists
    const [existingOrg] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!existingOrg) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update the license override
    await db
      .update(organizations)
      .set({
        license_override: license_override,
        license_override_reason: reason || null,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    console.log(
      `[Admin] License override updated for org ${existingOrg.name}: ${license_override || "cleared"} (reason: ${reason || "none"})`
    );

    return NextResponse.json({
      success: true,
      message: license_override
        ? `License override set to "${license_override}"`
        : "License override cleared",
      organization_id: organizationId,
      license_override: license_override,
      reason: reason || null,
    });
  } catch (error) {
    console.error("[Admin] Error updating license override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
