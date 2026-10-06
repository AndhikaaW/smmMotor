import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartEmpty, chartColors, idrShort } from "@/components/ui/chart";
import type { TrendPoint } from "@/lib/firestore/transactions";

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 12,
} as const;

export function RevenueBarCard({
  title,
  description,
  data,
  loading,
}: {
  title: string;
  description: string;
  data: TrendPoint[] | undefined;
  loading: boolean;
}) {
  const hasData = (data ?? []).some((d) => d.revenue > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartEmpty label="Memuat grafik..." />
        ) : !hasData ? (
          <ChartEmpty />
        ) : (
          <ChartContainer>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={idrShort} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={((value: unknown, name: unknown) => [
                    `Rp${Number(value ?? 0).toLocaleString("id-ID")}`,
                    name === "revenue" ? "Omzet" : String(name ?? ""),
                  ]) as never}
                />
                <Bar dataKey="revenue" fill={chartColors.primary} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}


export function TopListBarCard({
  title,
  description,
  items,
  valueLabel,
}: {
  title: string;
  description: string;
  items: { name: string; qty: number; revenue: number }[];
  valueLabel: string;
}) {
  const data = items.slice(0, 5).map((p) => ({ name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name, qty: p.qty }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ChartContainer className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} formatter={((value: unknown) => [`${Number(value ?? 0)} ${valueLabel}`, "Terjual"]) as never} />
                <Bar dataKey="qty" fill={chartColors.success} radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
