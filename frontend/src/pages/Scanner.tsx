import { useState } from "react";
import { Camera, X, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { create, services } from "@/lib/api";

const Scanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const simulateScan = async () => {
    if (!user) return;
    setScanning(true);
    setErrorMsg("");

    try {
      // 1. Simulate 2 seconds of OCR delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Generate fake receipt data
      const mockTotal = (Math.random() * 80 + 20).toFixed(2);
      const taxAmount = (Number(mockTotal) * 0.08).toFixed(2);

      await create(`${services.receipt}/Receipts`, {
        merchantName: [
          "Starbucks",
          "Walmart",
          "Apple Store",
          "Target",
          "Best Buy",
        ][Math.floor(Math.random() * 5)],
        currency: "USD",
        taxAmount: Number(taxAmount),
        taxPercentage: 8,
        discountAmount: 0,
        priceAmount: Number(mockTotal),
        roundingAdjustment: 0,
        items: [
          {
            description: "Item 1",
            quantity: 1,
            priceTaxInclusive: Number(mockTotal) * 0.6,
            itemSpecificDiscount: 0,
          },
          {
            description: "Item 2",
            quantity: 2,
            priceTaxInclusive: Number(mockTotal) * 0.4,
            itemSpecificDiscount: 0,
          },
        ],
      });

      setScanning(false);
      setSuccess(true);

      // Navigate back home after success
      setTimeout(() => navigate("/"), 2000);
    } catch (err: unknown) {
      setScanning(false);
      if (err instanceof Error) {
        setErrorMsg(err.message || "Failed to parse receipt");
      } else {
        setErrorMsg("Failed to parse receipt");
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <div className="flex justify-between items-center p-6 pb-0 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-foreground hover:bg-muted"
          onClick={() => navigate(-1)}
        >
          <X className="w-7 h-7" />
        </Button>
        <h3 className="font-semibold text-lg">Scanner</h3>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6">
        {success ? (
          <div className="text-center animate-in fade-in duration-500">
            <CheckCircle className="w-20 h-20 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Receipt Saved!</h2>
          </div>
        ) : (
          <>
            <div className="w-full max-w-sm aspect-[3/4] border-2 border-primary/50 rounded-2xl relative overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.2)] bg-black/20 backdrop-blur-sm">
              {scanning && (
                <div
                  className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_theme(colors.primary.DEFAULT)]"
                  style={{ animation: "scanLine 2s infinite linear" }}
                />
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground font-medium text-center w-full px-4">
                {scanning
                  ? "Analyzing Receipt..."
                  : "Align receipt within frame"}
              </div>
            </div>

            {errorMsg && (
              <div className="mt-6 p-3 text-sm text-destructive bg-destructive/10 rounded-lg w-full max-w-sm text-center">
                {errorMsg}
              </div>
            )}

            <style>{`
              @keyframes scanLine {
                0% { top: 0; }
                50% { top: 100%; }
                100% { top: 0; }
              }
            `}</style>
          </>
        )}
      </div>

      {!success && (
        <div className="py-8 flex justify-center pb-12">
          <Button
            className="w-20 h-20 rounded-full shadow-lg shadow-primary/25 bg-gradient-to-br from-indigo-500 to-pink-500 hover:scale-105 transition-transform border-0"
            onClick={simulateScan}
            disabled={scanning}
            size="icon"
          >
            <Camera className="w-10 h-10" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Scanner;
