import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user, account } from "@/lib/db/schema";
import { hash } from "bcrypt-ts";
import { eq } from "drizzle-orm";

// Charger les variables d'environnement
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function createAdminUser() {
  const email = "hello@vaultai.eu";
  const password = "hugoDO1967!";
  const name = "Admin VaultAI";

  console.log("🔐 Creating admin user...");

  try {
    // Vérifier si l'utilisateur existe déjà
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser) {
      console.log("⚠️  User already exists:", email);
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await hash(password, 10);
    console.log("✅ Password hashed");

    // Créer l'utilisateur
    const [newUser] = await db
      .insert(user)
      .values({
        email,
        name,
        emailVerified: true,
        role: "admin",
      })
      .returning();

    console.log("✅ User created:", newUser.id);

    // Créer le compte avec le mot de passe
    await db.insert(account).values({
      accountId: email,
      providerId: "credential",
      userId: newUser.id,
      password: hashedPassword,
    });

    console.log("✅ Account created with password");
    console.log("\n🎉 Admin user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    await client.end();
    process.exit(1);
  }
}

createAdminUser();

