/**
 * Configuration du service de billing
 * 
 * Token API universel: même token pour toutes les instances VaultAI
 * Hard-codé pour éviter toute manipulation
 */

// Token API universel pour authentifier les requêtes des instances VaultAI
// Ce token doit être le même que celui défini dans vaultai_v2/lib/billing/config.ts
export const BILLING_API_TOKEN = "vaultai_universal_billing_api_2024_production_key_XyZ9mP2nQ7wK";

// Fonction d'authentification
export function authenticateRequest(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === BILLING_API_TOKEN;
}

