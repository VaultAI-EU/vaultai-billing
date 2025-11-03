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

    // Appeler directement l'endpoint Better Auth pour créer l'utilisateur
    const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3001";
    const signUpUrl = `${baseURL}/api/auth/sign-up/email`;
    
    const signUpResponse = await fetch(signUpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": baseURL,
      },
      body: JSON.stringify({
        email,
        password,
        name: name || "Admin",
      }),
    });

    const signUpData = await signUpResponse.json();

    if (!signUpResponse.ok || signUpData.error) {
      return NextResponse.json(
        { error: signUpData.error?.message || "Failed to create user", details: signUpData },
        { status: signUpResponse.status || 400 }
      );
    }

    // Mettre à jour le rôle en admin après création
    if (signUpData.user?.id) {
      await db
        .update(user)
        .set({ role: "admin", email_verified: true })
        .where(eq(user.id, signUpData.user.id));
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      user: {
        id: signUpData.user?.id,
        email: signUpData.user?.email,
        name: signUpData.user?.name,
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

