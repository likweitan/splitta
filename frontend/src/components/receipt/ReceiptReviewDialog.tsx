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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReceiptExtraction } from "@/lib/api";

interface ReceiptReviewDialogProps {
  open: boolean;
  extraction: ReceiptExtraction | null;
  imageSrc?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (extraction: ReceiptExtraction) => Promise<void>;
}

interface DraftItem {
  description: string;
  quantity: string;
  priceTaxInclusive: string;
  itemSpecificDiscount: string;
}

interface Draft {
  merchantName: string;
  currency: string;
  taxAmount: string;
  taxPercentage: string;
  discountAmount: string;
  priceAmount: string;
  roundingAdjustment: string;
  pricesIncludeTax: boolean;
  items: DraftItem[];
}

const receiptNumberFields: {
  key: "priceAmount" | "taxAmount" | "taxPercentage" | "discountAmount" | "roundingAdjustment";
  label: string;
  min?: string;
  max?: string;
}[] = [
  { key: "priceAmount", label: "Total", min: "0" },
  { key: "taxAmount", label: "Tax amount", min: "0" },
  { key: "taxPercentage", label: "Tax percentage", min: "0", max: "100" },
  { key: "discountAmount", label: "Receipt discount", min: "0" },
  { key: "roundingAdjustment", label: "Rounding adjustment" },
] as const;

const itemNumberFields = [
  { key: "quantity", label: "Quantity", min: "0.001", step: "any" },
  { key: "priceTaxInclusive", label: "Unit price", min: "0", step: "0.01" },
  {
    key: "itemSpecificDiscount",
    label: "Discount",
    min: "0",
    step: "0.01",
  },
] as const;

function toDraft(extraction: ReceiptExtraction): Draft {
  const asInput = (value: number | null) =>
    value === null ? "" : String(value);

  return {
    merchantName: extraction.receiptInfo.merchantName,
    currency: extraction.receiptInfo.currency,
    taxAmount: asInput(extraction.receiptInfo.taxAmount),
    taxPercentage: asInput(extraction.receiptInfo.taxPercentage),
    discountAmount: asInput(extraction.receiptInfo.discountAmount),
    priceAmount: asInput(extraction.receiptInfo.priceAmount),
    roundingAdjustment: asInput(extraction.receiptInfo.roundingAdjustment),
    pricesIncludeTax: extraction.receiptInfo.pricesIncludeTax,
    items: extraction.items.map((item) => ({
      description: item.description,
      quantity: asInput(item.quantity),
      priceTaxInclusive: asInput(item.priceTaxInclusive),
      itemSpecificDiscount: asInput(item.itemSpecificDiscount),
    })),
  };
}

function readNumber(value: string, label: string, minimum?: number): number {
  if (!value.trim()) throw new Error(`${label} is required; enter 0 if absent.`);
  const number = Number(value);
  if (!Number.isFinite(number) || (minimum !== undefined && number < minimum)) {
    throw new Error(`${label} must be a valid number${minimum === 0 ? " of 0 or more" : ""}.`);
  }
  return number;
}

export function ReceiptReviewDialog({
  open,
  extraction,
  imageSrc,
  onOpenChange,
  onConfirm,
}: ReceiptReviewDialogProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !extraction) return;
    setDraft(toDraft(extraction));
    setError(null);
  }, [open, extraction]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    try {
      const merchantName = draft.merchantName.trim();
      const currency = draft.currency.trim().toUpperCase();
      if (!merchantName) throw new Error("Merchant name is required.");
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error("Currency must be a three-letter code.");
      }

      const receiptInfo = {
        merchantName,
        currency,
        priceAmount: readNumber(draft.priceAmount, "Total", 0),
        taxAmount: readNumber(draft.taxAmount, "Tax amount", 0),
        taxPercentage: readNumber(draft.taxPercentage, "Tax percentage", 0),
        discountAmount: readNumber(
          draft.discountAmount,
          "Receipt discount",
          0,
        ),
        roundingAdjustment: readNumber(
          draft.roundingAdjustment,
          "Rounding adjustment",
        ),
        pricesIncludeTax: draft.pricesIncludeTax,
      };
      if (receiptInfo.taxPercentage > 100) {
        throw new Error("Tax percentage cannot exceed 100.");
      }
      if (draft.items.length === 0) throw new Error("At least one item is required.");

      const items = draft.items.map((item, index) => {
        const description = item.description.trim();
        if (!description) throw new Error(`Item ${index + 1} needs a description.`);
        const quantity = readNumber(item.quantity, `Item ${index + 1} quantity`, 0.001);
        const priceTaxInclusive = readNumber(
          item.priceTaxInclusive,
          `Item ${index + 1} unit price`,
          0,
        );
        const itemSpecificDiscount = readNumber(
          item.itemSpecificDiscount,
          `Item ${index + 1} discount`,
          0,
        );
        if (itemSpecificDiscount > quantity * priceTaxInclusive) {
          throw new Error(`Item ${index + 1} discount exceeds its line total.`);
        }
        return {
          description,
          quantity,
          priceTaxInclusive,
          itemSpecificDiscount,
        };
      });

      setSaving(true);
      setError(null);
      await onConfirm({ receiptInfo, items });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save receipt.");
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (
    index: number,
    field: keyof DraftItem,
    value: string,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [field]: value } : item,
            ),
          }
        : current,
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
    >
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto ${
          imageSrc ? "sm:max-w-5xl" : "sm:max-w-2xl"
        }`}
      >
        <div
          className={
            imageSrc ? "grid gap-6 md:grid-cols-[2fr_3fr] md:items-start" : ""
          }
        >
          {imageSrc && (
            <div className="md:sticky md:top-0">
              <img
                src={imageSrc}
                alt="Scanned receipt"
                className="max-h-[40vh] w-full rounded-md border bg-muted object-contain md:max-h-[75vh]"
              />
            </div>
          )}
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <DialogHeader>
            <DialogTitle>Review receipt details</DialogTitle>
            <DialogDescription>
              Check the scan and fill in any blank values before saving.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-merchant">Merchant</Label>
                  <Input
                    id="review-merchant"
                    value={draft.merchantName}
                    maxLength={255}
                    onChange={(event) =>
                      setDraft({ ...draft, merchantName: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-currency">Currency</Label>
                  <Input
                    id="review-currency"
                    value={draft.currency}
                    maxLength={3}
                    onChange={(event) =>
                      setDraft({ ...draft, currency: event.target.value })
                    }
                  />
                </div>
                {receiptNumberFields.map(({ key, label, min, max }) => (
                  <div className="space-y-2" key={key}>
                    <Label htmlFor={`review-${key}`}>{label}</Label>
                    <Input
                      id={`review-${key}`}
                      type="number"
                      inputMode="decimal"
                      min={min}
                      max={max}
                      step="any"
                      value={draft[key]}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="review-prices-include-tax"
                    checked={draft.pricesIncludeTax}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, pricesIncludeTax: checked === true })
                    }
                  />
                  <Label htmlFor="review-prices-include-tax" className="font-normal">
                    Item prices already include tax
                  </Label>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Items</h3>
                {draft.items.map((item, index) => (
                  <div className="space-y-3 rounded-md border p-3" key={index}>
                    <div className="space-y-2">
                      <Label htmlFor={`review-item-${index}-description`}>
                        Description
                      </Label>
                      <Input
                        id={`review-item-${index}-description`}
                        value={item.description}
                        maxLength={255}
                        onChange={(event) =>
                          updateItem(index, "description", event.target.value)
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {itemNumberFields.map(({ key, label, min, step }) => (
                        <div className="space-y-2" key={key}>
                          <Label htmlFor={`review-item-${index}-${key}`}>
                            {label}
                          </Label>
                          <Input
                            id={`review-item-${index}-${key}`}
                            type="number"
                            inputMode="decimal"
                            min={min}
                            step={step}
                            value={item[key]}
                            onChange={(event) =>
                              updateItem(index, key, event.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
            <Button type="submit" disabled={saving || !draft}>
              {saving ? "Saving..." : "Confirm and save"}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
