"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColours } from "./SalesCharts";

const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const shortMoney = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : Math.abs(n) >= 1000 ? `£${Math.round(n / 1000)}k` : `£${Math.round(n)}`;
const hours = (n: number) => `${Math.round(n * 10) / 10}h`;
const tooltipStyle = { borderRadius: 6, border: `1px solid ${chartColours.grid}`, fontSize: 12 };
const axis = { fontSize: 11, fill: chartColours.mid };

// Revenue by month: this period's invoiced and gross profit, against the same
// months last year.
export function RevenueChart({
  rows,
  height = 300,
}: {
  rows: { label: string; net: number; gp: number; lastNet: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="net" name="Invoiced" fill={chartColours.tealDeep} radius={[3, 3, 0, 0]} />
        <Bar dataKey="gp" name="Gross profit" fill={chartColours.teal} radius={[3, 3, 0, 0]} />
        <Line dataKey="lastNet" name="Invoiced, same month last year" stroke={chartColours.orange} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Quotes by month: won and lost value, with everything quoted as a line.
export function WonLostChart({
  rows,
  height = 280,
}: {
  rows: { label: string; won: number; lost: number; quoted: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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

// A ranked list of money values as horizontal bars (people, accounts, customers).
export function MoneyBars({
  rows,
  colour = chartColours.tealDeep,
  label = "Value",
}: {
  rows: { name: string; value: number }[];
  colour?: string;
  label?: string;
}) {
  const height = Math.max(120, rows.length * 32 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={shortMoney} tick={axis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={150} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} cursor={{ fill: "#f7f7f7" }} />
        <Bar dataKey="value" name={label} fill={colour} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Hours per person (or customer), billable and not billable stacked.
export function HoursBars({ rows }: { rows: { name: string; billable: number; other: number }[] }) {
  const height = Math.max(120, rows.length * 32 + 50);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColours.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={hours} tick={axis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={150} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => hours(Number(v))} cursor={{ fill: "#f7f7f7" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="billable" name="Billable" stackId="h" fill={chartColours.tealDeep} />
        <Bar dataKey="other" name="Not billable" stackId="h" fill={chartColours.teal} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
