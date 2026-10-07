import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt } from "lucide-react";

interface LoginFormProps extends Omit<React.ComponentProps<"div">, "onSubmit"> {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignupClick: () => void;
  loading?: boolean;
  errorMsg?: string;
}

export function LoginForm({
  className,
  onSubmit,
  onSignupClick,
  loading,
  errorMsg,
  ...props
}: LoginFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  Login to your Splitta account
                </p>
              </div>

              {errorMsg && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    tabIndex={-1}
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input id="password" name="password" type="password" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={onSignupClick}
                  className="underline underline-offset-4 hover:text-primary bg-transparent border-none cursor-pointer p-0"
                >
                  Sign up
                </button>
              </div>
            </div>
          </form>
          <div className="relative hidden md:flex flex-col items-center justify-center gap-4 bg-muted p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Receipt className="h-7 w-7" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Splitta</h2>
              <p className="text-sm text-muted-foreground max-w-[200px]">
                Scan receipts, split costs, and settle up — effortlessly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our{" "}
        <a href="/terms">Terms of Service</a> and{" "}
        <a href="/policy">Privacy Policy</a>.
      </div>
    </div>
  );
}
