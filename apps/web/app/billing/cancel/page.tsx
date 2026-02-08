"use client";

import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">👋</div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Upgrade Canceled</h1>
        <p className="mt-2 text-sm text-gray-600">
          No worries — you can upgrade anytime. You still have full access to
          all free-tier features.
        </p>
        <div className="mt-6 space-y-2">
          <Link
            href="/"
            className="block w-full rounded-lg bg-nba-blue px-6 py-2.5 text-center text-sm font-semibold text-white hover:bg-nba-blue/90"
          >
            Back to Home
          </Link>
          <Link
            href="/players"
            className="block w-full rounded-lg border border-gray-200 px-6 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Browse Players
          </Link>
        </div>
      </div>
    </div>
  );
}
