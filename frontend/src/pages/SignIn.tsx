import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";

const SignIn = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [navigate, user]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn();
      if (import.meta.env.DEV) navigate("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm space-y-5 rounded-xl border bg-background p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to Splitta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue with your SAP identity account.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handleSignIn} disabled={loading}>
          {loading ? "Connecting..." : "Continue with SAP"}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate("/")}
        >
          Back to home
        </Button>
      </div>
    </main>
  );
};

export default SignIn;
