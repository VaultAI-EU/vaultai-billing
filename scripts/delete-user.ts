import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user, account } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Charger les variables d'environnement
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function deleteUser() {
  const email = "hello@vaultai.eu";
  
  console.log("🗑️  Deleting existing user...");

  try {
    // Trouver l'utilisateur
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!existingUser) {
      console.log("⚠️  User not found");
      return;
    }

    // Supprimer les comptes associés (cascade devrait le faire, mais on le fait explicitement)
    await db.delete(account).where(eq(account.userId, existingUser.id));
    console.log("✅ Accounts deleted");

    // Supprimer l'utilisateur
    await db.delete(user).where(eq(user.id, existingUser.id));
    console.log("✅ User deleted");

    console.log("\n🎉 User deleted successfully!");
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    await client.end();
    process.exit(1);
  }
}

deleteUser();

