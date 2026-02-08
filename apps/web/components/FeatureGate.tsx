"use client";

import { useAuth } from "@/lib/auth-context";
import UpgradePrompt from "./UpgradePrompt";

interface FeatureGateProps {
  feature: "exports" | "qa" | "history" | "advanced_metrics" | "full_leaderboard" | "unlimited_compare";
  children: React.ReactNode;
  fallbackMessage?: string;
}

const featureMessages: Record<string, string> = {
  exports: "Export data to CSV with Premium",
  qa: "Get unlimited AI Q&A queries with Premium",
  history: "Access full search history with Premium",
  advanced_metrics: "Unlock advanced metrics (xFG, SDI, POE) with Premium",
  full_leaderboard: "See full leaderboard rankings with Premium",
  unlimited_compare: "Compare unlimited players with Premium",
};

export default function FeatureGate({ feature, children, fallbackMessage }: FeatureGateProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (user?.plan === "premium") {
    return <>{children}</>;
  }

  return <UpgradePrompt message={fallbackMessage || featureMessages[feature]} />;
}
