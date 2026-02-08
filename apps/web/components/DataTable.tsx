"use client";

import { useState } from "react";

interface Column {
  key: string;
  header: string;

  render?: (row: any) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

interface DataTableProps {
  columns: Column[];

  data: any[];
  isLoading?: boolean;
  emptyMessage?: string;

  onRowClick?: (row: any) => void;
}

export default function DataTable({
  columns,
  data,
  isLoading,
  emptyMessage = "No data available",
  onRowClick,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortDir === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.sortable ? "cursor-pointer select-none hover:text-gray-900" : ""}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.header}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 transition ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
