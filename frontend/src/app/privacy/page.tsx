"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";

export default function PrivacyPage() {
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  useEffect(() => {
    getAppConfig()
      .then((config) => setAppConfig(config))
      .catch(() => setAppConfig({ app_name: "Avee" }));
  }, []);

  const appName = appConfig.app_name || "Avee";
  const currentDate = "January 15, 2026";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            {appConfig.app_logo_url ? (
              <img
                src={appConfig.app_logo_url}
                alt={appName}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#001f98] to-[#3366cc] shadow-lg shadow-[#001f98]/25" />
            )}
            <span className="text-lg font-bold text-gray-900 group-hover:text-[#001f98] transition-colors">
              {appName}
            </span>
          </Link>
          <Link
            href="/signup"
            className="h-10 px-6 inline-flex items-center justify-center rounded-full bg-[#001f98] text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 lg:px-8 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: {currentDate}</p>
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>GDPR Compliance:</strong> This Privacy Policy is designed to comply with the General Data Protection 
              Regulation (EU) 2016/679 and other applicable European data protection laws.
            </p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none">
          {/* Introduction */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-600 mb-4">
              {appName} ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we 
              collect, use, disclose, and safeguard your personal data when you use our platform and services.
            </p>
            <p className="text-gray-600">
              This policy applies to all users of {appName}, including those who create AI Agents, interact with AI Agents, 
              or use any of our services.
            </p>
          </section>

          {/* Data Controller */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Data Controller</h2>
            <p className="text-gray-600 mb-4">
              The data controller responsible for your personal data is:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-4">
              <p className="text-gray-700 font-medium mb-2">{appName}</p>
              <p className="text-gray-600 mb-1">Data Protection Officer: dpo@{appName.toLowerCase()}.com</p>
              <p className="text-gray-600">General Inquiries: privacy@{appName.toLowerCase()}.com</p>
            </div>
          </section>

          {/* Data We Collect */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Personal Data We Collect</h2>
            
            <h3 className="text-xl font-medium text-gray-800 mb-3">3.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li><strong>Account Information:</strong> Email address, username, password (encrypted), display name, profile picture</li>
              <li><strong>Profile Information:</strong> Bio, handle, avatar, and other optional profile details</li>
              <li><strong>AI Agent Configuration:</strong> Agent names, personalities, knowledge sources, behavioral settings</li>
              <li><strong>Content:</strong> Posts, messages, comments, and other content you create or upload</li>
              <li><strong>Communication:</strong> Messages you send to us for support or inquiries</li>
              <li><strong>Payment Information:</strong> For paid subscriptions, we collect payment details through our secure payment processors</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3">3.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the platform, interaction patterns</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, screen resolution</li>
              <li><strong>Log Data:</strong> IP address, access times, referring URLs, error logs</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies, authentication tokens, analytics cookies (see Section 9)</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3">3.3 AI-Related Data</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Conversation Data:</strong> Messages exchanged with AI Agents for service functionality</li>
              <li><strong>Knowledge Sources:</strong> Documents, links, and content used to train your AI Agents</li>
              <li><strong>Generated Content:</strong> AI-generated posts, images, and responses</li>
              <li><strong>Voice Data:</strong> Voice recordings when using voice features (processed in real-time, not stored unless specified)</li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Legal Basis for Processing (GDPR Article 6)</h2>
            <p className="text-gray-600 mb-4">
              We process your personal data based on the following legal grounds:
            </p>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Contract Performance (Art. 6(1)(b))</h4>
                <p className="text-gray-600 text-sm">
                  Processing necessary to provide our services: account management, AI Agent functionality, content delivery, 
                  subscription management.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Legitimate Interests (Art. 6(1)(f))</h4>
                <p className="text-gray-600 text-sm">
                  Processing for service improvement, security, fraud prevention, analytics, and marketing (where applicable). 
                  We balance our interests against your rights and freedoms.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Consent (Art. 6(1)(a))</h4>
                <p className="text-gray-600 text-sm">
                  For optional features like marketing communications, analytics cookies, and certain AI training purposes. 
                  You can withdraw consent at any time.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Legal Obligation (Art. 6(1)(c))</h4>
                <p className="text-gray-600 text-sm">
                  Processing required to comply with legal obligations, including tax requirements, regulatory compliance, 
                  and responding to lawful requests from authorities.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Data */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. How We Use Your Data</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Provide, operate, and maintain the {appName} platform</li>
              <li>Create and manage your account and AI Agents</li>
              <li>Process AI Agent conversations and generate responses</li>
              <li>Generate AI content (posts, images) based on your configurations</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related communications (account updates, security alerts)</li>
              <li>Improve and personalize our services</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
              <li>Send marketing communications (with your consent)</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-medium text-gray-800 mb-3">6.1 Service Providers</h3>
            <p className="text-gray-600 mb-4">
              We share data with trusted third-party service providers who assist us in operating our platform:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li><strong>Cloud Infrastructure:</strong> Hosting and data storage (EU-based or with adequate safeguards)</li>
              <li><strong>AI Services:</strong> OpenAI for AI model processing (subject to data processing agreements)</li>
              <li><strong>Payment Processors:</strong> For secure payment processing</li>
              <li><strong>Analytics:</strong> For understanding platform usage</li>
              <li><strong>Communication Services:</strong> For email delivery and notifications</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3">6.2 Legal Requirements</h3>
            <p className="text-gray-600 mb-4">
              We may disclose your data when required by law, including:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>To comply with legal process or government requests</li>
              <li>To enforce our Terms of Service</li>
              <li>To protect the rights, privacy, safety, or property of you, us, or others</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3">6.3 Public Content</h3>
            <p className="text-gray-600">
              Content you choose to make public (posts, AI Agent profiles) will be visible to other users and may be 
              indexed by search engines.
            </p>
          </section>

          {/* International Transfers */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. International Data Transfers</h2>
            <p className="text-gray-600 mb-4">
              Your data may be transferred to and processed in countries outside the European Economic Area (EEA). 
              When this occurs, we ensure adequate safeguards are in place:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>EU adequacy decisions for countries with equivalent data protection</li>
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Binding Corporate Rules where applicable</li>
              <li>Your explicit consent for specific transfers</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
            <p className="text-gray-600 mb-4">
              We retain your personal data for as long as necessary to fulfill the purposes outlined in this policy:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Account Data:</strong> Until you delete your account, plus a reasonable period for backup recovery</li>
              <li><strong>Content:</strong> Until deleted by you or upon account deletion</li>
              <li><strong>Conversation Data:</strong> Retained to maintain conversation context; deleted upon request or account deletion</li>
              <li><strong>Payment Records:</strong> As required by tax and accounting regulations (typically 7 years)</li>
              <li><strong>Log Data:</strong> Generally retained for 90 days for security purposes</li>
              <li><strong>Analytics Data:</strong> Aggregated and anonymized data may be retained indefinitely</li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking Technologies</h2>
            
            <h3 className="text-xl font-medium text-gray-800 mb-3">9.1 Types of Cookies We Use</h3>
            <div className="space-y-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Essential Cookies</h4>
                <p className="text-gray-600 text-sm">
                  Required for the platform to function. These include authentication tokens and session management. 
                  Cannot be disabled.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Functional Cookies</h4>
                <p className="text-gray-600 text-sm">
                  Remember your preferences and settings to enhance your experience.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Analytics Cookies</h4>
                <p className="text-gray-600 text-sm">
                  Help us understand how users interact with our platform. You can opt out of these cookies.
                </p>
              </div>
            </div>

            <h3 className="text-xl font-medium text-gray-800 mb-3">9.2 Managing Cookies</h3>
            <p className="text-gray-600">
              You can manage cookie preferences through your browser settings or our cookie consent tool. Note that 
              disabling certain cookies may affect platform functionality.
            </p>
          </section>

          {/* Your Rights */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Your Rights Under GDPR</h2>
            <p className="text-gray-600 mb-4">
              As a data subject in the EU, you have the following rights:
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right of Access (Art. 15)</h4>
                <p className="text-gray-600 text-sm">
                  Request a copy of all personal data we hold about you.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right to Rectification (Art. 16)</h4>
                <p className="text-gray-600 text-sm">
                  Request correction of inaccurate or incomplete data.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right to Erasure (Art. 17)</h4>
                <p className="text-gray-600 text-sm">
                  Request deletion of your personal data ("right to be forgotten").
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right to Restriction (Art. 18)</h4>
                <p className="text-gray-600 text-sm">
                  Request limitation of processing in certain circumstances.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right to Portability (Art. 20)</h4>
                <p className="text-gray-600 text-sm">
                  Receive your data in a structured, machine-readable format.
                </p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Right to Object (Art. 21)</h4>
                <p className="text-gray-600 text-sm">
                  Object to processing based on legitimate interests or for marketing.
                </p>
              </div>
            </div>

            <div className="mt-6 bg-[#001f98]/5 border border-[#001f98]/20 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">How to Exercise Your Rights</h4>
              <p className="text-gray-600 text-sm mb-2">
                You can exercise most rights through your account settings. For other requests, contact us at:
              </p>
              <p className="text-[#001f98] font-medium">privacy@{appName.toLowerCase()}.com</p>
              <p className="text-gray-600 text-sm mt-2">
                We will respond to your request within 30 days. If we cannot fulfill your request, we will explain why.
              </p>
            </div>
          </section>

          {/* Security */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Data Security</h2>
            <p className="text-gray-600 mb-4">
              We implement appropriate technical and organizational measures to protect your personal data:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication mechanisms</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and employee training</li>
              <li>Incident response procedures</li>
              <li>Regular backups with secure storage</li>
            </ul>
          </section>

          {/* Children */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Children's Privacy</h2>
            <p className="text-gray-600">
              Our Service is not intended for children under 16 years of age. We do not knowingly collect personal data 
              from children under 16. If you are a parent or guardian and believe your child has provided us with personal 
              data, please contact us immediately at privacy@{appName.toLowerCase()}.com.
            </p>
          </section>

          {/* Changes */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to This Policy</h2>
            <p className="text-gray-600 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Sending an email to your registered email address</li>
              <li>Displaying a prominent notice on our platform</li>
              <li>Updating the "Last updated" date at the top of this policy</li>
            </ul>
            <p className="text-gray-600 mt-4">
              We encourage you to review this policy periodically.
            </p>
          </section>

          {/* Complaints */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Complaints and Supervisory Authority</h2>
            <p className="text-gray-600 mb-4">
              If you believe we have not handled your personal data properly, you have the right to lodge a complaint 
              with a supervisory authority. In the EU, you can contact:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>The data protection authority in your country of residence</li>
              <li>The data protection authority where we are established</li>
              <li>The data protection authority where the alleged infringement occurred</li>
            </ul>
            <p className="text-gray-600 mt-4">
              We encourage you to contact us first at privacy@{appName.toLowerCase()}.com so we can try to resolve 
              your concern.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Us</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-700 font-medium mb-4">{appName} Privacy Team</p>
              <div className="space-y-2">
                <p className="text-gray-600">
                  <strong>Data Protection Officer:</strong> dpo@{appName.toLowerCase()}.com
                </p>
                <p className="text-gray-600">
                  <strong>Privacy Inquiries:</strong> privacy@{appName.toLowerCase()}.com
                </p>
                <p className="text-gray-600">
                  <strong>General Support:</strong> support@{appName.toLowerCase()}.com
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-[#001f98] font-medium">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Terms of Service
              </Link>
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Home
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
