import { PageHeader } from "@/components/ui/shared";
import { CategoriesSection } from "@/features/products/CategoriesSection";

export function CategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori"
        description="Kelompokkan produk agar mudah dicari di kasir."
      />
      <CategoriesSection />
    </div>
  );
}
