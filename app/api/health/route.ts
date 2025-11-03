import { NextResponse } from "next/server";

/**
 * GET /api/health
 * 
 * Endpoint de santé pour vérifier la configuration
 */
export async function GET() {
  const config = {
    database: !!process.env.DATABASE_URL,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    betterAuth: !!process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: !!process.env.BETTER_AUTH_URL,
    publicBetterAuthUrl: !!process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  };

  const allConfigured = Object.values(config).every(Boolean);

  return NextResponse.json({
    status: allConfigured ? "healthy" : "misconfigured",
    config,
    timestamp: new Date().toISOString(),
  }, {
    status: allConfigured ? 200 : 503,
  });
}

