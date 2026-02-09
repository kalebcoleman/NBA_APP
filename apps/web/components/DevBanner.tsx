"use client";

import { BASE_URL } from "@/lib/api";

export default function DevBanner() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-gray-50 px-4 py-1 text-center text-xs text-gray-400">
      API: {BASE_URL}
    </div>
  );
}
