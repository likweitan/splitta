import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Policy = () => {
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 6, 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Information We Collect
            </h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong className="text-foreground">Account information</strong>{" "}
                — your name, email address, and password when you create an
                account
              </li>
              <li>
                <strong className="text-foreground">Receipt data</strong> —
                images you upload and the extracted text, items, and amounts
              </li>
              <li>
                <strong className="text-foreground">Payment details</strong> —
                bank account names or payment references you choose to save
              </li>
              <li>
                <strong className="text-foreground">Usage data</strong> —
                information about how you interact with the Service, including
                device type and browser
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. How We Use Your Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and extract data from receipt images</li>
              <li>Generate shareable receipt summaries via QR codes</li>
              <li>Send important notifications about your account</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. Data Storage & Security
            </h2>
            <p>
              Your data is stored securely using PocketBase infrastructure with
              access control rules. Receipt images are stored in secure cloud
              storage. We implement industry-standard security measures to
              protect your information, but no method of transmission or storage
              is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share your data
              only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong className="text-foreground">With your consent</strong> —
                when you share receipts via public links or QR codes
              </li>
              <li>
                <strong className="text-foreground">Service providers</strong> —
                third-party services that help us process receipts (e.g., AI
                extraction services)
              </li>
              <li>
                <strong className="text-foreground">Legal requirements</strong>{" "}
                — when required by law or to protect our rights
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Cookies
            </h2>
            <p>
              We use cookies to store your preferences such as sidebar layout
              state. We also use a cookie consent mechanism to respect your
              choice regarding non-essential cookies. You can manage your cookie
              preferences at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your receipt data</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active. If you
              delete your account, we will remove your personal data and receipt
              images within 30 days, except where we are required to retain it
              by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Children's Privacy
            </h2>
            <p>
              The Service is not intended for users under the age of 13. We do
              not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by updating the "Last updated" date
              at the top of this page. Your continued use of the Service after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              10. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at{" "}
              <a
                href="mailto:likweitan@gmail.com"
                className="text-foreground underline underline-offset-4"
              >
                likweitan@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Policy;
