import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

export function PaymentDonutCard({
  byPayment,
  loading,
}: {
  byPayment: Record<string, number> | undefined;
  loading: boolean;
}) {
  const data = Object.entries(byPayment ?? {})
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metode Pembayaran</CardTitle>
        <CardDescription>Komposisi omzet per metode bayar.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartEmpty label="Memuat grafik..." />
        ) : data.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartContainer className="h-[200px] sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={((value: unknown) => [
                      `Rp${Number(value ?? 0).toLocaleString("id-ID")}`,
                      "Omzet",
                    ]) as never}
                  />
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={chartColors.pie[i % chartColors.pie.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <ul className="w-full space-y-2 text-sm sm:w-1/2">
              {data.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: chartColors.pie[i % chartColors.pie.length] }}
                    />
                    {d.name}
                  </span>
                  <span className="font-medium">Rp{d.value.toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          </div>
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
