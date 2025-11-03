"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Dashboard Billing
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 dark:text-gray-400">
                {session.user.email}
              </span>
              <a
                href="/api/auth/sign-out"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Déconnexion
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Organisations
              </h2>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {/* TODO: Charger depuis API */}
                -
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Rapports d'usage (30j)
              </h2>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {/* TODO: Charger depuis API */}
                -
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Subscriptions actives
              </h2>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {/* TODO: Charger depuis API */}
                -
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Organisations
            </h2>
            <div className="text-gray-600 dark:text-gray-400">
              Liste des organisations à venir...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

