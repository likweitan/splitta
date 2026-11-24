import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Upload,
  X,
  FileImage,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useTeam } from "../contexts/TeamContext";
import { AnalyzingImage } from "@/components/loading-ui/analyzing-image";
import { CookieConsent } from "../components/cookie-consent";
import { ReceiptReviewDialog } from "@/components/receipt/ReceiptReviewDialog";
import { ReceiptDataTable } from "@/components/receipt/ReceiptDataTable";
import type { Receipt } from "@/components/receipt/receipt-columns";
import { paidAmountPercentage } from "@/lib/receipt-math";
import {
  create,
  extractReceipt,
  fileToBase64,
  readCollection,
  type ReceiptExtraction,
  services,
} from "@/lib/api";

export default function Home() {
  const { user } = useAuth();
  const {
    activeTeam,
    loading: teamsLoading,
  } = useTeam();
  const navigate = useNavigate();
  const openReceipt = useCallback(
    (id: string) => navigate(`/receipt/${id}`),
    [navigate],
  );
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<{
    imageData: string;
    contentType: string;
    extraction: ReceiptExtraction;
  } | null>(null);
  const [uploadStage, setUploadStage] = useState<
    "idle" | "uploading" | "analyzing" | "saving"
  >("idle");
  const uploading = uploadStage !== "idle";
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReceipts = useCallback(async () => {
    if (!user) {
      setReceipts([]);
      setLoading(false);
      return;
    }
    if (teamsLoading) return;
    try {
      setLoading(true);
      const filter = activeTeam
        ? `team_ID eq ${activeTeam.id}`
        : `owner eq '${user.id.replaceAll("'", "''")}' or viewers/any(v:v/userID eq '${user.id.replaceAll("'", "''")}')`;
      const records = await readCollection<{
        ID: string;
        merchantName: string;
        currency: string;
        priceAmount: number;
        createdAt: string;
        items: {
          ID: string;
          description: string;
          quantity: number;
          priceTaxInclusive: number;
          itemSpecificDiscount: number | null;
          paidByName: string | null;
        }[];
      }>(
        `${services.receipt}/Receipts?$filter=${encodeURIComponent(filter)}&$select=ID,merchantName,currency,priceAmount,createdAt&$expand=items($select=ID,description,quantity,priceTaxInclusive,itemSpecificDiscount,paidByName)&$orderby=createdAt desc`,
      );
      setReceipts(
        records.map((record) => {
          const items = record.items.map((item) => ({
            id: item.ID,
            description: item.description,
            quantity: Number(item.quantity),
            price_tax_inclusive: Number(item.priceTaxInclusive),
            item_specific_discount: Number(item.itemSpecificDiscount ?? 0),
            paid_by_name: item.paidByName,
          }));
          return {
            id: record.ID,
            merchant_name: record.merchantName,
            currency: record.currency,
            price_amount: Number(record.priceAmount),
            created_at: record.createdAt,
            percent_paid: paidAmountPercentage(items),
            items,
          };
        }),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, activeTeam, teamsLoading]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const totalExpenses = receipts.reduce((acc, r) => acc + r.price_amount, 0);
  const pendingSplits = receipts.filter((r) => r.percent_paid < 100);

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !user || uploading) return;
    const file = uploadFile;
    setUploadStage("uploading");
    setUploadOpen(false);
    resetUpload();

    try {
      const imageData = await fileToBase64(file);
      setUploadStage("analyzing");
      const extraction = await extractReceipt(imageData, file.type);
      setPendingReceipt({ imageData, contentType: file.type, extraction });
    } catch (err) {
      console.error("Upload error:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to process receipt. Please try again.",
      );
    } finally {
      setUploadStage("idle");
    }
  };

  const confirmReceipt = async (extraction: ReceiptExtraction) => {
    if (!pendingReceipt) return;
    setUploadStage("saving");
    try {
      await create(`${services.receipt}/Receipts`, {
        ...extraction.receiptInfo,
        imageData: pendingReceipt.imageData,
        items: extraction.items,
        ...(activeTeam ? { team_ID: activeTeam.id } : {}),
      });
      setPendingReceipt(null);
      await fetchReceipts();
    } finally {
      setUploadStage("idle");
    }
  };

  const cancelReview = () => setPendingReceipt(null);

  const resetUpload = () => {
    setUploadFile(null);
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
                <BreadcrumbItem>
                  <BreadcrumbPage>Receipts</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Scanned Receipts
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-emerald-500 bg-emerald-50 hover:bg-emerald-50 border-emerald-200"
                >
                  +10.3%
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{receipts.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  More than last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Splits
                </CardTitle>
                {pendingSplits.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-amber-600 bg-amber-50 hover:bg-amber-50 border-amber-200"
                  >
                    Needs action
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{pendingSplits.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingSplits.length > 0
                    ? "Receipts with items not yet assigned"
                    : "All receipts fully split"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-emerald-500 bg-emerald-50 hover:bg-emerald-50 border-emerald-200"
                >
                  2.3%
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {receipts.length > 0
                    ? `${receipts[0]?.currency || "MYR"} ${totalExpenses.toFixed(2)}`
                    : "MYR 0.00"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  More than last month
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mt-4">
            <Dialog
              open={uploadOpen}
              onOpenChange={(open) => {
                setUploadOpen(open);
                if (!open) resetUpload();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="bg-zinc-900 text-zinc-50 hover:bg-zinc-800"
                  disabled={uploading}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add receipt
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Upload Receipt</DialogTitle>
                  <DialogDescription>
                    Upload an image of your receipt to scan and process it.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  {!uploadPreview ? (
                    <div
                      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer ${
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium mb-1">
                        Drag & drop your receipt here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse files
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports JPG, PNG, HEIC (up to 8 MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileInputChange}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-lg border overflow-hidden bg-muted/50">
                        <img
                          src={uploadPreview}
                          alt="Receipt preview"
                          className="w-full max-h-[300px] object-contain mx-auto"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background"
                          onClick={resetUpload}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileImage className="h-4 w-4" />
                        <span className="truncate">{uploadFile?.name}</span>
                        <span className="ml-auto text-xs">
                          {uploadFile
                            ? `${(uploadFile.size / 1024).toFixed(0)} KB`
                            : ""}
                        </span>
                      </div>
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full"
                      >
                        Upload & Process Receipt
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading || uploading || receipts.length > 0 ? (
            <ReceiptDataTable
              receipts={receipts}
              loading={loading}
              uploadStatus={
                uploading && uploadStage !== "analyzing" ? uploadStage : null
              }
              onOpenReceipt={openReceipt}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16 gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                <FileImage className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">No receipts yet</p>
                <p className="text-sm mt-1">
                  Scan your first receipt to get started.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(true)}
                disabled={uploading}
              >
                <Plus className="mr-2 h-4 w-4" /> Add receipt
              </Button>
            </div>
          )}

        </div>
      </SidebarInset>
      <ReceiptReviewDialog
        open={pendingReceipt !== null}
        extraction={pendingReceipt?.extraction ?? null}
        imageSrc={
          pendingReceipt
            ? `data:${pendingReceipt.contentType};base64,${pendingReceipt.imageData}`
            : null
        }
        onOpenChange={(open) => {
          if (!open) cancelReview();
        }}
        onConfirm={confirmReceipt}
      />
      <CookieConsent />
      {uploadStage === "analyzing" && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-white px-6 text-zinc-900"
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <AnalyzingImage className="size-20 shrink-0 text-zinc-900 [--loading-ui-analyzing-image-background:white]" />
            <div>
              <p className="text-lg font-semibold">Analyzing receipt...</p>
              <p className="mt-1 text-sm text-zinc-500">
                Reading items, tax and totals
              </p>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
