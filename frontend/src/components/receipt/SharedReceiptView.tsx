import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  Store,
  Receipt,
  ImageIcon,
  QrCode,
  Copy,
  Check,
  CreditCard,
  CheckCircle2,
  Minus,
  Plus,
  Flag,
} from "lucide-react";

const REPORT_ISSUE_URL = "https://github.com/tenthring/splitta-backend/issues";

import {
  ApiError,
  getSharedReceipt,
  imageDataUrl,
  markSharedItemsPaid,
} from "@/lib/api";
import { itemTaxRate, withAllocatedTax } from "@/lib/receipt-math";
import { ShareReceiptDialog } from "@/components/receipt/ShareReceiptDialog";

interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  price_tax_inclusive: number;
  item_specific_discount: number;
  paid_by: string | null;
  paid_by_name: string | null;
}

interface ReceiptData {
  id: string;
  merchant_name: string;
  currency: string;
  price_amount: number;
  tax_amount: number;
  tax_percentage: number;
  discount_amount: number;
  rounding_adjustment: number;
  prices_include_tax: boolean;
  image_url: string | null;
  created_at: string;
  items: ReceiptItem[];
}

interface PaymentMethod {
  id: string;
  bank_name: string;
  account_name: string | null;
  payment_type: "bank_account" | "phone_number";
  payment_value: string;
  qr_image_url: string | null;
  qr_data: string | null;
}

interface SharedReceiptViewProps {
  receiptId: string;
  viewerName?: string;
  /** Rendered inside the app sidebar layout instead of as a full page. */
  embedded?: boolean;
}

function PayerAvatar({
  name,
  initials,
  size,
  className,
}: {
  name: string;
  initials: string;
  size: string;
  className: string;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className={size}>
            <AvatarFallback className={className}>{initials}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SharedReceiptView({
  receiptId: id,
  viewerName = "",
  embedded = false,
}: SharedReceiptViewProps) {
  const rootClass = embedded
    ? "flex-1 bg-background"
    : "min-h-screen bg-background";
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQtys, setSelectedQtys] = useState<Map<string, number>>(
    new Map(),
  );
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [guestName, setPaidByName] = useState("");
  // Signed-in viewers always pay under their account name.
  const nameLocked = !!viewerName.trim();
  const paidByName = nameLocked ? viewerName : guestName;
  const [markingPaid, setMarkingPaid] = useState(false);

  const fetchReceipt = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getSharedReceipt<{
        ID: string;
        merchantName: string;
        currency: string;
        priceAmount: number;
        taxAmount: number;
        taxPercentage: number;
        discountAmount: number;
        roundingAdjustment: number;
        pricesIncludeTax?: boolean | null;
        imageData?: string | null;
        createdAt: string;
        items: {
          ID: string;
          description: string;
          quantity: number;
          priceTaxInclusive: number;
          itemSpecificDiscount: number;
          paidBy?: string | null;
          paidByName?: string | null;
        }[];
        paymentMethod?: {
          bankName: string;
          accountName?: string | null;
          paymentType: PaymentMethod["payment_type"];
          paymentValue: string;
          qrData?: string | null;
        } | null;
      }>(id);
      const receiptData: ReceiptData = {
        id: data.ID,
        merchant_name: data.merchantName,
        currency: data.currency,
        price_amount: Number(data.priceAmount),
        tax_amount: Number(data.taxAmount),
        tax_percentage: Number(data.taxPercentage),
        discount_amount: Number(data.discountAmount),
        rounding_adjustment: Number(data.roundingAdjustment),
        prices_include_tax: data.pricesIncludeTax !== false,
        image_url: imageDataUrl(data.imageData),
        created_at: data.createdAt,
        items: data.items.map((item) => ({
          id: item.ID,
          description: item.description,
          quantity: Number(item.quantity),
          price_tax_inclusive: Number(item.priceTaxInclusive),
          item_specific_discount: Number(item.itemSpecificDiscount),
          paid_by: item.paidBy || null,
          paid_by_name: item.paidByName || null,
        })),
      };

      setReceipt(receiptData);

      setPaymentMethod(
        data.paymentMethod
          ? {
              id: "",
              bank_name: data.paymentMethod.bankName,
              account_name: data.paymentMethod.accountName ?? null,
              payment_type: data.paymentMethod.paymentType,
              payment_value: data.paymentMethod.paymentValue,
              qr_image_url: null,
              qr_data: data.paymentMethod.qrData ?? null,
            }
          : null,
      );
    } catch (err: unknown) {
      console.error("Failed to load shared receipt:", err);
      setError(
        err instanceof ApiError && [400, 404].includes(err.status)
          ? "This receipt doesn't exist or has been removed."
          : "Failed to load receipt.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const formatCurrency = (amount: number) => {
    return `${receipt?.currency || "MYR"} ${amount.toFixed(2)}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleItem = (itemId: string) => {
    const item = receipt?.items?.find((i) => i.id === itemId);
    if (!item || item.paid_by_name) return;
    setSelectedQtys((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.set(itemId, item.quantity);
      }
      return next;
    });
  };

  const setItemQty = (itemId: string, qty: number) => {
    const item = receipt?.items?.find((i) => i.id === itemId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(qty, item.quantity));
    setSelectedQtys((prev) => {
      const next = new Map(prev);
      next.set(itemId, clamped);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked && receipt?.items) {
      const next = new Map<string, number>();
      receipt.items
        .filter((item) => !item.paid_by_name)
        .forEach((item) => next.set(item.id, item.quantity));
      setSelectedQtys(next);
    } else {
      setSelectedQtys(new Map());
    }
  };

  const subtotal =
    receipt?.items?.reduce(
      (sum, item) => sum + item.price_tax_inclusive * item.quantity,
      0,
    ) ?? 0;

  const totalItemDiscounts =
    receipt?.items?.reduce(
      (sum, item) => sum + (item.item_specific_discount || 0),
      0,
    ) ?? 0;

  const taxRate = receipt
    ? itemTaxRate(
        receipt.items ?? [],
        receipt.tax_amount,
        receipt.prices_include_tax,
      )
    : 0;

  // Item amounts payers see, including their share of tax added on top of pre-tax prices.
  const expandedItems = useMemo(
    () => withAllocatedTax(receipt?.items ?? [], taxRate),
    [receipt?.items, taxRate],
  );

  // Partly paid items are stored as a paid line plus an unpaid remainder; show them as one
  // row with the original quantity and the avatars of whoever already paid.
  const displayRows = useMemo(() => {
    const groups = new Map<string, typeof expandedItems>();
    for (const item of expandedItems) {
      const key = `${item.description}|${item.price_tax_inclusive}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.values()].map((lines) => {
      const item = lines.find((l) => !l.paid_by_name) ?? lines[0];
      return {
        item,
        totalQty: lines.reduce((sum, l) => sum + l.quantity, 0),
        payers: lines.filter((l) => l.paid_by_name).map((l) => l.paid_by_name!),
      };
    });
  }, [expandedItems]);

  const selectedTotal = useMemo(() => {
    return expandedItems
      .filter((item) => selectedQtys.has(item.id))
      .reduce((sum, item) => {
        const qty = selectedQtys.get(item.id) || 0;
        const unitDiscount =
          (item.item_specific_discount || 0) / (item.quantity || 1);
        return sum + (item.price_tax_inclusive - unitDiscount) * qty;
      }, 0);
  }, [expandedItems, selectedQtys]);

  const unpaidItems =
    receipt?.items?.filter((item) => !item.paid_by_name) ?? [];
  const allSelected =
    unpaidItems.length > 0 &&
    unpaidItems.every((item) => selectedQtys.has(item.id));
  const someSelected = selectedQtys.size > 0 && !allSelected;

  const handleMarkAsPaid = async () => {
    if (!id || !paidByName.trim() || selectedQtys.size === 0 || !receipt)
      return;
    setMarkingPaid(true);
    try {
      const ids = Array.from(selectedQtys.keys());
      await markSharedItemsPaid(
        id,
        ids,
        paidByName.trim(),
        Object.fromEntries(selectedQtys),
      );

      // Partially paid lines are split server-side, so reload.
      await fetchReceipt();
      setSelectedQtys(new Map());
      setShowPayDialog(false);
      setPaidByName("");
    } catch (err) {
      console.error("Failed to mark as paid:", err);
    } finally {
      setMarkingPaid(false);
    }
  };

  if (loading) {
    return (
      <div className={rootClass}>
        <div className="mx-auto max-w-4xl p-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[400px]" />
            <div className="space-y-4">
              <Skeleton className="h-[200px]" />
              <Skeleton className="h-[180px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className={rootClass}>
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-4 p-6 ${embedded ? "min-h-[50vh]" : "min-h-screen"}`}
        >
          <Receipt className="h-16 w-16 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold text-muted-foreground">
            {error || "Receipt not found"}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="mx-auto max-w-4xl p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {receipt.merchant_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Receipt ID: {receipt.id.substring(0, 8)}...
              {receipt.id.substring(receipt.id.length - 4)}
            </p>
          </div>
          <ShareReceiptDialog receiptId={id} />
        </div>

        <div className="space-y-6">
          {/* Receipt Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Receipt Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Store className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p className="text-sm font-medium">
                      {receipt.merchant_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Date Scanned
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(receipt.created_at).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <p className="text-sm font-medium">{receipt.currency}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                    <span className="text-sm font-bold text-emerald-600">
                      $
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Total Amount
                    </p>
                    <p className="text-sm font-bold text-emerald-600">
                      {formatCurrency(receipt.price_amount)}
                    </p>
                  </div>
                </div>
              </div>
              {receipt.image_url && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full sm:w-auto"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      View Receipt Image
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] p-4 flex flex-col pt-10">
                    <div className="flex-1 overflow-y-auto bg-muted/30 rounded-lg min-h-0 border p-2 text-center">
                      <img
                        src={receipt.image_url}
                        alt="Receipt full size"
                        className="w-full h-auto object-contain mx-auto"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Itemized Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Itemized Breakdown
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {expandedItems.length} item
                  {expandedItems.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              {taxRate > 0 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Prices include each item's share of the{" "}
                  {formatCurrency(receipt.tax_amount)} tax.
                </p>
              )}
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {receipt.items && receipt.items.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6 w-10">
                            <Checkbox
                              checked={
                                allSelected
                                  ? true
                                  : someSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={(checked) =>
                                toggleAll(!!checked)
                              }
                              disabled={unpaidItems.length === 0}
                              aria-label="Select all items"
                            />
                          </TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          {totalItemDiscounts > 0 && (
                            <TableHead className="text-right">
                              Discount
                            </TableHead>
                          )}
                          <TableHead className="text-right pr-6">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayRows.map(({ item, totalQty, payers }) => {
                          const isSelected = selectedQtys.has(item.id);
                          const isPaid = !!item.paid_by_name;
                          const unitDiscount =
                            (item.item_specific_discount || 0) /
                            (item.quantity || 1);
                          const selectedQty = selectedQtys.get(item.id) || 0;
                          const itemTotal = isPaid
                            ? (item.price_tax_inclusive - unitDiscount) *
                              totalQty
                            : (item.price_tax_inclusive - unitDiscount) *
                              selectedQty;

                          return (
                            <TableRow
                              key={item.id}
                              onClick={(e) => {
                                if (
                                  !(e.target as HTMLElement).closest(
                                    "button, input",
                                  )
                                )
                                  toggleItem(item.id);
                              }}
                              className={`${isPaid ? "" : "cursor-pointer"} ${isSelected ? "bg-primary/5" : ""}`}
                            >
                              <TableCell className="pl-6">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItem(item.id)}
                                  disabled={isPaid}
                                  aria-label={`Select ${item.description}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {item.description}
                                  {payers.map((p) => (
                                    <PayerAvatar
                                      key={p}
                                      name={p}
                                      size="h-6 w-6"
                                      className="text-[10px] bg-emerald-100 text-emerald-700"
                                      initials={getInitials(p)}
                                    />
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {isSelected ? (
                                  <div className="inline-flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setItemQty(item.id, selectedQty - 1)
                                      }
                                      disabled={selectedQty <= 1}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.quantity}
                                      value={selectedQty}
                                      onChange={(e) =>
                                        setItemQty(
                                          item.id,
                                          parseInt(e.target.value) || 1,
                                        )
                                      }
                                      className="h-6 w-10 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setItemQty(item.id, selectedQty + 1)
                                      }
                                      disabled={selectedQty >= item.quantity}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {totalQty}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(item.price_tax_inclusive)}
                              </TableCell>
                              {totalItemDiscounts > 0 && (
                                <TableCell className="text-right text-red-500">
                                  {item.item_specific_discount > 0
                                    ? `-${formatCurrency(item.item_specific_discount)}`
                                    : "—"}
                                </TableCell>
                              )}
                              <TableCell className="text-right font-medium pr-6">
                                {isPaid
                                  ? formatCurrency(itemTotal)
                                  : isSelected
                                    ? formatCurrency(itemTotal)
                                    : formatCurrency(
                                        (item.price_tax_inclusive -
                                          unitDiscount) *
                                          totalQty,
                                      )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile List */}
                  <div className="sm:hidden divide-y">
                    {/* Select all */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                        disabled={unpaidItems.length === 0}
                        aria-label="Select all items"
                      />
                      <span className="text-xs text-muted-foreground font-medium">
                        Select All
                      </span>
                    </div>
                    {displayRows.map(({ item, totalQty, payers }) => {
                      const isSelected = selectedQtys.has(item.id);
                      const isPaid = !!item.paid_by_name;
                      const unitDiscount =
                        (item.item_specific_discount || 0) /
                        (item.quantity || 1);
                      const selectedQty = selectedQtys.get(item.id) || 0;
                      const itemTotal = isPaid
                        ? (item.price_tax_inclusive - unitDiscount) * totalQty
                        : isSelected
                          ? (item.price_tax_inclusive - unitDiscount) *
                            selectedQty
                          : (item.price_tax_inclusive - unitDiscount) *
                            totalQty;

                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            if (
                              !(e.target as HTMLElement).closest(
                                "button, input",
                              )
                            )
                              toggleItem(item.id);
                          }}
                          className={`px-4 py-3 space-y-2 ${isPaid ? "" : "cursor-pointer"} ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(item.id)}
                              disabled={isPaid}
                              className="mt-0.5"
                              aria-label={`Select ${item.description}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm truncate">
                                  {item.description}
                                </span>
                                <span className="font-medium text-sm shrink-0">
                                  {formatCurrency(itemTotal)}
                                </span>
                              </div>
                              {/* Second line: qty controls + paid avatar */}
                              <div className="flex items-center justify-between mt-1.5">
                                {isSelected ? (
                                  <div className="inline-flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setItemQty(item.id, selectedQty - 1)
                                      }
                                      disabled={selectedQty <= 1}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.quantity}
                                      value={selectedQty}
                                      onChange={(e) =>
                                        setItemQty(
                                          item.id,
                                          parseInt(e.target.value) || 1,
                                        )
                                      }
                                      className="h-6 w-10 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setItemQty(item.id, selectedQty + 1)
                                      }
                                      disabled={selectedQty >= item.quantity}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Qty: {totalQty} ×{" "}
                                    {formatCurrency(item.price_tax_inclusive)}
                                  </span>
                                )}
                                {payers.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {payers.map((p) => (
                                      <PayerAvatar
                                        key={p}
                                        name={p}
                                        size="h-5 w-5"
                                        className="text-[9px] bg-emerald-100 text-emerald-700"
                                        initials={getInitials(p)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected total + Pay button */}
                  {selectedQtys.size > 0 && (
                    <div className="flex items-center justify-between border-t px-6 py-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {selectedQtys.size} item
                          {selectedQtys.size !== 1 ? "s" : ""} selected
                        </p>
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(selectedTotal)}
                        </p>
                      </div>
                      <Dialog
                        open={showPayDialog}
                        onOpenChange={setShowPayDialog}
                      >
                        <DialogTrigger asChild>
                          <Button className="gap-2">
                            <CreditCard className="h-4 w-4" />
                            Pay {formatCurrency(selectedTotal)}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <div className="space-y-5">
                            <div className="text-center">
                              <h3 className="text-lg font-semibold">
                                Payments
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Pay{" "}
                                <span className="font-semibold text-emerald-600">
                                  {formatCurrency(selectedTotal)}
                                </span>{" "}
                                for {selectedQtys.size} item
                                {selectedQtys.size !== 1 ? "s" : ""}
                              </p>
                            </div>

                            {/* Selected items summary */}
                            <div className="rounded-lg border p-3 space-y-2">
                              {expandedItems
                                .filter((item) => selectedQtys.has(item.id))
                                .map((item) => {
                                  const qty =
                                    selectedQtys.get(item.id) || item.quantity;
                                  const unitDiscount =
                                    (item.item_specific_discount || 0) /
                                    (item.quantity || 1);
                                  const lineTotal =
                                    (item.price_tax_inclusive - unitDiscount) *
                                    qty;
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex justify-between text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {item.description}
                                        {qty < item.quantity && (
                                          <span className="ml-1 text-xs">
                                            ×{qty}
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-medium">
                                        {formatCurrency(lineTotal)}
                                      </span>
                                    </div>
                                  );
                                })}
                              <Separator />
                              <div className="flex justify-between text-sm font-semibold">
                                <span>Total</span>
                                <span className="text-emerald-600">
                                  {formatCurrency(selectedTotal)}
                                </span>
                              </div>
                            </div>

                            {paymentMethod ? (
                              <div className="space-y-4">
                                {/* QR Code */}
                                {(paymentMethod.qr_data ||
                                  paymentMethod.qr_image_url) && (
                                  <div className="flex justify-center">
                                    <div className="flex flex-col items-center">
                                      <div
                                        className="rounded-t-lg border-[10px] border-b-[1px]"
                                        style={{
                                          borderColor: "rgb(237, 46, 103)",
                                          backgroundColor: "rgb(237, 46, 103)",
                                          maxWidth: "240px",
                                        }}
                                      >
                                        <div className="rounded-lg bg-white p-[15px]">
                                          {paymentMethod.qr_data ? (
                                            <QRCodeSVG
                                              value={paymentMethod.qr_data}
                                              size={180}
                                            />
                                          ) : (
                                            <img
                                              src={paymentMethod.qr_image_url!}
                                              alt="Payment QR Code"
                                              className="max-w-full h-auto object-contain"
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <div
                                        className="rounded-b-lg py-3 w-full"
                                        style={{
                                          backgroundColor: "rgb(237, 46, 103)",
                                          maxWidth: "260px",
                                        }}
                                      >
                                        <p
                                          className="text-white text-[15px] font-bold text-center m-0"
                                          style={{
                                            fontFamily:
                                              "'Gotham Rounded', sans-serif",
                                          }}
                                        >
                                          MALAYSIA NATIONAL QR
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {paymentMethod.account_name && (
                                  <p className="text-center text-sm text-muted-foreground">
                                    {paymentMethod.account_name}
                                  </p>
                                )}

                                {/* Payment info — bank & account side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-lg border p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                      Bank
                                    </p>
                                    <p className="text-sm font-medium truncate">
                                      {paymentMethod.bank_name}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                      {paymentMethod.payment_type ===
                                      "phone_number"
                                        ? "Phone"
                                        : "Account No."}
                                    </p>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1.5 text-sm font-medium font-mono hover:text-primary transition-colors group/copy"
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          paymentMethod.payment_value,
                                        );
                                        setCopied(true);
                                        if (copyTimeoutRef.current)
                                          clearTimeout(copyTimeoutRef.current);
                                        copyTimeoutRef.current = setTimeout(
                                          () => setCopied(false),
                                          2000,
                                        );
                                      }}
                                    >
                                      {paymentMethod.payment_value}
                                      {copied ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                                      )}
                                    </button>
                                    {copied && (
                                      <p className="text-[10px] text-emerald-500 mt-0.5">
                                        Copied!
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 text-center">
                                <QrCode className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  No payment method available
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                  Contact the receipt owner for payment details
                                </p>
                              </div>
                            )}

                            {/* Already paid section */}
                            <Separator />
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground text-center">
                                Already transferred?
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Your name"
                                  value={paidByName}
                                  readOnly={nameLocked}
                                  className={
                                    nameLocked
                                      ? "bg-muted cursor-not-allowed"
                                      : undefined
                                  }
                                  onChange={(e) =>
                                    setPaidByName(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && paidByName.trim())
                                      handleMarkAsPaid();
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  className="gap-1.5 shrink-0"
                                  disabled={!paidByName.trim() || markingPaid}
                                  onClick={handleMarkAsPaid}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Yes
                                </Button>
                              </div>
                            </div>
                            <p
                              role="note"
                              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                            >
                              {paymentMethod?.account_name
                                ? `Always verify the bank account name (${paymentMethod.account_name}) before sending money.`
                                : "Always verify the bank account name with the receipt owner before sending money."}
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                  <Receipt className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No itemized data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Totals Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Item Discounts
                    </span>
                    <span className="text-red-500">
                      -{formatCurrency(totalItemDiscounts)}
                    </span>
                  </div>
                )}

                {receipt.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Header Discount
                    </span>
                    <span className="text-red-500">
                      -{formatCurrency(receipt.discount_amount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({receipt.tax_percentage}%)
                    {receipt.prices_include_tax ? " (included)" : ""}
                  </span>
                  <span>{formatCurrency(receipt.tax_amount)}</span>
                </div>

                {receipt.rounding_adjustment !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Rounding Adjustment
                    </span>
                    <span>
                      {receipt.rounding_adjustment > 0 ? "+" : ""}
                      {formatCurrency(receipt.rounding_adjustment)}
                    </span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center pt-1">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {formatCurrency(receipt.price_amount)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Do any of these calculations look wrong?
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={REPORT_ISSUE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Flag className="mr-2 h-3.5 w-3.5" />
                    Report issue
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
