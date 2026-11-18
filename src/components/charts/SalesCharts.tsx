"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthStats } from "@/lib/sales/stats";

// Footprint brand colours.
export const chartColours = {
  pink: "#de2277",
  teal: "#7bcbd1",
  tealDeep: "#0092a3",
  orange: "#e58207",
  amber: "#fab200",
  mid: "#888888",
  error: "#c81e1e",
  grid: "#e8e8e8",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const shortMoney = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : Math.abs(n) >= 1000 ? `£${Math.round(n / 1000)}k` : `£${Math.round(n)}`;
const tooltipStyle = { borderRadius: 6, border: `1px solid ${chartColours.grid}`, fontSize: 12 };
const axis = { fontSize: 11, fill: chartColours.mid };

// Invoiced each month (paid vs still owed), with the margin % as a line.
export function InvoicedChart({ months, height = 280 }: { months: MonthStats[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis yAxisId="money" tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} width={52} />
        <YAxis yAxisId="pct" orientation="right" unit="%" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name) => (name === "Margin" ? `${v}%` : money(Number(v)))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="money" dataKey="paid" name="Paid" stackId="inv" fill={chartColours.tealDeep} />
        <Bar yAxisId="money" dataKey="unpaid" name="Not paid yet" stackId="inv" fill={chartColours.teal} radius={[3, 3, 0, 0]} />
        <Line yAxisId="pct" dataKey="marginPct" name="Margin" stroke={chartColours.pink} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Quotes each month: won and lost, with everything quoted as a line.
export function QuotesChart({ months, height = 280 }: { months: MonthStats[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="won" name="Won" fill={chartColours.tealDeep} radius={[3, 3, 0, 0]} />
        <Bar dataKey="lost" name="Lost" fill={chartColours.mid} radius={[3, 3, 0, 0]} />
        <Line dataKey="quoted" name="All quoted" stroke={chartColours.orange} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// What customers owe, by how late it is.
export function OwedChart({ owed, height = 240 }: { owed: { bucket: string; value: number }[]; height?: number }) {
  const colours = [chartColours.tealDeep, chartColours.amber, chartColours.orange, chartColours.pink, chartColours.error];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={owed} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="bucket" tick={axis} tickLine={false} axisLine={false} width={118} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} cursor={{ fill: "#f7f7f7" }} />
        <Bar dataKey="value" name="Owed" radius={[0, 3, 3, 0]}>
          {owed.map((o, i) => (
            <Cell key={o.bucket} fill={colours[i] ?? chartColours.mid} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Biggest customers by value invoiced.
export function TopCustomersChart({ customers, height = 280 }: { customers: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={customers} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={axis}
          tickLine={false}
          axisLine={false}
          width={130}
          tickFormatter={(n: string) => (n.length > 20 ? `${n.slice(0, 19)}…` : n)}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} cursor={{ fill: "#f7f7f7" }} />
        <Bar dataKey="value" name="Invoiced" fill={chartColours.pink} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
