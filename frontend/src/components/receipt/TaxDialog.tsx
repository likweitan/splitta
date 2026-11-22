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

export interface TaxInput {
  tax_percentage: number;
  tax_amount: number;
}

interface TaxDialogProps {
  open: boolean;
  currency: string;
  taxPercentage: number;
  taxAmount: number;
  /** Item total after item and receipt discounts, used to keep % and amount in sync. */
  taxableAmount: number;
  pricesIncludeTax: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tax: TaxInput) => Promise<void>;
}

const round = (value: number, decimals: number) =>
  Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;

export function TaxDialog({
  open,
  currency,
  taxPercentage,
  taxAmount,
  taxableAmount,
  pricesIncludeTax,
  onOpenChange,
  onSave,
}: TaxDialogProps) {
  const [percentage, setPercentage] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPercentage(String(taxPercentage || 0));
    setAmount((taxAmount || 0).toFixed(2));
  }, [open, taxPercentage, taxAmount]);

  const amountFromPercentage = (pct: number) =>
    pricesIncludeTax
      ? (taxableAmount * pct) / (100 + pct)
      : (taxableAmount * pct) / 100;

  const percentageFromAmount = (value: number) => {
    const base = pricesIncludeTax ? taxableAmount - value : taxableAmount;
    return base > 0 ? (value / base) * 100 : 0;
  };

  const handlePercentageChange = (value: string) => {
    setPercentage(value);
    const pct = Number(value);
    if (value !== "" && pct >= 0 && taxableAmount > 0) {
      setAmount(round(amountFromPercentage(pct), 2).toFixed(2));
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const taxValue = Number(value);
    if (value !== "" && taxValue >= 0 && taxableAmount > 0) {
      setPercentage(String(round(percentageFromAmount(taxValue), 3)));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const pct = Number(percentage || 0);
    const taxValue = Number(amount || 0);
    if (!(pct >= 0 && pct <= 100))
      return setError("Tax percentage must be between 0 and 100.");
    if (!(taxValue >= 0)) return setError("Tax amount cannot be negative.");

    setSaving(true);
    setError(null);
    try {
      await onSave({
        tax_percentage: round(pct, 3),
        tax_amount: round(taxValue, 2),
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save tax.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit tax</DialogTitle>
            <DialogDescription>
              Changing one value recalculates the other from the item total of{" "}
              {currency} {taxableAmount.toFixed(2)}
              {pricesIncludeTax ? " (tax included in prices)" : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tax-percentage">Tax %</Label>
              <Input
                id="tax-percentage"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="any"
                autoFocus
                value={percentage}
                onChange={(e) => handlePercentageChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-amount">Tax amount ({currency})</Label>
              <Input
                id="tax-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>

          {!pricesIncludeTax && (
            <p className="text-xs text-muted-foreground">
              The receipt total will be adjusted by the change in tax.
            </p>
          )}

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
              {saving ? "Saving..." : "Save tax"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
