import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
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
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 6, 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Splitta ("the Service"), you agree to be
              bound by these Terms of Service. If you do not agree to these
              terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. Description of Service
            </h2>
            <p>
              Splitta is a receipt scanning and expense splitting application
              that allows users to capture receipts, extract item details, and
              share costs with others. The Service is provided "as is" and "as
              available."
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. User Accounts
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities under your account. You
              agree to provide accurate and complete information when creating
              your account and to update it as needed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. User Content
            </h2>
            <p>
              You retain ownership of any content you upload, including receipt
              images and related data. By using the Service, you grant Splitta a
              limited license to process, store, and display your content solely
              to provide the Service to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload false or fraudulent receipt data</li>
              <li>
                Attempt to gain unauthorized access to other users' accounts
              </li>
              <li>Interfere with or disrupt the Service infrastructure</li>
              <li>
                Reverse engineer, decompile, or disassemble any part of the
                Service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Limitation of Liability
            </h2>
            <p>
              Splitta shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              Service. The accuracy of receipt scanning and data extraction is
              provided on a best-effort basis and should be verified by the
              user.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your access to the
              Service at any time, with or without notice, for conduct that we
              believe violates these Terms or is harmful to other users or the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. We will notify users
              of any material changes by posting the updated terms on this page
              with a revised "Last updated" date. Continued use of the Service
              after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. Contact
            </h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
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

export default Terms;
