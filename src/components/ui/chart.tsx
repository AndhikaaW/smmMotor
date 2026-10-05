import { cn } from "@/lib/utils";

export function ChartContainer({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("h-[260px] w-full [&_.recharts-wrapper]:outline-none", className)}>
      {children}
    </div>
  );
}

export function ChartEmpty({ label = "Belum ada data." }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-muted">{label}</p>;
}

export const chartColors = {
  primary: "#f59e0b",
  success: "#22c55e",
  muted: "#94a3b8",
  danger: "#ef4444",
  // ponytail: 5 warna pie tetap. >5 kategori? Agregasikan jadi "Lainnya" di query.
  pie: ["#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6"],
};

export const idrShort = (v: number) =>
  v >= 1_000_000_000
    ? `${(v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`
    : v >= 1_000_000
      ? `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
      : v >= 1_000
        ? `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`
        : String(v);
