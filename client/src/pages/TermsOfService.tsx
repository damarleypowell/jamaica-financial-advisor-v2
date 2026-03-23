export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-card p-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">Terms of Service</h1>
        <p className="text-xs text-text-muted mb-6">Last updated: March 2026</p>

        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <Section title="1. Acceptance of Terms">
            By accessing or using Gotham Financial ("the Platform"), you agree to be bound by these Terms
            of Service. If you do not agree, you may not use the Platform. These terms are governed by
            the laws of Jamaica.
          </Section>

          <Section title="2. Description of Service">
            Gotham Financial provides a digital platform for viewing Jamaica Stock Exchange (JSE) market data,
            managing investment portfolios, executing paper and live trades, and accessing financial analysis tools.
            We are a technology platform, not a licensed securities dealer or investment advisor.
          </Section>

          <Section title="3. Financial Disclaimer">
            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4 mt-2">
              <p className="text-red-400 font-semibold mb-2">Important Disclaimer</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Information on this platform is for educational and informational purposes only.</li>
                <li>Nothing on this platform constitutes financial, investment, legal, or tax advice.</li>
                <li>Past performance does not guarantee future results.</li>
                <li>AI-generated analysis and recommendations are not personalized investment advice.</li>
                <li>You should consult a licensed financial advisor before making investment decisions.</li>
                <li>Investing involves risk, including the possible loss of principal.</li>
              </ul>
            </div>
          </Section>

          <Section title="4. User Accounts">
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>You must be at least 18 years old to create an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You must provide accurate and complete information during registration.</li>
              <li>You are responsible for all activities under your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </Section>

          <Section title="5. KYC Requirements">
            To access certain features (live trading, deposits, withdrawals), you must complete our
            Know Your Customer (KYC) verification process. This may include providing a valid
            government-issued ID and proof of address, as required by Jamaica's financial regulations.
          </Section>

          <Section title="6. Trading">
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li><strong>Paper Trading:</strong> Uses virtual funds for practice. No real money is involved.</li>
              <li><strong>Live Trading:</strong> Involves real funds and real market orders. All trades are your responsibility.</li>
              <li>We do not guarantee order execution at any specific price.</li>
              <li>Market data may be delayed. Real-time data availability depends on your subscription tier.</li>
              <li>US stock trading is facilitated through third-party brokerages (Alpaca Markets).</li>
            </ul>
          </Section>

          <Section title="7. Subscription & Payments">
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>Free tier features are available at no cost.</li>
              <li>Paid subscriptions are billed monthly in Jamaican Dollars (JMD).</li>
              <li>You may cancel your subscription at any time; access continues until the current billing period ends.</li>
              <li>Refunds are handled on a case-by-case basis.</li>
              <li>We reserve the right to change pricing with 30 days' notice.</li>
            </ul>
          </Section>

          <Section title="8. Prohibited Conduct">
            You agree not to:
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>Use the platform for market manipulation or insider trading</li>
              <li>Attempt to reverse-engineer, scrape, or exploit the platform</li>
              <li>Share your account credentials or allow unauthorized access</li>
              <li>Use automated bots without explicit API access authorization</li>
              <li>Upload malicious content or attempt to compromise platform security</li>
            </ul>
          </Section>

          <Section title="9. Intellectual Property">
            All content, design, code, and branding on the platform are the property of Gotham Financial.
            Market data is sourced from the JSE, Yahoo Finance, and other providers and is subject to
            their respective terms of use.
          </Section>

          <Section title="10. Limitation of Liability">
            To the maximum extent permitted by law, Gotham Financial shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of the platform,
            including but not limited to investment losses, data loss, or service interruptions.
          </Section>

          <Section title="11. Modifications">
            We may update these Terms of Service at any time. Material changes will be communicated
            via email or platform notification. Continued use of the platform after changes constitutes
            acceptance of the updated terms.
          </Section>

          <Section title="12. Governing Law">
            These terms are governed by and construed in accordance with the laws of Jamaica.
            Any disputes shall be resolved in the courts of Jamaica.
          </Section>

          <Section title="13. Contact">
            For questions about these terms, contact us at:
            <p className="mt-2 text-text-primary">
              <strong>Email:</strong> legal@gothamfinancial.com<br />
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
