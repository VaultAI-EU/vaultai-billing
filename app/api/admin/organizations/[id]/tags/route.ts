import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/admin/organizations/[id]/tags
 *
 * Met à jour les tags d'une organisation
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
    const { tags } = body;

    // Validation
    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: "tags must be an array of strings" },
        { status: 400 }
      );
    }

    // Vérifier que tous les éléments sont des strings
    if (!tags.every((tag: unknown) => typeof tag === "string")) {
      return NextResponse.json(
        { error: "All tags must be strings" },
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

    // Mettre à jour les tags
    await db
      .update(organizations)
      .set({
        tags: tags.filter((tag: string) => tag.trim().length > 0),
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
        tags: updatedOrg.tags || [],
      },
    });
  } catch (error) {
    console.error("[Admin] Error updating tags:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

