import { useState, useEffect, useRef, useCallback } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Plus,
  Pencil,
  Trash2,
  Camera,
  Wallet,
  Phone,
  Building2,
  Check,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { BANK_OPTIONS } from "@/lib/banks";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import {
  create,
  paymentMethodKey,
  readCollection,
  remove,
  services,
  update,
} from "@/lib/api";

interface PaymentMethod {
  id: string;
  bank_name: string;
  account_name: string | null;
  payment_type: "bank_account" | "phone_number";
  payment_value: string;
  qr_data: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function PaymentDetails() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [savingDefaultId, setSavingDefaultId] = useState<string | null>(null);

  // Form state
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [paymentValue, setPaymentValue] = useState("");
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrDecodeError, setQrDecodeError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanFrameRef = useRef<number>(0);
  const scanningRef = useRef(false);

  const fetchMethods = useCallback(async () => {
    if (!user) return;
    try {
      const data = await readCollection<{
        ID: string;
        bankName: string;
        accountName?: string | null;
        paymentType: PaymentMethod["payment_type"];
        paymentValue: string;
        qrData?: string | null;
        isDefault?: boolean | null;
        createdAt: string;
        modifiedAt: string;
      }>(`${services.receipt}/PaymentMethods?$orderby=createdAt desc`);
      setMethods(
        data.map((method) => ({
          id: method.ID,
          bank_name: method.bankName,
          account_name: method.accountName ?? null,
          payment_type: method.paymentType,
          payment_value: method.paymentValue,
          qr_data: method.qrData ?? null,
          is_default: method.isDefault === true,
          created_at: method.createdAt,
          updated_at: method.modifiedAt,
        })),
      );
    } catch (err) {
      console.error("Failed to fetch payment methods:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchMethods();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchMethods]);

  const stopCamera = (stream?: MediaStream | null) => {
    scanningRef.current = false;
    cancelAnimationFrame(scanFrameRef.current);
    const s = stream ?? cameraStream;
    if (s) s.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setCameraActive(false);
  };

  const startScanLoop = (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    scanningRef.current = true;
    const canvas = document.createElement("canvas");
    const tick = () => {
      if (!scanningRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const ox = (video.videoWidth - size) / 2;
          const oy = (video.videoHeight - size) / 2;
          ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            scanningRef.current = false;
            setQrPreview(code.data);
            setQrDecodeError(null);
            stream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
            setCameraActive(false);
            return;
          }
        }
      }
      scanFrameRef.current = requestAnimationFrame(tick);
    };
    scanFrameRef.current = requestAnimationFrame(tick);
  };

  const startCamera = async () => {
    setQrDecodeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);
      setCameraActive(true);
      // kick off scan loop after video element mounts
      setTimeout(() => startScanLoop(stream), 100);
    } catch {
      setQrDecodeError("Could not access camera. Please check permissions.");
    }
  };

  const resetForm = () => {
    setBankName("");
    setAccountName("");
    setPaymentValue("");
    setQrPreview(null);
    setQrDecodeError(null);
    setEditingMethod(null);
    stopCamera(cameraStream ?? undefined);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (method: PaymentMethod) => {
    setEditingMethod(method);
    setBankName(method.bank_name);
    setAccountName(method.account_name || "");
    setPaymentValue(method.payment_value);
    setQrPreview(method.qr_data);
    setQrDecodeError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !BANK_OPTIONS.includes(bankName)) return;
    setSaving(true);

    const qrData: string | null = qrPreview ?? null;

    if (editingMethod) {
      await update(paymentMethodKey(editingMethod.id), {
        bankName,
        accountName: accountName || null,
        paymentType: "bank_account",
        paymentValue,
        qrData,
      });
    } else {
      await create(`${services.receipt}/PaymentMethods`, {
        bankName,
        accountName: accountName || null,
        paymentType: "bank_account",
        paymentValue,
        qrData,
      });
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchMethods();
  };

  const handleDelete = async (methodId: string) => {
    const deletingMethod = methods.find((method) => method.id === methodId);
    const replacementDefault = methods.find((method) => method.id !== methodId);
    try {
      if (deletingMethod?.is_default && replacementDefault) {
        await update(paymentMethodKey(replacementDefault.id), {
          isDefault: true,
        });
      }
      await remove(paymentMethodKey(methodId));
    } catch (error) {
      console.error("Failed to delete payment method:", error);
      window.alert("Couldn't delete the payment method. Please try again.");
    } finally {
      fetchMethods();
    }
  };

  const handleSetDefault = async (methodId: string) => {
    const previousMethods = methods;
    setSavingDefaultId(methodId);
    setMethods((currentMethods) =>
      currentMethods.map((method) => ({
        ...method,
        is_default: method.id === methodId,
      })),
    );

    try {
      await update(paymentMethodKey(methodId), { isDefault: true });
    } catch (error) {
      console.error("Failed to set default payment method:", error);
      setMethods(previousMethods);
      window.alert("Couldn't save the default payment method. Try again.");
    } finally {
      setSavingDefaultId(null);
    }
  };

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
                  <BreadcrumbPage>Payments</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your bank accounts and payment methods for receipt
                splitting.
              </p>
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4" /> Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingMethod
                      ? "Edit Payment Method"
                      : "Add Payment Method"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingMethod
                      ? "Update your payment method details below."
                      : "Add a new payment method for receipt splitting."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Select
                        value={
                          BANK_OPTIONS.includes(bankName) ? bankName : undefined
                        }
                        onValueChange={setBankName}
                        required
                      >
                        <SelectTrigger id="bankName">
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {BANK_OPTIONS.map((bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        placeholder="e.g. John Doe"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="paymentValue">Account Number</Label>
                      <Input
                        id="paymentValue"
                        placeholder="e.g. 1234567890"
                        inputMode="numeric"
                        value={paymentValue}
                        onChange={(e) => setPaymentValue(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>QR Code (Optional)</Label>
                      {cameraActive ? (
                        <div className="space-y-2">
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                              Scanning…
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => stopCamera()}
                            className="w-full"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex items-center justify-center h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 cursor-pointer hover:border-muted-foreground/50 transition-colors overflow-hidden"
                          >
                            {qrPreview ? (
                              <QRCodeSVG value={qrPreview} size={88} />
                            ) : (
                              <Camera className="h-6 w-6 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Scan your DuitNow / TNG eWallet QR code
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              The QR data will be extracted and stored as text
                            </p>
                          </div>
                        </div>
                      )}
                      {qrDecodeError && (
                        <p className="text-xs text-destructive">
                          {qrDecodeError}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={saving || !BANK_OPTIONS.includes(bankName)}
                    >
                      {saving ? "Saving..." : editingMethod ? "Update" : "Add"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center p-10 text-muted-foreground animate-pulse">
              Loading payment methods...
            </div>
          ) : methods.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16 gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  No Payment Methods
                </p>
                <p className="text-sm mt-1">
                  Add your bank account or e-wallet details so others can pay
                  you back easily.
                </p>
              </div>
              <Button variant="outline" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" /> Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Wallet</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>QR</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-semibold">
                        {method.bank_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {method.account_name ?? (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={method.is_default ? "secondary" : "outline"}
                          size="sm"
                          disabled={method.is_default || savingDefaultId !== null}
                          onClick={() => handleSetDefault(method.id)}
                        >
                          {method.is_default ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Default
                            </>
                          ) : savingDefaultId === method.id ? (
                            "Saving..."
                          ) : (
                            "Set as default"
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {method.payment_type === "bank_account" ? (
                            <>
                              <Building2 className="h-3.5 w-3.5" /> Bank Account
                            </>
                          ) : (
                            <>
                              <Phone className="h-3.5 w-3.5" /> Phone Number
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {method.payment_value}
                      </TableCell>
                      <TableCell>
                        {method.qr_data ? (
                          <div className="h-10 w-10 rounded border overflow-hidden bg-white p-0.5">
                            <QRCodeSVG value={method.qr_data} size={36} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => openEditDialog(method)}
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDelete(method.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
