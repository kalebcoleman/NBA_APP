"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Status = "checking" | "confirmed" | "waiting" | "error";

const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 3000;

export default function BillingSuccessPage() {
  const router = useRouter();
  const { user, refreshUser, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const checkPlan = useCallback(async () => {
    try {
      await refreshUser();
    } catch {
      // refreshUser handles errors internally
    }
  }, [refreshUser]);

  // Poll /me until plan === premium or retries exhausted
  useEffect(() => {
    if (!isAuthenticated) {
      setStatus("error");
      return;
    }

    if (user?.plan === "premium") {
      setStatus("confirmed");
      return;
    }

    if (retryCount.current >= MAX_RETRIES) {
      setStatus("waiting");
      return;
    }

    setStatus("checking");
    timerRef.current = setTimeout(() => {
      retryCount.current += 1;
      checkPlan();
    }, RETRY_INTERVAL_MS);

    return () => clearTimeout(timerRef.current);
  }, [user, isAuthenticated, checkPlan]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Not Signed In</h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in to verify your subscription status.
          </p>
          <button
            onClick={() => router.push("/login?next=/billing/success")}
            className="mt-4 rounded-lg bg-nba-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-nba-blue/90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {status === "checking" && (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-nba-blue" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">Confirming Your Upgrade...</h1>
            <p className="mt-2 text-sm text-gray-500">
              Verifying payment with Stripe. This usually takes a few seconds.
            </p>
          </>
        )}

        {status === "confirmed" && (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Welcome to Premium!</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your account has been upgraded. You now have unlimited access to all
              NBA Analytics features.
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => router.push("/players")}
                className="w-full rounded-lg bg-nba-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-nba-blue/90"
              >
                Explore Players
              </button>
              <button
                onClick={() => router.push("/qa")}
                className="w-full rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Try AI Q&A
              </button>
            </div>
          </>
        )}

        {status === "waiting" && (
          <>
            <div className="text-4xl">⏳</div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Waiting for Confirmation</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your payment was received but the upgrade hasn&apos;t been confirmed yet.
              This can take a minute. Try refreshing.
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  retryCount.current = 0;
                  setStatus("checking");
                  checkPlan();
                }}
                className="w-full rounded-lg bg-nba-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-nba-blue/90"
              >
                Check Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Go to Home
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl">⚠️</div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Something Went Wrong</h1>
            <p className="mt-2 text-sm text-gray-600">
              We couldn&apos;t verify your subscription. Please sign in and try again.
            </p>
            <button
              onClick={() => router.push("/login?next=/billing/success")}
              className="mt-4 rounded-lg bg-nba-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-nba-blue/90"
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
