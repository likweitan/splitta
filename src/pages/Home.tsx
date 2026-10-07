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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Plus,
  ArrowUpDown,
  Copy,
  Upload,
  X,
  FileImage,
} from "lucide-react";

import { pb } from "../pocketbase";
import { useAuth } from "../contexts/AuthContext";
import { CookieConsent } from "../components/cookie-consent";

interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  price_tax_inclusive: number;
}

interface Receipt {
  id: string;
  merchant_name: string;
  currency: string;
  price_amount: number;
  created_at: string;
  items?: ReceiptItem[];
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReceipts = useCallback(async () => {
    if (!user) return;
    try {
      const records = await pb.collection("receipts").getFullList({
        filter: `user_id = "${user.id}"`,
        sort: "-created",
        expand: "items",
      });

      // Also fetch items for each receipt
      const receiptsWithItems = await Promise.all(
        records.map(async (record) => {
          const items = await pb.collection("items").getFullList({
            filter: `receipt_id = "${record.id}"`,
          });
          return {
            id: record.id,
            merchant_name: record.merchant_name,
            currency: record.currency,
            price_amount: record.price_amount,
            created_at: record.created,
            items: items.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              price_tax_inclusive: item.price_tax_inclusive,
            })),
          } as Receipt;
        }),
      );

      setReceipts(receiptsWithItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const totalExpenses = receipts.reduce((acc, r) => acc + r.price_amount, 0);

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
    if (!uploadFile || !user) return;
    setUploading(true);

    try {
      // 1. Upload receipt image to PocketBase storage
      const formDataPb = new FormData();
      formDataPb.append("image", uploadFile);
      formDataPb.append("user_id", user.id);

      // We'll store image directly in the receipt record later

      // 2. Send image as binary to n8n webhook
      const formData = new FormData();
      formData.append("file", uploadFile, uploadFile.name);

      // 3. Call the n8n webhook
      const webhookResponse = await fetch(
        "https://n8n.likweitan.eu.org/webhook-test/381d6587-56cc-4dc4-b40d-67e29fd7bc84",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!webhookResponse.ok) {
        console.error("Webhook error:", await webhookResponse.text());
        throw new Error("Failed to process receipt via webhook");
      }

      const geminiResult = await webhookResponse.json();

      // 4. Insert receipt into PocketBase (with image file)
      const receiptInfo = geminiResult.receipt_info;
      const receiptFormData = new FormData();
      receiptFormData.append("user_id", user.id);
      receiptFormData.append(
        "merchant_name",
        receiptInfo.merchant_name || "Unknown",
      );
      receiptFormData.append("currency", receiptInfo.currency || "MYR");
      receiptFormData.append(
        "tax_amount",
        String(receiptInfo.total_tax_amount || 0),
      );
      receiptFormData.append(
        "tax_percentage",
        String(receiptInfo.tax_percentage || 0),
      );
      receiptFormData.append(
        "discount_amount",
        String(receiptInfo.header_discount || 0),
      );
      receiptFormData.append(
        "price_amount",
        String(receiptInfo.anchor_total || 0),
      );
      receiptFormData.append(
        "rounding_adjustment",
        String(receiptInfo.rounding_adjustment || 0),
      );
      receiptFormData.append("image", uploadFile);

      const receiptData = await pb
        .collection("receipts")
        .create(receiptFormData);

      // 5. Insert items into PocketBase
      if (geminiResult.items && geminiResult.items.length > 0) {
        for (const item of geminiResult.items) {
          await pb.collection("items").create({
            receipt_id: receiptData.id,
            description: item.description,
            quantity: item.qty || 1,
            price_tax_inclusive: item.price_tax_inclusive || 0,
            item_specific_discount: item.item_specific_discount || 0,
          });
        }
      }

      // 6. Close dialog and refresh
      setUploadOpen(false);
      setUploadFile(null);
      setUploadPreview(null);
      fetchReceipts();
    } catch (err) {
      console.error("Upload error:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to process receipt. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

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
                  <BreadcrumbPage>Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Free Plan</CardTitle>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Upgrade Plan
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex flex-col gap-2">
                  <Progress
                    value={(receipts.length / 15) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    You used {receipts.length} of 15 of your monthly scans
                  </p>
                </div>
              </CardContent>
            </Card>

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
                  Failed Scans
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-red-500 bg-red-50 hover:bg-red-50 border-red-200"
                >
                  -0.3%
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">23</div>
                <p className="text-xs text-muted-foreground mt-1">
                  More than last month
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-4">
            <div className="flex items-center w-full sm:max-w-sm space-x-2">
              <Input type="text" placeholder="Filter receipts..." />
            </div>
            <Dialog
              open={uploadOpen}
              onOpenChange={(open) => {
                setUploadOpen(open);
                if (!open) resetUpload();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-zinc-900 text-zinc-50 hover:bg-zinc-800">
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
                        Supports JPG, PNG, HEIC
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
                        {uploading
                          ? "Uploading..."
                          : "Upload & Process Receipt"}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] hidden sm:table-cell">
                    <Checkbox />
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                      Merchant <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Receipt ID
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                      Date Scanned <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Loading receipts...
                    </TableCell>
                  </TableRow>
                ) : receipts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No receipts yet. Scan your first receipt to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow
                      key={receipt.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/receipt/${receipt.id}`)}
                    >
                      <TableCell className="hidden sm:table-cell">
                        <Checkbox />
                      </TableCell>
                      <TableCell className="font-medium">
                        {receipt.merchant_name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {receipt.id.substring(0, 8)}...
                          {receipt.id.substring(receipt.id.length - 4)}
                          <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {new Date(receipt.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </TableCell>
                      <TableCell>
                        {receipt.currency} {receipt.price_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className="text-emerald-500 border-emerald-200 bg-transparent font-normal text-xs"
                        >
                          Processed
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            {receipts.length} receipt(s) total.
          </div>
        </div>
      </SidebarInset>
      <CookieConsent />
    </SidebarProvider>
  );
}
