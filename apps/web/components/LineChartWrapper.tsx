"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface LineChartWrapperProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: { key: string; color: string; name?: string }[];
  height?: number;
}

export default function LineChartWrapper({
  data,
  xKey,
  yKeys,
  height = 300,
}: LineChartWrapperProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#6b7280" }} />
        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
        />
        {yKeys.map((yk) => (
          <Line
            key={yk.key}
            type="monotone"
            dataKey={yk.key}
            stroke={yk.color}
            name={yk.name || yk.key}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
