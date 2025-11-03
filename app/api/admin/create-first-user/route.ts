import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, account } from "@/lib/db/schema";
import { hash } from "bcrypt-ts";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/create-first-user
 * 
 * Endpoint temporaire pour créer le premier utilisateur admin
 * Devrait être désactivé après la création du premier admin
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

    // Hasher le mot de passe
    const hashedPassword = await hash(password, 10);

    // Créer l'utilisateur
    const [newUser] = await db
      .insert(user)
      .values({
        email,
        name: name || "Admin",
        emailVerified: true,
        role: "admin",
      })
      .returning();

    // Créer le compte avec le mot de passe
    await db.insert(account).values({
      accountId: email,
      providerId: "credential",
      userId: newUser.id,
      password: hashedPassword,
    });

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

