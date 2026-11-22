import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface ReceiptItemInput {
  description: string;
  quantity: number;
  price_tax_inclusive: number;
  item_specific_discount: number;
  // Units the owner paid for themselves; they are split into their own paid line.
  paid_quantity?: number | null;
}

interface ReceiptItemDialogProps {
  open: boolean;
  item: ReceiptItemInput | null;
  currency: string;
  canMarkPaid?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ReceiptItemInput) => Promise<void>;
}

const emptyForm = {
  description: "",
  quantity: "1",
  price: "",
  discount: "0",
  paidByMe: false,
  paidQuantity: "",
};

export function ReceiptItemDialog({
  open,
  item,
  currency,
  canMarkPaid = false,
  onOpenChange,
  onSave,
}: ReceiptItemDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            description: item.description,
            quantity: String(item.quantity),
            price: String(item.price_tax_inclusive),
            discount: String(item.item_specific_discount || 0),
            paidByMe: false,
            paidQuantity: "",
          }
        : emptyForm,
    );
  }, [open, item]);

  const quantity = Number(form.quantity);
  const price = Number(form.price);
  const discount = Number(form.discount || 0);
  const lineTotal =
    Number.isFinite(quantity) && Number.isFinite(price)
      ? quantity * price - (Number.isFinite(discount) ? discount : 0)
      : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const description = form.description.trim();
    if (!description) return setError("Enter an item description.");
    if (!(quantity > 0)) return setError("Quantity must be greater than 0.");
    if (form.price === "" || !(price >= 0))
      return setError("Enter a unit price of 0 or more.");
    if (!(discount >= 0)) return setError("Discount cannot be negative.");
    if (discount > quantity * price)
      return setError("Discount cannot exceed the line amount.");
    const paidQuantity =
      canMarkPaid && form.paidByMe
        ? Number(form.paidQuantity === "" ? quantity : form.paidQuantity)
        : 0;
    if (form.paidByMe && (!(paidQuantity > 0) || paidQuantity > quantity))
      return setError(
        `Quantity you paid must be greater than 0 and at most ${quantity}.`,
      );

    setSaving(true);
    setError(null);
    try {
      await onSave({
        description,
        quantity: Number(quantity.toFixed(3)),
        price_tax_inclusive: Number(price.toFixed(2)),
        item_specific_discount: Number(discount.toFixed(2)),
        paid_quantity: paidQuantity > 0 ? Number(paidQuantity.toFixed(3)) : null,
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save item.",
      );
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: "description" | "quantity" | "price" | "discount" | "paidQuantity") => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
            <DialogDescription>
              Correct the item details if the scan picked them up wrongly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="item-description">Description</Label>
            <Input
              id="item-description"
              value={form.description}
              maxLength={255}
              autoFocus
              onChange={(e) => setField("description")(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Qty</Label>
              <Input
                id="item-quantity"
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={form.quantity}
                onChange={(e) => setField("quantity")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-price">Unit price</Label>
              <Input
                id="item-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField("price")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-discount">Discount</Label>
              <Input
                id="item-discount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setField("discount")(e.target.value)}
              />
            </div>
          </div>

          {canMarkPaid && (
            <div className="space-y-2">
              <Label htmlFor="item-paid-quantity">Quantity I paid for</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="item-paid-quantity"
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  max={form.quantity || undefined}
                  step="any"
                  className="w-28"
                  disabled={!form.paidByMe}
                  value={form.paidByMe ? form.paidQuantity : ""}
                  placeholder={form.paidByMe ? form.quantity : ""}
                  onChange={(e) => setField("paidQuantity")(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="item-paid-by-me"
                    checked={form.paidByMe}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        paidByMe: checked === true,
                        paidQuantity: "",
                      }))
                    }
                  />
                  <Label htmlFor="item-paid-by-me" className="font-normal">
                    Paid by me
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tick this to mark the item as paid by you. Leave the quantity
                blank to cover all of it.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Line total:{" "}
            <span className="font-medium text-foreground">
              {currency} {lineTotal.toFixed(2)}
            </span>
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
