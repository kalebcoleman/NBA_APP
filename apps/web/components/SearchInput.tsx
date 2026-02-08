"use client";

import { useState, useEffect } from "react";

interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export default function SearchInput({ placeholder = "Search...", onSearch, debounceMs = 300 }: SearchInputProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-nba-blue focus:outline-none focus:ring-2 focus:ring-nba-blue/20"
    />
  );
}
