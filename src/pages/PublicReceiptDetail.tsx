import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
  Share2,
} from "lucide-react";

import { pb } from "../pocketbase";

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
  image_url: string | null;
  created_at: string;
  user_id: string;
  payment_method_id: string | null;
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

export default function PublicReceiptDetail() {
  const { id } = useParams<{ id: string }>();
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
  const [paidByName, setPaidByName] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const fetchReceipt = useCallback(async () => {
    if (!id) return;
    try {
      const data = await pb.collection("receipts").getOne(id);

      // Fetch items
      const items = await pb.collection("items").getFullList({
        filter: `receipt_id = "${id}"`,
      });

      const receiptData: ReceiptData = {
        id: data.id,
        merchant_name: data.merchant_name,
        currency: data.currency,
        price_amount: data.price_amount,
        tax_amount: data.tax_amount,
        tax_percentage: data.tax_percentage,
        discount_amount: data.discount_amount,
        rounding_adjustment: data.rounding_adjustment,
        image_url: data.image ? pb.files.getURL(data, data.image) : null,
        created_at: data.created,
        user_id: data.user_id,
        payment_method_id: data.payment_method_id || null,
        items: items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          price_tax_inclusive: item.price_tax_inclusive,
          item_specific_discount: item.item_specific_discount,
          paid_by: item.paid_by || null,
          paid_by_name: item.paid_by_name || null,
        })),
      };

      setReceipt(receiptData);

      // Fetch payment methods for the receipt owner
      if (data.user_id) {
        try {
          const pmData = await pb.collection("payment_methods").getFullList({
            filter: `user_id = "${data.user_id}"`,
            sort: "-created",
          });

          if (pmData.length > 0) {
            const methods = pmData.map((pm) => ({
              id: pm.id,
              bank_name: pm.bank_name,
              account_name: pm.account_name || null,
              payment_type: pm.payment_type as "bank_account" | "phone_number",
              payment_value: pm.payment_value,
              qr_image_url: pm.qr_image_url || null,
              qr_data: pm.qr_data || null,
            }));
            setPaymentMethod(
              methods.find((method) => method.id === data.payment_method_id) ??
                methods[0],
            );
          }
        } catch {
          // payment methods may not be accessible
        }
      }
    } catch (err: unknown) {
      // Ignore PocketBase auto-cancellation (e.g. from React StrictMode double-effects)
      if (err && typeof err === "object" && "isAbort" in err && err.isAbort)
        return;
      setError("Failed to load receipt.");
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

  const selectedTotal = useMemo(() => {
    if (!receipt?.items) return 0;
    return receipt.items
      .filter((item) => selectedQtys.has(item.id))
      .reduce((sum, item) => {
        const qty = selectedQtys.get(item.id) || 0;
        const unitDiscount =
          (item.item_specific_discount || 0) / (item.quantity || 1);
        return sum + (item.price_tax_inclusive - unitDiscount) * qty;
      }, 0);
  }, [receipt?.items, selectedQtys]);

  const expandedItems = useMemo(() => {
    if (!receipt?.items) return [];
    return receipt.items;
  }, [receipt?.items]);

  const unpaidItems =
    receipt?.items?.filter((item) => !item.paid_by_name) ?? [];
  const allSelected =
    unpaidItems.length > 0 &&
    unpaidItems.every((item) => selectedQtys.has(item.id));
  const someSelected = selectedQtys.size > 0 && !allSelected;

  const handleMarkAsPaid = async () => {
    if (!paidByName.trim() || selectedQtys.size === 0 || !receipt) return;
    setMarkingPaid(true);
    try {
      const ids = Array.from(selectedQtys.keys());
      for (const itemId of ids) {
        await pb.collection("items").update(itemId, {
          paid_by_name: paidByName.trim(),
        });
      }

      // Update local state
      setReceipt({
        ...receipt,
        items: receipt.items.map((item) =>
          ids.includes(item.id)
            ? { ...item, paid_by_name: paidByName.trim() }
            : item,
        ),
      });
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 min-h-screen">
          <Receipt className="h-16 w-16 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold text-muted-foreground">
            {error || "Receipt not found"}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <div className="space-y-4 text-center">
                <h3 className="text-lg font-semibold">Share Receipt</h3>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code or copy the link to share this receipt.
                </p>
                <div className="flex justify-center">
                  <div className="rounded-lg border p-4 bg-white">
                    <QRCodeSVG value={window.location.href} size={180} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={window.location.href}
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      if (copyTimeoutRef.current)
                        clearTimeout(copyTimeoutRef.current);
                      copyTimeoutRef.current = setTimeout(
                        () => setCopied(false),
                        2000,
                      );
                    }}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-500">Link copied!</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
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
                        {expandedItems.map((item) => {
                          const isSelected = selectedQtys.has(item.id);
                          const isPaid = !!item.paid_by_name;
                          const unitDiscount =
                            (item.item_specific_discount || 0) /
                            (item.quantity || 1);
                          const selectedQty = selectedQtys.get(item.id) || 0;
                          const itemTotal = isPaid
                            ? (item.price_tax_inclusive - unitDiscount) *
                              item.quantity
                            : (item.price_tax_inclusive - unitDiscount) *
                              selectedQty;

                          return (
                            <TableRow
                              key={item.id}
                              className={isSelected ? "bg-primary/5" : ""}
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
                                  {isPaid && (
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">
                                        {getInitials(item.paid_by_name!)}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
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
                                    {item.quantity}
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
                                          item.quantity,
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
                    {expandedItems.map((item) => {
                      const isSelected = selectedQtys.has(item.id);
                      const isPaid = !!item.paid_by_name;
                      const unitDiscount =
                        (item.item_specific_discount || 0) /
                        (item.quantity || 1);
                      const selectedQty = selectedQtys.get(item.id) || 0;
                      const itemTotal = isPaid
                        ? (item.price_tax_inclusive - unitDiscount) *
                          item.quantity
                        : isSelected
                          ? (item.price_tax_inclusive - unitDiscount) *
                            selectedQty
                          : (item.price_tax_inclusive - unitDiscount) *
                            item.quantity;

                      return (
                        <div
                          key={item.id}
                          className={`px-4 py-3 space-y-2 ${isSelected ? "bg-primary/5" : ""}`}
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
                                    Qty: {item.quantity} ×{" "}
                                    {formatCurrency(item.price_tax_inclusive)}
                                  </span>
                                )}
                                {isPaid && (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-[9px] bg-emerald-100 text-emerald-700">
                                        {getInitials(item.paid_by_name!)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] text-emerald-700 font-medium">
                                      {item.paid_by_name}
                                    </span>
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
                                Bank Details
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
                              {receipt.items
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
                                  {markingPaid ? "Saving..." : "Mark Paid"}
                                </Button>
                              </div>
                            </div>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
