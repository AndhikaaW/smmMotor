import { Input } from "@/components/ui/input";

interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  value: number;
  onValueChange: (n: number) => void;
}

// ponytail: integer-only dengan grouping id-ID. Butuh desimal? Tambah prop `decimals`.
export function NumberInput({
  value,
  onValueChange,
  placeholder = "0",
  ...props
}: NumberInputProps) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={Number.isFinite(value) ? (value as number).toLocaleString("id-ID") : ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onValueChange(digits ? parseInt(digits, 10) : 0);
      }}
      {...props}
    />
  );
}
