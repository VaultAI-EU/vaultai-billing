import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/admin/organizations/[id]/hidden
 *
 * Toggle la visibilité d'une organisation dans le dashboard
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
    const { hidden } = body;

    if (typeof hidden !== "boolean") {
      return NextResponse.json(
        { error: "hidden must be a boolean" },
        { status: 400 }
      );
    }

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

    await db
      .update(organizations)
      .set({ hidden, updated_at: new Date() })
      .where(eq(organizations.id, organizationId));

    return NextResponse.json({
      success: true,
      organization: { id: organizationId, hidden },
    });
  } catch (error) {
    console.error("[Admin] Error updating hidden:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
