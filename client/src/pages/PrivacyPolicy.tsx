export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-card p-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">Privacy Policy</h1>
        <p className="text-xs text-text-muted mb-6">Last updated: March 2026</p>

        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <Section title="1. Introduction">
            Gotham Financial ("we", "our", "us") is committed to protecting your personal data in accordance
            with Jamaica's Data Protection Act, 2020. This policy explains how we collect, use, and safeguard
            your information when you use our platform.
          </Section>

          <Section title="2. Information We Collect">
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li><strong>Account Information:</strong> Name, email address, username, and password hash when you register.</li>
              <li><strong>Identity Verification (KYC):</strong> Government-issued ID documents submitted for account verification.</li>
              <li><strong>Financial Data:</strong> Portfolio holdings, transaction history, watchlists, and trading activity.</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, device information, and IP address.</li>
              <li><strong>Communications:</strong> Messages sent through our AI chat feature and support requests.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>Provide and maintain our trading platform services</li>
              <li>Process transactions and manage your portfolio</li>
              <li>Verify your identity as required by Jamaica's financial regulations</li>
              <li>Send alerts, notifications, and account-related communications</li>
              <li>Improve our platform through aggregated, anonymized analytics</li>
              <li>Comply with legal obligations and regulatory requirements</li>
            </ul>
          </Section>

          <Section title="4. Data Security">
            We implement industry-standard security measures including encryption of data in transit (TLS 1.3)
            and at rest, secure password hashing (bcrypt), two-factor authentication, and regular security audits.
            Access to personal data is restricted to authorized personnel on a need-to-know basis.
          </Section>

          <Section title="5. Data Sharing">
            We do not sell your personal data. We may share information with:
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li><strong>Service providers:</strong> Third-party services that help us operate (e.g., payment processors, hosting)</li>
              <li><strong>Regulatory bodies:</strong> When required by Jamaica's financial regulators or law enforcement</li>
              <li><strong>Brokerage partners:</strong> To execute trades on your behalf (e.g., Alpaca for US stock trading)</li>
            </ul>
          </Section>

          <Section title="6. Your Rights (Data Protection Act, 2020)">
            Under Jamaica's Data Protection Act, you have the right to:
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>Access your personal data held by us</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to regulatory retention requirements)</li>
              <li>Object to processing of your data</li>
              <li>Data portability — receive your data in a structured format</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            We retain your personal data for as long as your account is active. Financial transaction records
            are retained for a minimum of 7 years as required by Jamaica's tax and financial regulations.
            You may request account deletion, after which non-regulatory data will be removed within 30 days.
          </Section>

          <Section title="8. Cookies">
            We use essential cookies for authentication and session management. We do not use third-party
            tracking cookies or advertising cookies. Your preferences are stored locally in your browser.
          </Section>

          <Section title="9. Contact Us">
            For privacy-related inquiries or to exercise your data rights, contact us at:
            <p className="mt-2 text-text-primary">
              <strong>Email:</strong> privacy@gothamfinancial.com<br />
              <strong>Address:</strong> Kingston, Jamaica
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
