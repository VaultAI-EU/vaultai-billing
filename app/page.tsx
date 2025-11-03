export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              VaultAI Billing Service
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Service de gestion de facturation pour VaultAI
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
              Status du Service
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">Service</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  Opérationnel
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">API Status</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Disponible
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
              Routes API Disponibles
            </h2>
            <div className="space-y-3">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  POST /api/meter-events
                </code>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Reçoit les rapports d'usage quotidiens depuis les instances VaultAI
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  POST /api/organizations/register
                </code>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Enregistre une nouvelle organisation et crée un customer Stripe
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  GET /api/organizations/:id/status
                </code>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Retourne le statut de la subscription pour une organisation
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  POST /api/stripe/webhook
                </code>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Webhook Stripe pour synchroniser les changements de subscription
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm">
              Service de facturation basé sur l'usage avec Stripe Usage-Based Billing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
