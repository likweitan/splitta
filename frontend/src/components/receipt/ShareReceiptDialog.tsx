import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { receiptShareUrl } from "@/lib/utils";

interface ShareReceiptDialogProps {
  receiptId: string;
}

export function ShareReceiptDialog({ receiptId }: ShareReceiptDialogProps) {
  const shareUrl = receiptShareUrl(receiptId);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      },
      (error: unknown) => {
        console.error("Failed to copy share link:", error);
      },
    );
  };

  return (
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
            <div className="rounded-lg border bg-white p-4">
              <QRCodeSVG value={shareUrl} size={180} />
            </div>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} className="text-xs" />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copied && <p className="text-xs text-emerald-500">Link copied!</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
