"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { createCheckoutSession, ApiError } from "./api";
import { useState, useCallback, useEffect, useRef } from "react";

type Plan = "monthly" | "annual";

interface StartUpgradeOptions {
  plan?: Plan;
  nextPath?: string;
}

/**
 * Shared upgrade hook used by every upgrade button in the app.
 *
 * Behaviour:
 *  - Anonymous user  → redirect to /login?next=<currentPath>
 *  - Authenticated   → call billing checkout → redirect to Stripe URL
 *  - 401 from API    → redirect to login
 *  - Stripe missing  → show friendly error (auto-dismissed after 4s)
 */
export function useUpgrade() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!error) return;
    timerRef.current = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timerRef.current);
  }, [error]);

  const startUpgrade = useCallback(
    async (options?: StartUpgradeOptions) => {
      setError("");
      const plan = options?.plan ?? "monthly";
      const next = options?.nextPath ?? pathname;

      if (!isAuthenticated) {
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        const planKey = plan === "annual" ? "premium_annual" : "premium_monthly";
        const { url } = await createCheckoutSession(planKey);
        if (url && url !== "#upgrade-not-available") {
          window.location.href = url;
        } else {
          setError("Billing is not configured. Please try again later.");
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.push(`/login?next=${encodeURIComponent(next)}`);
        } else if (e instanceof ApiError && e.status >= 500) {
          setError("Billing service unavailable. Try again later.");
        } else {
          setError("Could not start checkout. Try again.");
        }
      }
    },
    [isAuthenticated, pathname, router],
  );

  const clearError = useCallback(() => setError(""), []);

  return { startUpgrade, error, clearError };
}
