import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import {
  ArrowLeft,
  Calendar,
  Store,
  Receipt,
  ImageIcon,
  QrCode,
  Building2,
  Phone,
  Wallet,
  Copy,
  Check,
  X,
  CheckCircle2,
  Pencil,
} from "lucide-react";

import { pb } from "../pocketbase";
import { useAuth } from "../contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";

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

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [allPaymentMethods, setAllPaymentMethods] = useState<PaymentMethod[]>(
    [],
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savingItemPaidBy, setSavingItemPaidBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!user || !id) return;
    try {
      const data = await pb.collection("receipts").getOne(id);

      // Verify access: user owns the receipt
      if (data.user_id !== user.id) {
        setError("Receipt not found.");
        return;
      }

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

      // Fetch all profiles for the paid_by selector
      try {
        const profilesData = await pb.collection("profiles").getFullList({
          sort: "display_name",
        });
        setProfiles(
          profilesData.map((p) => ({
            id: p.id,
            display_name: p.display_name || null,
            email: p.email || null,
          })),
        );
      } catch {
        // profiles collection may not exist yet
      }

      // Fetch payment methods for the current user
      try {
        const pmData = await pb.collection("payment_methods").getFullList({
          filter: `user_id = "${user.id}"`,
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
          setAllPaymentMethods(methods);
          setPaymentMethod(
            methods.find((method) => method.id === data.payment_method_id) ??
              methods[0],
          );
        } else {
          setAllPaymentMethods([]);
          setPaymentMethod(null);
        }
      } catch {
        setAllPaymentMethods([]);
        setPaymentMethod(null);
      }
    } catch (err: unknown) {
      // Ignore PocketBase auto-cancellation (e.g. from React StrictMode double-effects)
      if (err && typeof err === "object" && "isAbort" in err && err.isAbort)
        return;
      console.error("Failed to load receipt:", err);
      setError("Failed to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handleClearPaid = async (itemId: string) => {
    if (!receipt) return;
    setSavingItemPaidBy(itemId);
    try {
      await pb.collection("items").update(itemId, {
        paid_by: null,
        paid_by_name: null,
      });

      setReceipt({
        ...receipt,
        items: receipt.items.map((item) =>
          item.id === itemId
            ? { ...item, paid_by: null, paid_by_name: null }
            : item,
        ),
      });
    } catch (err) {
      console.error("Failed to clear item paid status:", err);
    } finally {
      setSavingItemPaidBy(null);
    }
  };

  const handleSelectPaymentMethod = async (methodId: string) => {
    if (!user || !id) return;

    const selected = allPaymentMethods.find((method) => method.id === methodId);
    if (!selected) return;

    setPaymentMethod(selected);
    if (receipt) {
      setReceipt({ ...receipt, payment_method_id: methodId });
    }

    try {
      await pb.collection("receipts").update(id, {
        payment_method_id: methodId,
      });
    } catch (updateError) {
      console.error("Failed to update receipt payment method:", updateError);
      fetchReceipt();
    }
  };

  const handleCopyPaymentValue = () => {
    if (!paymentMethod) return;

    navigator.clipboard.writeText(paymentMethod.payment_value);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    return `${receipt?.currency || "MYR"} ${amount.toFixed(2)}`;
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

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Skeleton className="h-4 w-48" />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-[400px]" />
              <div className="space-y-4">
                <Skeleton className="h-[200px]" />
                <Skeleton className="h-[180px]" />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error || !receipt) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Receipt Not Found</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <Receipt className="h-16 w-16 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold text-muted-foreground">
              {error || "Receipt not found"}
            </h2>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Receipts
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">Receipts</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{receipt.merchant_name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {receipt.merchant_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Receipt ID: {receipt.id.substring(0, 8)}...
                {receipt.id.substring(receipt.id.length - 4)}
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-emerald-500 border-emerald-200 bg-emerald-50 font-normal"
            >
              Processed
            </Badge>
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

            {/* Bank Details */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Bank Details
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/payment-details")}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {paymentMethod ? (
                  <div className="space-y-4">
                    {allPaymentMethods.length > 1 && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="receipt-payment-method"
                          className="text-xs text-muted-foreground"
                        >
                          Payment method for this receipt
                        </label>
                        <select
                          id="receipt-payment-method"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          value={paymentMethod.id}
                          onChange={(event) =>
                            handleSelectPaymentMethod(event.target.value)
                          }
                        >
                          {allPaymentMethods.map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.bank_name}
                              {method.account_name
                                ? ` — ${method.account_name}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Bank / Wallet
                        </p>
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {paymentMethod.payment_type === "bank_account" ? (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {paymentMethod.bank_name}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Account Name
                        </p>
                        <p className="text-sm font-medium truncate">
                          {paymentMethod.account_name || "Not set"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          {paymentMethod.payment_type === "phone_number"
                            ? "Phone"
                            : "Account No."}
                        </p>
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium font-mono hover:text-primary transition-colors group/copy"
                          onClick={handleCopyPaymentValue}
                        >
                          <span className="truncate">
                            {paymentMethod.payment_value}
                          </span>
                          {copied ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </div>
                    </div>

                    {(paymentMethod.qr_data || paymentMethod.qr_image_url) && (
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="h-16 w-16 shrink-0 rounded border overflow-hidden bg-white p-1">
                          {paymentMethod.qr_data ? (
                            <QRCodeSVG
                              value={paymentMethod.qr_data}
                              size={56}
                            />
                          ) : (
                            <img
                              src={paymentMethod.qr_image_url!}
                              alt="Payment QR Code"
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            QR code available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This QR code is shown for this receipt.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <QrCode className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium">No bank details added</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Add a bank account or e-wallet so shared receipt viewers
                      know how to pay you.
                    </p>
                    <Button onClick={() => navigate("/payment-details")}>
                      <Wallet className="mr-2 h-4 w-4" />
                      Add Bank Details
                    </Button>
                  </div>
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
                    {receipt.items?.length || 0} item
                    {(receipt.items?.length || 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {receipt.items && receipt.items.length > 0 ? (
                  <div className="rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right pr-6">
                            Price
                          </TableHead>
                          {totalItemDiscounts > 0 && (
                            <TableHead className="text-right">
                              Discount
                            </TableHead>
                          )}
                          <TableHead className="min-w-[140px]">
                            Paid By
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receipt.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="pl-6 font-medium">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right font-medium pr-6">
                              {formatCurrency(item.price_tax_inclusive)}
                            </TableCell>
                            {totalItemDiscounts > 0 && (
                              <TableCell className="text-right text-red-500">
                                {item.item_specific_discount > 0
                                  ? `-${formatCurrency(item.item_specific_discount)}`
                                  : "—"}
                              </TableCell>
                            )}
                            <TableCell>
                              {(() => {
                                const name =
                                  item.paid_by_name ||
                                  (item.paid_by
                                    ? profiles.find(
                                        (p) => p.id === item.paid_by,
                                      )?.display_name ||
                                      profiles.find(
                                        (p) => p.id === item.paid_by,
                                      )?.email ||
                                      "Assigned User"
                                    : null);

                                if (name) {
                                  return (
                                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-md text-xs border border-emerald-100 max-w-[150px]">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                        <span className="font-medium truncate">
                                          {name}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className="ml-2 h-4 w-4 shrink-0 rounded-full hover:bg-emerald-200/50 flex items-center justify-center text-emerald-700/60 hover:text-emerald-800 transition-colors"
                                        onClick={() => handleClearPaid(item.id)}
                                        disabled={savingItemPaidBy === item.id}
                                      >
                                        <X className="h-3 w-3" />
                                        <span className="sr-only">Clear</span>
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <span className="text-muted-foreground text-sm flex items-center h-7 px-2">
                                    N/A
                                  </span>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                      <span className="text-muted-foreground">Discount</span>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
