import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { Plus, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, FormField, EmptyState } from "@/components/ui/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase/client";
import {
  createManagedUser,
  setUserActive,
  setUserRole,
  userFormSchema,
  type UserFormInput,
} from "@/lib/firestore/users";
import type { AppUser } from "@/types";
import { friendlyError } from "@/lib/errors";

async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => d.data() as AppUser);
}

const EMPTY: UserFormInput = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  role: "admin",
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserFormInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  const createMutation = useMutation({
    mutationFn: createManagedUser,
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setFormError(null);
      refresh();
    },
    onError: (err) => {
      setFormError(friendlyError(err, "Gagal menyimpan user. Coba lagi ya."));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ uid, isActive }: { uid: string; isActive: boolean }) =>
      setUserActive(uid, isActive),
    onSuccess: refresh,
  });

  const roleMutation = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: "superadmin" | "admin" }) =>
      setUserRole(uid, role),
    onSuccess: refresh,
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = userFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Cek lagi isian form ya.");
      return;
    }
    createMutation.mutate(parsed.data);
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        description="Kelola akun superadmin & admin."
        action={
          <Button onClick={() => { setForm(EMPTY); setFormError(null); setOpen(true); }}>
            <Plus />
            Tambah Pengguna
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Username</th>
                <th className="hidden px-5 py-3 md:table-cell">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {u.name?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted font-mono text-xs">{u.username}</td>
                  <td className="hidden px-5 py-3.5 text-muted md:table-cell">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <Select
                      value={u.role}
                      onValueChange={(val) =>
                        roleMutation.mutate({ uid: u.uid, role: val as "superadmin" | "admin" })
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <Shield className="h-3 w-3" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={u.isActive ? "success" : "secondary"}>
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleMutation.mutate({ uid: u.uid, isActive: !u.isActive })
                      }
                      className="h-8 px-2 text-muted hover:text-text"
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usersQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {usersQuery.isError && (
          <div className="p-6 text-center text-sm text-danger">
            {friendlyError(usersQuery.error, "Gagal memuat pengguna. Cek koneksi lalu muat ulang ya.")}
          </div>
        )}

        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
          <EmptyState icon="👤" title="Belum ada pengguna" />
        )}
      </Card>

      {/* Dialog Tambah User */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            <DialogDescription>
              Buat akun superadmin atau admin untuk sistem POS.
            </DialogDescription>
          </DialogHeader>

          <form
            id="user-form"
            onSubmit={handleCreate}
            className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"
          >
            <FormField label="Nama Lengkap">
              <Input
                required
                placeholder="Nama"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <FormField label="Username">
              <Input
                required
                placeholder="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </FormField>

            <FormField label="Email">
              <Input
                required
                type="email"
                placeholder="email@domain.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>

            <FormField label="No HP">
              <Input
                required
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>

            <FormField label="Password">
              <Input
                required
                type="password"
                placeholder="min. 6 karakter"
                value={form.password ?? ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </FormField>

            <FormField label="Role">
              <Select
                value={form.role}
                onValueChange={(val) =>
                  setForm({ ...form, role: val as "superadmin" | "admin" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </form>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="user-form"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Menyimpan..." : "Tambah Pengguna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
