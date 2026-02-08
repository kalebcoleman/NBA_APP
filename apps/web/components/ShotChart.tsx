"use client";

import type { ShotData } from "@/lib/types";

interface ShotChartProps {
  shots: ShotData[];
  width?: number;
  height?: number;
  label?: string;
}

// NBA court coordinates: X ranges -250 to 250, Y ranges -50 to ~420
// We map to a half-court SVG. The court is 50ft wide (500 units) x 47ft deep (~470 units).
// We scale to fit the SVG viewBox.

export default function ShotChart({ shots, width = 500, height = 470, label }: ShotChartProps) {
  // Transform NBA coords to SVG coords:
  // NBA X: -250..250 -> SVG X: 0..500 (shift by 250)
  // NBA Y: -50..420 -> SVG Y: 420..(-50) -> we flip Y (SVG y goes down)
  const toSvgX = (locX: number) => locX + 250;
  const toSvgY = (locY: number) => 420 - locY;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <svg
        viewBox="0 0 500 470"
        width={width}
        height={height}
        className="mx-auto block"
      >
        {/* Court background */}
        <rect x="0" y="0" width="500" height="470" fill="#f3f0e8" />

        {/* Paint (16ft wide, 19ft deep) */}
        <rect x="170" y="320" width="160" height="190" fill="none" stroke="#c8102e" strokeWidth="1.5" opacity="0.5" />

        {/* Free throw circle */}
        <circle cx="250" cy="320" r="60" fill="none" stroke="#c8102e" strokeWidth="1" opacity="0.4" />

        {/* Basket */}
        <circle cx="250" cy="402" r="8" fill="none" stroke="#c8102e" strokeWidth="2" />

        {/* Backboard */}
        <line x1="220" y1="410" x2="280" y2="410" stroke="#333" strokeWidth="2" />

        {/* 3-point line (arc) */}
        <path
          d="M 30 420 L 30 340 Q 250 60 470 340 L 470 420"
          fill="none"
          stroke="#1d428a"
          strokeWidth="1.5"
          opacity="0.5"
        />

        {/* Restricted area arc */}
        <path
          d="M 210 420 A 40 40 0 0 1 290 420"
          fill="none"
          stroke="#666"
          strokeWidth="1"
          opacity="0.4"
        />

        {/* Shot dots */}
        {shots.map((shot, i) => (
          <circle
            key={i}
            cx={toSvgX(shot.locX)}
            cy={toSvgY(shot.locY)}
            r={4}
            fill={shot.made ? "#22c55e" : "#ef4444"}
            opacity={0.7}
            stroke={shot.made ? "#16a34a" : "#dc2626"}
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-gray-200 bg-white px-4 py-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Made
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Missed
        </span>
        <span className="text-gray-400">
          {shots.length} shots | {shots.filter((s) => s.made).length} made (
          {shots.length > 0 ? ((shots.filter((s) => s.made).length / shots.length) * 100).toFixed(1) : 0}%)
        </span>
        {label && <span className="text-nba-gold font-medium">{label}</span>}
      </div>
    </div>
  );
}
