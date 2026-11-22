import { Link } from "react-router-dom";
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
  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 md:px-12 border-b">
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-semibold tracking-tight">Splitta</span>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/sign-in">Sign in</Link>
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-12 md:py-24 text-center">
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
              <Link to="/sign-in">
                Sign in
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/40 px-6 py-12 md:px-12">
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
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6 md:px-12">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4 text-sidebar-primary" />
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
