import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/admin/organizations/[id]/display-name
 *
 * Met à jour le nom d'affichage d'une organisation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification admin
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer l'utilisateur depuis la DB pour obtenir le rôle
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
    const { display_name } = body;

    // Validation
    if (display_name !== null && display_name !== undefined && typeof display_name !== "string") {
      return NextResponse.json(
        { error: "display_name must be a string or null" },
        { status: 400 }
      );
    }

    // Vérifier que l'organisation existe
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Mettre à jour le display_name (peut être null pour utiliser le nom par défaut)
    await db
      .update(organizations)
      .set({
        display_name: display_name?.trim() || null,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    // Récupérer l'organisation mise à jour
    const [updatedOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return NextResponse.json({
      success: true,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        display_name: updatedOrg.display_name,
      },
    });
  } catch (error) {
    console.error("[Admin] Error updating display name:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

