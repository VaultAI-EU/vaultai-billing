import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/create-first-user
 * 
 * Endpoint temporaire pour créer le premier utilisateur admin
 * Utilise l'API Better Auth pour créer l'utilisateur avec le bon format de hash
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier s'il existe déjà des utilisateurs
    const existingUsers = await db.select().from(user).limit(1);
    
    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Admin user already exists. Use sign-up page instead." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe déjà
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Utiliser Better Auth pour créer l'utilisateur (gère le hash correctement)
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name || "Admin",
      },
    });

    if (signUpResult.error) {
      return NextResponse.json(
        { error: signUpResult.error.message || "Failed to create user" },
        { status: 400 }
      );
    }

    // Mettre à jour le rôle en admin après création
    if (signUpResult.data?.user?.id) {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, signUpResult.data.user.id));
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      user: {
        id: signUpResult.data?.user?.id,
        email: signUpResult.data?.user?.email,
        name: signUpResult.data?.user?.name,
      },
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

