import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { existsSync } from "fs";

// Détection intelligente du fichier .env selon l'environnement
const getEnvFile = () => {
  // En production Docker, utiliser .env.production
  if (process.env.NODE_ENV === "production") {
    return ".env.production";
  }

  // En développement local, préférer .env.local s'il existe
  if (existsSync(".env.local")) {
    return ".env.local";
  }

  // Fallback vers .env.production si .env.local n'existe pas
  if (existsSync(".env.production")) {
    return ".env.production";
  }

  // Dernier fallback vers .env
  return ".env";
};

const envFile = getEnvFile();
console.log(`🔧 Drizzle utilise le fichier: ${envFile}`);

config({
  path: envFile,
});

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
