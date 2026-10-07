import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CookieConsent } from "@/components/cookie-consent";
import {
  Receipt,
  ScanLine,
  Share2,
  QrCode,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 md:px-12 border-b">
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">Splitta</span>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <Button asChild>
              <Link to="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/sign-in">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/sign-up">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered receipt management
          </div>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Split receipts,
            <br />
            not friendships.
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            Scan any receipt, let AI extract the details, and share the cost
            with others — effortlessly.
          </p>
          <div className="flex gap-3 pt-2">
            <Button size="lg" asChild>
              <Link to="/sign-up">
                Get Started Free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/40 px-6 py-20 md:px-12">
          <div className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<ScanLine className="h-6 w-6" />}
              title="Scan & Extract"
              description="Upload a photo or scan a receipt. Our AI reads every line item, total, and tax automatically."
            />
            <FeatureCard
              icon={<Share2 className="h-6 w-6" />}
              title="Easy Sharing"
              description="Share receipts with anyone via a link. Assign items to people and see who owes what."
            />
            <FeatureCard
              icon={<QrCode className="h-6 w-6" />}
              title="Share via QR"
              description="Generate a shareable link or QR code for any receipt so anyone can view the breakdown."
            />
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to simplify expenses?
          </h2>
          <p className="text-muted-foreground">
            Free to use. No credit card required.
          </p>
          <Button size="lg" asChild>
            <Link to="/sign-up">
              Create an Account
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6 md:px-12">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span>Splitta</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Splitta. All rights reserved.
          </p>
        </div>
      </footer>

      <CookieConsent />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
