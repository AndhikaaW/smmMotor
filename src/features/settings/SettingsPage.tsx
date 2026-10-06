import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField, PageHeader } from "@/components/ui/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  getGeneralSettings,
  saveGeneralSettings,
  type SettingsInput,
} from "@/lib/firestore/settings";
import type { PaymentMethod } from "@/types";
import { generalSettingsSeed } from "@/lib/firestore/settingsSeed";

import { friendlyError } from "@/lib/errors";
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer" },
  { value: "debit", label: "Debit" },
  { value: "other", label: "Lainnya" },
];

export function SettingsPage() {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings", "general"],
    queryFn: getGeneralSettings,
  });

  const [form, setForm] = useState<SettingsInput>({
    ...generalSettingsSeed,
    paperSize: (generalSettingsSeed.paperSize ?? "80") as "58" | "80",
    paymentMethods: [...generalSettingsSeed.paymentMethods] as PaymentMethod[],
  });
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        storeName: settingsQuery.data.storeName,
        address: settingsQuery.data.address ?? "",
        phone: settingsQuery.data.phone ?? "",
        email: settingsQuery.data.email ?? "",
        receiptHeader: settingsQuery.data.receiptHeader ?? "",
        receiptFooter: settingsQuery.data.receiptFooter ?? "",
        paperSize: settingsQuery.data.paperSize ?? "80",
        paymentMethods: settingsQuery.data.paymentMethods ?? ["cash"],
      });
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (input: SettingsInput) =>
      saveGeneralSettings(input, appUser?.uid ?? ""),
    onSuccess: () => {
      setSaved(true);
      setErrorMsg(null);
      setTimeout(() => setSaved(false), 2500);
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err) => {
      setErrorMsg(friendlyError(err, "Gagal menyimpan pengaturan. Coba lagi ya."));
    },
  });

  function toggleMethod(method: PaymentMethod) {
    setForm((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter((m) => m !== method)
        : [...prev.paymentMethods, method],
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Identitas toko, struk, dan metode pembayaran."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrorMsg(null);
          saveMutation.mutate(form);
        }}
        className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2"
      >
        {/* Identitas Toko */}
        <Card>
          <CardHeader>
            <CardTitle>Identitas Toko</CardTitle>
            <CardDescription>Nama dan kontak bengkel yang tampil di struk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Nama Bengkel">
              <Input
                required
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              />
            </FormField>
            <FormField label="Alamat">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
            <FormField label="Nomor Telepon">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email (tampil di struk)">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contoh@bengkel.com"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Struk */}
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Struk</CardTitle>
            <CardDescription>Header, footer, dan ukuran kertas thermal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Header Struk">
              <Input
                value={form.receiptHeader}
                onChange={(e) => setForm({ ...form, receiptHeader: e.target.value })}
              />
            </FormField>
            <FormField label="Footer Struk">
              <Input
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
              />
            </FormField>
            <FormField label="Ukuran Kertas">
              <Select
                value={form.paperSize}
                onValueChange={(val) =>
                  setForm({ ...form, paperSize: val as "58" | "80" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </CardContent>
        </Card>

        {/* Metode Pembayaran */}
        <Card>
          <CardHeader>
            <CardTitle>Metode Pembayaran</CardTitle>
            <CardDescription>Pilih metode yang tersedia di kasir.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => {
                const active = form.paymentMethods.includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => toggleMethod(m.value)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-muted hover:bg-background"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle className="h-4 w-4" /> Tersimpan
            </span>
          )}
          {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
        </div>
      </form>
    </div>
  );
}
