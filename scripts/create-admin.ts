import { config } from "dotenv";
import { auth } from "@/lib/auth";

// Charger les variables d'environnement
config({ path: ".env.local" });

async function createAdminUser() {
  const email = "hello@vaultai.eu";
  const password = "hugoDO1967!";
  const name = "Admin VaultAI";

  console.log("🔐 Creating admin user via Better Auth API...");

  try {
    // Utiliser l'API Better Auth pour créer l'utilisateur
    // Cela garantit que le hash de mot de passe est au bon format
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (result.error) {
      if (result.error.message?.includes("already exists") || result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        console.log("⚠️  User already exists, updating role to admin...");
        
        // Récupérer l'utilisateur existant et mettre à jour le rôle
        const { db } = await import("@/lib/db");
        const { user } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        
        const [existingUser] = await db
          .select()
          .from(user)
          .where(eq(user.email, email))
          .limit(1);
        
        if (existingUser) {
          await db
            .update(user)
            .set({ role: "admin" })
            .where(eq(user.id, existingUser.id));
          
          console.log("✅ Role updated to admin");
          console.log("\n🎉 Admin user ready!");
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          process.exit(0);
          return;
        }
      }
      throw new Error(result.error.message || "Failed to create user");
    }

    console.log("✅ User created:", result.data?.user?.id);
    console.log("\n🎉 Admin user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
    // Mettre à jour le rôle en admin après création
    if (result.data?.user?.id) {
      const { db } = await import("@/lib/db");
      const { user } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      
      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, result.data.user.id));
      
      console.log("✅ Role set to admin");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();

