import { useState, useEffect, useCallback, useRef } from "react";
import {
  Navigate,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { SharedReceiptView } from "@/components/receipt/SharedReceiptView";
import { ShareReceiptDialog } from "@/components/receipt/ShareReceiptDialog";
import {
  ReceiptItemDialog,
  type ReceiptItemInput,
} from "@/components/receipt/ReceiptItemDialog";
import { QRCodeSVG } from "qrcode.react";
import { itemTaxRate, paidAmountPercentage } from "@/lib/receipt-math";
import { TaxDialog, type TaxInput } from "@/components/receipt/TaxDialog";
import {
  getReceiptImage,
  ApiError,
  create,
  read,
  readCollection,
  receiptItemKey,
  receiptKey,
  remove,
  services,
  update,
} from "@/lib/api";

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
  is_default: boolean;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

type ReceiptAccess = { receiptId: string; isOwner: boolean };

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<ReceiptAccess | null>(null);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    let cancelled = false;

    // Team members may read a receipt, but only its owner gets the editing view.
    read<{ owner: string }>(`${receiptKey(id)}?$select=owner`)
      .catch(() => null)
      .then(async (receipt) => {
        const isOwner = receipt?.owner === user.id;
        // Opening a shared receipt link adds it to the viewer's dashboard.
        if (!isOwner) {
          await create(`${services.receipt}/joinReceipt`, { ID: id });
        }
        if (!cancelled) setAccess({ receiptId: id, isOwner });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (
          !(cause instanceof ApiError) ||
          ![403, 404].includes(cause.status)
        ) {
          console.error("Failed to check receipt ownership:", cause);
        }
        setAccess({ receiptId: id, isOwner: false });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, id]);

  if (!id) return <Navigate to="/" replace />;

  const checkingOwnership =
    authLoading || (user !== null && access?.receiptId !== id);

  if (checkingOwnership) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (user && access?.isOwner) return <OwnerReceiptView receiptId={id} />;

  const sharedView = (
    <SharedReceiptView
      receiptId={id}
      viewerName={user?.name ?? ""}
      embedded={!!user}
    />
  );
  if (!user) {
    return (
      <>
        {sharedView}
        {searchParams.get("ref") === "share" && (
          <ShareSignInPrompt receiptId={id} />
        )}
      </>
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
                  <BreadcrumbLink href="/">Receipts</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Shared receipt</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {sharedView}
      </SidebarInset>
    </SidebarProvider>
  );
}

const GUEST_CHOICE_KEY = "splitta:guestReceipts";

function ShareSignInPrompt({ receiptId }: { receiptId: string }) {
  const { signIn } = useAuth();
  const [open, setOpen] = useState(() => {
    const guestReceipts = sessionStorage.getItem(GUEST_CHOICE_KEY)?.split(",");
    return !guestReceipts?.includes(receiptId);
  });
  const [signingIn, setSigningIn] = useState(false);

  const continueAsGuest = () => {
    const guestReceipts = sessionStorage.getItem(GUEST_CHOICE_KEY);
    sessionStorage.setItem(
      GUEST_CHOICE_KEY,
      guestReceipts ? `${guestReceipts},${receiptId}` : receiptId,
    );
    setOpen(false);
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn(`/receipt/${receiptId}`);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && continueAsGuest()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Someone shared a receipt with you</DialogTitle>
          <DialogDescription>
            Sign in to keep track of what you owe, or continue as a guest to
            view and pay for your items.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={continueAsGuest}
            disabled={signingIn}
          >
            Continue as guest
          </Button>
          <Button onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? "Connecting..." : "Sign in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OwnerReceiptView({ receiptId: id }: { receiptId: string }) {
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
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReceiptItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!user || !id) return;
    try {
      const data = await read<{
        ID: string;
        merchantName: string;
        currency: string;
        priceAmount: number;
        taxAmount: number;
        taxPercentage: number;
        discountAmount: number;
        roundingAdjustment: number;
        pricesIncludeTax?: boolean | null;
        createdAt: string;
        paymentMethod_ID?: string | null;
        items: {
          ID: string;
          description: string;
          quantity: number;
          priceTaxInclusive: number;
          itemSpecificDiscount: number;
          paidBy?: string | null;
          paidByName?: string | null;
        }[];
      }>(
        `${receiptKey(id)}?$expand=items($select=ID,description,quantity,priceTaxInclusive,itemSpecificDiscount,paidBy,paidByName)`,
      );
      const imageUrl = await getReceiptImage(id).catch((imageError) => {
        console.error("Failed to load receipt image:", imageError);
        return null;
      });
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
        image_url: imageUrl,
        created_at: data.createdAt,
        payment_method_id: data.paymentMethod_ID || null,
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

      try {
        const profilesData = await readCollection<{
          ID: string;
          displayName?: string | null;
        }>(`${services.directory}/Profiles?$orderby=displayName`);
        setProfiles(
          profilesData.map((p) => ({
            id: p.ID,
            display_name: p.displayName || null,
            email: null,
          })),
        );
      } catch (directoryError) {
        console.error("Failed to load user directory:", directoryError);
      }

      try {
        const pmData = await readCollection<{
          ID: string;
          bankName: string;
          accountName?: string | null;
          paymentType: PaymentMethod["payment_type"];
          paymentValue: string;
          qrData?: string | null;
          isDefault?: boolean | null;
        }>(`${services.receipt}/PaymentMethods?$orderby=createdAt desc`);
        if (pmData.length > 0) {
          const methods = pmData.map((pm) => ({
            id: pm.ID,
            bank_name: pm.bankName,
            account_name: pm.accountName || null,
            payment_type: pm.paymentType,
            payment_value: pm.paymentValue,
            qr_image_url: null,
            qr_data: pm.qrData || null,
            is_default: pm.isDefault === true,
          }));
          setAllPaymentMethods(methods);
          setPaymentMethod(
            methods.find((method) => method.id === data.paymentMethod_ID) ??
              methods.find((method) => method.is_default) ??
              methods[0],
          );
        } else {
          setAllPaymentMethods([]);
          setPaymentMethod(null);
        }
      } catch (error) {
        console.error("Failed to load receipt payment methods:", error);
        setAllPaymentMethods([]);
        setPaymentMethod(null);
      }
    } catch (err: unknown) {
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
      await update(receiptItemKey(itemId), {
        paidBy: null,
        paidByName: null,
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

  // Marks paidQty of an item as paid by the signed-in owner, splitting the line when
  // only part of the quantity was paid. Returns the updated item list.
  const applyPaidQuantity = async (
    items: ReceiptItem[],
    item: ReceiptItem,
    paidQty: number,
  ): Promise<ReceiptItem[]> => {
    if (!receipt || !user) return items;
    const paidByName = user.name.trim().slice(0, 120) || user.id.slice(0, 120);
    const paid = { paidBy: user.id, paidByName };

    if (paidQty === item.quantity) {
      await update(receiptItemKey(item.id), paid);
      return items.map((existing) =>
        existing.id === item.id
          ? { ...existing, paid_by: user.id, paid_by_name: paidByName }
          : existing,
      );
    }

    // Split the line: the paid quantity becomes its own item and the rest stays unassigned.
    const paidDiscount = Number(
      (((item.item_specific_discount || 0) / item.quantity) * paidQty).toFixed(
        2,
      ),
    );
    const remainingQty = Number((item.quantity - paidQty).toFixed(3));
    const remainingDiscount = Number(
      ((item.item_specific_discount || 0) - paidDiscount).toFixed(2),
    );

    const created = await create<{ ID: string }>(
      `${services.receipt}/ReceiptItems`,
      {
        receipt_ID: receipt.id,
        description: item.description,
        quantity: paidQty,
        priceTaxInclusive: item.price_tax_inclusive,
        itemSpecificDiscount: paidDiscount,
        ...paid,
      },
    );
    try {
      await update(receiptItemKey(item.id), {
        quantity: remainingQty,
        itemSpecificDiscount: remainingDiscount,
      });
    } catch (splitError) {
      await remove(receiptItemKey(created.ID)).catch(() => undefined);
      throw splitError;
    }

    return items.flatMap((existing) =>
      existing.id === item.id
        ? [
            {
              ...existing,
              quantity: remainingQty,
              item_specific_discount: remainingDiscount,
            },
            {
              id: created.ID,
              description: item.description,
              quantity: paidQty,
              price_tax_inclusive: item.price_tax_inclusive,
              item_specific_discount: paidDiscount,
              paid_by: user.id,
              paid_by_name: paidByName,
            },
          ]
        : [existing],
    );
  };

  const openItemDialog = (item: ReceiptItem | null) => {
    setEditingItem(item);
    setItemError(null);
    setItemDialogOpen(true);
  };

  const handleSaveItem = async (input: ReceiptItemInput) => {
    if (!receipt) return;
    const { paid_quantity: paidQuantity, ...fields } = input;
    const payload = {
      description: fields.description,
      quantity: fields.quantity,
      priceTaxInclusive: fields.price_tax_inclusive,
      itemSpecificDiscount: fields.item_specific_discount,
    };

    let items: ReceiptItem[];
    let saved: ReceiptItem;
    if (editingItem) {
      await update(receiptItemKey(editingItem.id), payload);
      saved = { ...editingItem, ...fields };
      items = receipt.items.map((item) =>
        item.id === editingItem.id ? saved : item,
      );
    } else {
      const created = await create<{ ID: string }>(
        `${services.receipt}/ReceiptItems`,
        { ...payload, receipt_ID: receipt.id },
      );
      saved = { ...fields, id: created.ID, paid_by: null, paid_by_name: null };
      items = [...receipt.items, saved];
    }
    setReceipt({ ...receipt, items });

    if (paidQuantity && paidQuantity > 0) {
      try {
        setReceipt({
          ...receipt,
          items: await applyPaidQuantity(items, saved, paidQuantity),
        });
      } catch (paidError) {
        console.error("Failed to mark item as paid:", paidError);
        throw new Error(
          "The item was saved, but marking it as paid failed. Try again with I paid.",
        );
      }
    }
  };

  const handleDeleteItem = async (item: ReceiptItem) => {
    if (!receipt) return;
    const warning = item.paid_by_name
      ? `"${item.description}" is already marked as paid by ${item.paid_by_name}. Remove it anyway?`
      : `Remove "${item.description}" from this receipt?`;
    if (!window.confirm(warning)) return;

    setDeletingItemId(item.id);
    setItemError(null);
    try {
      await remove(receiptItemKey(item.id));
      setReceipt({
        ...receipt,
        items: receipt.items.filter((existing) => existing.id !== item.id),
      });
    } catch (deleteError) {
      console.error("Failed to remove receipt item:", deleteError);
      setItemError("Failed to remove item. Please try again.");
    } finally {
      setDeletingItemId(null);
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
      await update(receiptKey(id), { paymentMethod_ID: methodId });
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

  const percentPaid = paidAmountPercentage(receipt?.items ?? []);

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

  const itemsNetTotal =
    subtotal -
    totalItemDiscounts +
    (receipt && !receipt.prices_include_tax ? receipt.tax_amount || 0 : 0) -
    (receipt?.discount_amount || 0) +
    (receipt?.rounding_adjustment || 0);

  const handleSaveTax = async ({ tax_percentage, tax_amount }: TaxInput) => {
    if (!receipt) return;
    // When tax sits on top of the items, the payable total moves with it.
    const price_amount = receipt.prices_include_tax
      ? receipt.price_amount
      : Number(
          (receipt.price_amount + tax_amount - receipt.tax_amount).toFixed(2),
        );
    await update(receiptKey(receipt.id), {
      taxPercentage: tax_percentage,
      taxAmount: tax_amount,
      priceAmount: price_amount,
    });
    setReceipt({ ...receipt, tax_percentage, tax_amount, price_amount });
  };

  const handleTogglePricesIncludeTax = async (pricesIncludeTax: boolean) => {
    if (!receipt) return;
    const previous = receipt.prices_include_tax;
    setReceipt({ ...receipt, prices_include_tax: pricesIncludeTax });
    try {
      await update(receiptKey(receipt.id), { pricesIncludeTax });
    } catch (toggleError) {
      console.error("Failed to update tax setting:", toggleError);
      setReceipt((current) =>
        current ? { ...current, prices_include_tax: previous } : current,
      );
      setItemError("Failed to update the tax setting. Please try again.");
    }
  };

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
            <Button variant="outline" onClick={() => navigate("/")}>
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
                  <BreadcrumbLink href="/">Receipts</BreadcrumbLink>
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
              onClick={() => navigate("/")}
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
            <ShareReceiptDialog receiptId={id} />
            <Badge
              variant="outline"
              className={
                percentPaid === 100
                  ? "text-emerald-500 border-emerald-200 bg-emerald-50 font-normal"
                  : "text-muted-foreground border-border bg-transparent font-normal"
              }
            >
              {percentPaid}% paid
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

            {/* Payments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Payments
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/payments")}
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
                    <p className="text-sm font-medium">
                      No payment methods added
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Add a bank account or e-wallet so shared receipt viewers
                      know how to pay you.
                    </p>
                    <Button onClick={() => navigate("/payments")}>
                      <Wallet className="mr-2 h-4 w-4" />
                      Add Payment Method
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {receipt.items?.length || 0} item
                      {(receipt.items?.length || 0) !== 1 ? "s" : ""}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openItemDialog(null)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add item
                    </Button>
                  </div>
                </div>
                {receipt.tax_amount > 0 && (
                  <label className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-primary"
                      checked={!receipt.prices_include_tax}
                      onChange={(event) =>
                        handleTogglePricesIncludeTax(!event.target.checked)
                      }
                    />
                    <span>
                      Item prices exclude tax — share the{" "}
                      {formatCurrency(receipt.tax_amount)} tax across items by
                      their amount
                    </span>
                  </label>
                )}
                {itemError && (
                  <p className="pt-2 text-sm text-destructive">{itemError}</p>
                )}
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
                          {taxRate > 0 && (
                            <TableHead className="text-right">
                              Incl. tax
                            </TableHead>
                          )}
                          <TableHead className="min-w-[140px]">
                            Paid By
                          </TableHead>
                          <TableHead className="w-[88px] pr-6">
                            <span className="sr-only">Actions</span>
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
                            {taxRate > 0 && (
                              <TableCell className="text-right font-medium">
                                {formatCurrency(
                                  (item.price_tax_inclusive -
                                    (item.item_specific_discount || 0) /
                                      (item.quantity || 1)) *
                                    (1 + taxRate),
                                )}
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
                                    <div className="flex items-center gap-1">
                                      <Avatar className="h-7 w-7" title={name}>
                                        <AvatarFallback className="bg-emerald-100 text-[10px] font-medium text-emerald-700">
                                          {getInitials(name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="sr-only">
                                        Paid by {name}
                                      </span>
                                      <button
                                        type="button"
                                        className="h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                        onClick={() => handleClearPaid(item.id)}
                                        disabled={savingItemPaidBy === item.id}
                                      >
                                        <X className="h-3 w-3" />
                                        <span className="sr-only">
                                          Clear paid by {name}
                                        </span>
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
                            <TableCell className="pr-6">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openItemDialog(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span className="sr-only">
                                    Edit {item.description}
                                  </span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  disabled={deletingItemId === item.id}
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">
                                    Remove {item.description}
                                  </span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                    <Receipt className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No itemized data available
                    </p>
                    <Button size="sm" onClick={() => openItemDialog(null)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add item
                    </Button>
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
                      {receipt.prices_include_tax ? " (included)" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setTaxDialogOpen(true)}
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="sr-only">Edit tax</span>
                      </Button>
                      {formatCurrency(receipt.tax_amount)}
                    </span>
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

                  {Math.abs(itemsNetTotal - receipt.price_amount) >= 0.01 && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Items add up to {formatCurrency(itemsNetTotal)}, which
                      differs from the receipt total. Check the itemized
                      breakdown above.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <TaxDialog
            open={taxDialogOpen}
            currency={receipt.currency || "MYR"}
            taxPercentage={receipt.tax_percentage}
            taxAmount={receipt.tax_amount}
            taxableAmount={
              subtotal - totalItemDiscounts - (receipt.discount_amount || 0)
            }
            pricesIncludeTax={receipt.prices_include_tax}
            onOpenChange={setTaxDialogOpen}
            onSave={handleSaveTax}
          />
          <ReceiptItemDialog
            open={itemDialogOpen}
            item={editingItem}
            canMarkPaid={!editingItem?.paid_by_name}
            currency={receipt.currency || "MYR"}
            onOpenChange={setItemDialogOpen}
            onSave={handleSaveItem}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
