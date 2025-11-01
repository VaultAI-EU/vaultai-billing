import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy initialization pour éviter l'erreur au build time
// La connexion sera créée uniquement à runtime quand DATABASE_URL est disponible
let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDb() {
  // Vérifier seulement à runtime, pas au build time
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!client || !dbInstance) {
    client = postgres(databaseUrl);
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}

// Export db avec lazy initialization
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});

export * from "./schema";
