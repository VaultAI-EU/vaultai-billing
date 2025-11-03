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
    // Vérifier d'abord si l'utilisateur existe
    const { db } = await import("@/lib/db");
    const { user } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    
    if (existingUser) {
      console.log("⚠️  User already exists, updating role to admin...");
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
      throw new Error(result.error.message || "Failed to create user");
    }

    console.log("✅ User created:", result.data?.user?.id);
    
    // Mettre à jour le rôle en admin après création
    if (result.data?.user?.id) {
      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, result.data.user.id));
      
      console.log("✅ Role set to admin");
    }
    
    console.log("\n🎉 Admin user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
    process.exit(0);
  } catch (error: any) {
    // Gérer le cas où l'utilisateur existe déjà (erreur lors de la création)
    if (error?.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || 
        error?.message?.includes("already exists")) {
      console.log("⚠️  User already exists, updating role to admin...");
      
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
    
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();

