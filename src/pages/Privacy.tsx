import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const sections = [
  { id: "intro", num: "01", title: "Introduction & Acceptance" },
  { id: "services", num: "02", title: "Description of Services" },
  { id: "account", num: "03", title: "Account & Security" },
  { id: "billing", num: "04", title: "Subscription & Payment" },
  { id: "acceptable-use", num: "05", title: "Acceptable Use" },
  { id: "privacy", num: "06", title: "Data Privacy & Protection" },
  { id: "data-protection", num: "06a", title: "Data Protection for Shopify Merchants" },
  { id: "third-party", num: "07", title: "Third-Party Platforms" },
  { id: "ip", num: "08", title: "Intellectual Property" },
  { id: "liability", num: "09", title: "Disclaimers & Liability" },
  { id: "indemnification", num: "10", title: "Indemnification" },
  { id: "termination", num: "11", title: "Termination" },
  { id: "law", num: "12", title: "Governing Law" },
  { id: "changes", num: "13", title: "Changes to Terms" },
  { id: "contact", num: "14", title: "Contact" },
];

export default function Privacy() {
  const [active, setActive] = useState("intro");
  const { pathname } = useLocation();
  const isTerms = pathname.startsWith("/terms");
  const pageTitle = isTerms
    ? "Terms of Service | Jawabify"
    : "Privacy Policy | Jawabify";
  const pageDesc = isTerms
    ? "The terms governing use of Jawabify's WhatsApp messaging platform: accounts, billing, acceptable use, liability and termination."
    : "How Jawabify collects, uses, shares and protects business and customer data across our WhatsApp messaging platform.";
  const pageUrl = isTerms ? "https://jawabify.com/terms" : "https://jawabify.com/privacy";

  useEffect(() => {
    const handler = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 140) current = s.id;
      }
      setActive(current);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
      </Helmet>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Jawabify</span>
          </Link>
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Legal · Terms & Privacy
          </p>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Terms &amp; <span className="text-primary">privacy.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            How we collect, use, share and protect your information across the Jawabify
            platform.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />{" "}
            <span className="font-semibold">Last updated</span> · June 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-20 rounded-xl border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                On this page
              </p>
              <nav className="flex flex-col gap-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                      active === s.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs tabular-nums opacity-60">{s.num}</span>
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <article className="rounded-xl border bg-card p-6 md:p-10">
            <Section id="intro" num="01" title="Introduction & Acceptance of Terms">
              <p>
                Welcome to Jawabify ("Jawabify," "we," "us," or "our"). Jawabify is an
                AI-powered automation platform that enables businesses to manage and automate
                customer communications via WhatsApp, Instagram, and other supported messaging
                channels (collectively, the "Services").
              </p>
              <p>
                By accessing or using Jawabify, you ("User," "Client," or "You") agree to be
                bound by these Terms of Service. If you do not agree, you must not access or
                use our Services.
              </p>
            </Section>

            <Section id="services" num="02" title="Description of Services">
              <p>Jawabify provides:</p>
              <ul>
                <li>AI-driven chatbot automation for WhatsApp and Instagram</li>
                <li>Multi-step conversation flow builders</li>
                <li>CRM integration, lead capture, and customer management tools</li>
                <li>Analytics dashboards and performance reporting</li>
                <li>Click-to-WhatsApp and Click-to-DM ad integrations</li>
                <li>
                  Custom automation workflows for e-commerce, restaurants, real estate,
                  healthcare, education, and wellness
                </li>
              </ul>
              <p>
                Our platform uses AI and large language models to generate automated responses.
                You acknowledge AI-generated responses may not always be accurate, and you are
                responsible for reviewing and configuring all automated flows before
                deployment.
              </p>
            </Section>

            <Section id="account" num="03" title="Account Registration & Security">
              <p>
                To access Jawabify, you must create an account with accurate, complete, and
                current information. You are responsible for maintaining the confidentiality
                of your credentials and all activity under your account. Notify us immediately
                at <a href="mailto:support@jawabify.com">support@jawabify.com</a> of any
                unauthorized use.
              </p>
            </Section>

            <Section id="billing" num="04" title="Subscription Plans & Payment Terms">
              <p>
                Jawabify offers monthly subscriptions, annual subscriptions (discounted), and
                usage-based pay-per-message plans. Subscriptions auto-renew unless cancelled
                before the renewal date.
              </p>
              <p>
                <strong>Refunds:</strong> Monthly plans are non-refundable once the billing
                cycle begins. Annual plans may be refunded on a pro-rated basis within 14 days
                of purchase. Usage charges are non-refundable once recorded.
              </p>
              <p>
                All prices exclude applicable taxes; you are responsible for taxes in your
                jurisdiction.
              </p>
            </Section>

            <Section id="acceptable-use" num="05" title="Acceptable Use Policy">
              <p>You agree NOT to use Jawabify to:</p>
              <ul>
                <li>Send spam, unsolicited bulk messages, or violate anti-spam regulations</li>
                <li>Impersonate any person or entity or misrepresent your affiliation</li>
                <li>Distribute malware, viruses, or malicious code</li>
                <li>Violate WhatsApp's Business Policy, Meta's Terms, or Instagram's Policy</li>
                <li>Engage in illegal, harmful, or fraudulent activity</li>
                <li>Process personal data without proper consent</li>
                <li>
                  Use the platform for adult content, gambling, weapons, or other prohibited
                  categories
                </li>
              </ul>
              <p>Violations may result in immediate account suspension without refund.</p>
            </Section>

            <Section id="privacy" num="06" title="Data Privacy & Protection">
              <h3>Data we collect</h3>
              <ul>
                <li>Account information (name, email, business details)</li>
                <li>Message logs and conversation data processed through our platform</li>
                <li>Usage analytics and platform interaction data</li>
                <li>Payment information (processed via secure third-party providers)</li>
              </ul>
              <h3>How we use your data</h3>
              <p>
                We use collected data to provide and improve the Services, process
                transactions, respond to support requests, prevent fraud, and comply with
                legal obligations. <strong>We do not sell your personal data.</strong>
              </p>
              <h3>End-user data</h3>
              <p>
                You are responsible for ensuring end users have consented to data collection
                through your Jawabify-powered flows. You act as the data controller; Jawabify
                acts as data processor.
              </p>
              <h3>Security & retention</h3>
              <p>
                We implement industry-standard security including TLS encryption, access
                controls, and regular audits. Conversation and account data is retained for
                the duration of your subscription and up to 90 days after termination.
              </p>
              <h3>GDPR & international compliance</h3>
              <p>
                EEA users may access, rectify, erase, and port personal data. Contact{" "}
                <a href="mailto:privacy@jawabify.com">privacy@jawabify.com</a> to exercise
                these rights.
              </p>
            </Section>

            <Section id="data-protection" num="06a" title="Data Protection for Shopify Merchants">
              <p>
                Jawabify processes only the minimum personal data required to provide and
                improve our WhatsApp automation and customer messaging services. This includes
                customer names, phone numbers, conversation content, and order identifiers,
                where these are provided by the merchant or their end customers.
              </p>
              <h3>What we tell merchants</h3>
              <p>
                We inform merchants of the personal data we process and the specific purposes for
                processing it. We limit our use of personal data to those purposes and do not
                use it for unrelated activities.
              </p>
              <h3>Consent, opt-outs, and automated decisions</h3>
              <p>
                We have privacy and data protection agreements in place with our merchants and
                respect customer consent and opt-out decisions, including STOP/unsubscribe
                requests for messaging. We do not sell personal data. Automated decision-making
                that produces legal or similarly significant effects is not part of our service.
              </p>
              <h3>Storage and security</h3>
              <p>
                We apply retention periods that ensure personal data is kept only as long as
                needed for service delivery or legal compliance, and we delete it when no longer
                required. All data is encrypted in transit and at rest.
              </p>
            </Section>

            <Section id="third-party" num="07" title="Third-Party Platform Compliance">
              <p>
                Jawabify integrates with WhatsApp Business API (via Meta) and Instagram. You
                are responsible for compliance with Meta's WhatsApp Business Terms, Platform
                Terms, and Instagram's Platform Policy, including obtaining proper opt-in
                consent from recipients. Jawabify is not liable for account bans imposed by
                Meta or WhatsApp due to your non-compliance.
              </p>
            </Section>

            <Section id="ip" num="08" title="Intellectual Property">
              <p>
                All platform technology, branding, and code are the exclusive property of
                Jawabify. You retain ownership of your content, data, and conversation flows
                and grant Jawabify a limited license to use them solely to provide the
                Services. Reverse engineering, decompilation, or derivative works are
                prohibited without prior written consent.
              </p>
            </Section>

            <Section id="liability" num="09" title="Disclaimers & Limitation of Liability">
              <p>
                THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE
                MAXIMUM EXTENT PERMITTED BY LAW, JAWABIFY SHALL NOT BE LIABLE FOR INDIRECT,
                INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. Our aggregate liability shall
                not exceed the amount paid in the three (3) months preceding the claim.
              </p>
            </Section>

            <Section id="indemnification" num="10" title="Indemnification">
              <p>
                You agree to indemnify and hold harmless Jawabify from any claims, damages,
                and expenses arising from your use of the Services, your violation of these
                Terms, your violation of third-party rights, or content transmitted through
                your account.
              </p>
            </Section>

            <Section id="termination" num="11" title="Termination">
              <p>
                Either party may terminate at any time. You may cancel from your account
                dashboard. Jawabify may suspend or terminate access for violations. Upon
                termination, your right to use the Services ends immediately.
              </p>
            </Section>

            <Section id="law" num="12" title="Governing Law & Dispute Resolution">
              <p>
                These Terms are governed by international commercial law principles. Disputes
                shall first be resolved through good-faith negotiation; unresolved disputes
                within 30 days shall be submitted to binding arbitration under internationally
                recognized rules.
              </p>
            </Section>

            <Section id="changes" num="13" title="Changes to These Terms">
              <p>
                We may update these Terms at any time and will notify users of material
                changes via email or in-platform notification at least 14 days before they
                take effect. Continued use constitutes acceptance.
              </p>
            </Section>

            <Section id="contact" num="14" title="Contact Information">
              <ul>
                <li>
                  Legal: <a href="mailto:legal@jawabify.com">legal@jawabify.com</a>
                </li>
                <li>
                  Support: <a href="mailto:support@jawabify.com">support@jawabify.com</a>
                </li>
                <li>
                  Privacy: <a href="mailto:privacy@jawabify.com">privacy@jawabify.com</a>
                </li>
                <li>
                  Website:{" "}
                  <a href="https://www.jawabify.com" target="_blank" rel="noreferrer">
                    www.jawabify.com
                  </a>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                © 2025 Jawabify. All rights reserved.
              </p>
            </Section>
          </article>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border/60 py-8 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
          {num}
        </span>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="prose prose-sm max-w-none text-foreground/85 prose-headings:mt-6 prose-headings:text-foreground prose-h3:text-base prose-h3:font-semibold prose-p:leading-relaxed prose-li:my-1 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground">
        {children}
      </div>
    </section>
  );
}
