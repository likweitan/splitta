import { useState, useRef } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { pb } from "../pocketbase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUri(url);
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const mockQrUrl =
        previewUri || "https://api.dicebear.com/7.x/identicon/svg?seed=qr";

      // Try to get existing profile, then update or create
      try {
        await pb.collection("profiles").update(user.id, {
          payment_qr_url: mockQrUrl,
        });
      } catch {
        await pb.collection("profiles").create({
          id: user.id,
          payment_qr_url: mockQrUrl,
        });
      }

      navigate("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || "Failed to save profile");
      } else {
        setErrorMsg("Failed to save profile");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-xl mx-auto min-h-screen p-6 relative flex flex-col justify-center">
      <div className="mb-8 mt-10">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-indigo-500 to-pink-500 bg-clip-text text-transparent mb-2">
          Welcome!
        </h1>
        <p className="text-muted-foreground text-sm">
          Let's set up your profile. Please upload your personal Payment QR
          code. This will be used for your scanned receipts.
        </p>
      </div>

      <Card className="border-border/50 bg-background/50 backdrop-blur-xl text-center py-12 px-6">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        <CardContent className="flex flex-col items-center justify-center p-0">
          <div
            className={`w-36 h-36 rounded-2xl bg-muted/50 mx-auto mb-6 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-muted transition-colors ${!previewUri ? "border-2 border-dashed border-border" : ""}`}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            {previewUri ? (
              <img
                src={previewUri}
                alt="QR Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload className="w-10 h-10 text-primary" />
            )}
          </div>

          <h3 className="font-semibold text-lg">
            {previewUri ? "QR Ready to Save" : "Upload Payment QR"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {previewUri
              ? "Looks good! Tap save to continue."
              : "Tap to upload an image from your device"}
          </p>

          {errorMsg && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4 w-full">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
            {previewUri && (
              <Button
                onClick={handleUpload}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  "Saving..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" /> Save & Continue
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              disabled={loading}
              className="w-full bg-transparent border-border/50"
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
