"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";

export default function TermsPage() {
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  useEffect(() => {
    getAppConfig()
      .then((config) => setAppConfig(config))
      .catch(() => setAppConfig({ app_name: "Avee" }));
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            {appConfig.app_logo_url ? (
              <img
                src={appConfig.app_logo_url}
                alt={appConfig.app_name || "Logo"}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#001f98] to-[#3366cc] shadow-lg shadow-[#001f98]/25" />
            )}
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 group-hover:text-[#001f98] transition-colors">
                {appConfig.app_name || "Avee"}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#product" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Product
            </Link>
            <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              How it works
            </Link>
            <Link href="/#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex h-10 px-5 items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="h-10 px-6 inline-flex items-center justify-center rounded-full bg-[#001f98] text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 to-white py-20 lg:py-28">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#001f98]/10 rounded-full blur-[128px]" />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              Terms of Service
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Please read these terms carefully before using our platform.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Last updated: January 15, 2026
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="prose prose-lg max-w-none">
              
              {/* Agreement */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Agreement to Terms</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  By accessing or using {appConfig.app_name || "Avee"} ("Service"), you agree to be bound by these 
                  Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  These Terms apply to all visitors, users, and others who access or use the Service. By using the 
                  Service, you represent that you are at least 18 years of age, or if you are under 18, that you have 
                  your parent's or legal guardian's permission to use the Service.
                </p>
              </div>

              {/* Description of Service */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {appConfig.app_name || "Avee"} is an AI-powered platform that enables users to create, train, and 
                  deploy AI agents that can:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Engage in conversations on your behalf</li>
                  <li>Generate and schedule content</li>
                  <li>Interact with your audience</li>
                  <li>Learn from your knowledge base and content</li>
                </ul>
                <p className="text-gray-600 leading-relaxed mt-4">
                  The Service uses third-party AI providers (such as OpenAI) to power these capabilities. Your use 
                  of the Service is also subject to any applicable third-party terms and policies.
                </p>
              </div>

              {/* User Accounts */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  When you create an account with us, you must provide accurate, complete, and current information. 
                  Failure to do so constitutes a breach of the Terms.
                </p>
                <p className="text-gray-600 leading-relaxed mb-4">
                  You are responsible for:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Safeguarding your account password</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized access or use</li>
                </ul>
                <p className="text-gray-600 leading-relaxed mt-4">
                  We reserve the right to refuse service, terminate accounts, or remove content at our sole discretion.
                </p>
              </div>

              {/* AI Agents and Content */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. AI Agents and Content</h2>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">4.1 Your Responsibility</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  You are responsible for:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
                  <li>All content you provide to train your AI agents</li>
                  <li>All content generated by your AI agents</li>
                  <li>Configuring appropriate guardrails and approval workflows</li>
                  <li>Monitoring and moderating your agent's interactions</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">4.2 Content Guidelines</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  You agree not to use the Service to create agents that generate content that:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Violates any applicable law or regulation</li>
                  <li>Infringes on intellectual property rights</li>
                  <li>Is harmful, threatening, abusive, or harassing</li>
                  <li>Contains hate speech or promotes discrimination</li>
                  <li>Spreads misinformation or disinformation</li>
                  <li>Is deceptive or fraudulent</li>
                  <li>Impersonates others without disclosure</li>
                  <li>Contains malware or malicious code</li>
                </ul>
              </div>

              {/* Intellectual Property */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Intellectual Property</h2>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Your Content</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  You retain ownership of all content you provide to the Service. By uploading content, you grant 
                  us a non-exclusive, worldwide, royalty-free license to use, process, and store that content 
                  solely for the purpose of providing and improving the Service.
                </p>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 Our Service</h3>
                <p className="text-gray-600 leading-relaxed">
                  The Service and its original content (excluding user-provided content), features, and functionality 
                  are and will remain the exclusive property of {appConfig.app_name || "Avee"} and its licensors. 
                  You may not copy, modify, distribute, sell, or lease any part of our Service without our prior 
                  written consent.
                </p>
              </div>

              {/* Payment Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Payment Terms</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Certain features of the Service are offered on a subscription basis. By subscribing to a paid plan:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>You agree to pay all applicable fees as described on our pricing page</li>
                  <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
                  <li>Fees are non-refundable except as required by law</li>
                  <li>We may change our pricing with 30 days' notice</li>
                </ul>
                <p className="text-gray-600 leading-relaxed mt-4">
                  If you cancel your subscription, you will retain access to paid features until the end of your 
                  current billing period.
                </p>
              </div>

              {/* Disclaimers */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Disclaimers</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, 
                  EITHER EXPRESS OR IMPLIED.
                </p>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We do not warrant that:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>The Service will be uninterrupted, secure, or error-free</li>
                  <li>AI-generated content will be accurate, complete, or reliable</li>
                  <li>The Service will meet your specific requirements</li>
                  <li>Any errors in the Service will be corrected</li>
                </ul>
                <p className="text-gray-600 leading-relaxed mt-4">
                  AI-generated content may contain errors, inaccuracies, or inappropriate material. You are 
                  responsible for reviewing and approving content before publication.
                </p>
              </div>

              {/* Limitation of Liability */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, {(appConfig.app_name || "Avee").toUpperCase()} SHALL NOT 
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING 
                  WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Our total liability for any claims arising from or related to the Service shall not exceed the 
                  amount you paid us in the twelve (12) months preceding the claim.
                </p>
              </div>

              {/* Indemnification */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Indemnification</h2>
                <p className="text-gray-600 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless {appConfig.app_name || "Avee"} and its officers, 
                  directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, 
                  or expenses arising from: (a) your use of the Service; (b) content generated by your AI agents; 
                  (c) your violation of these Terms; or (d) your violation of any rights of a third party.
                </p>
              </div>

              {/* Termination */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Termination</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We may terminate or suspend your account immediately, without prior notice or liability, for any 
                  reason, including without limitation if you breach these Terms.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Upon termination, your right to use the Service will immediately cease. If you wish to terminate 
                  your account, you may simply discontinue using the Service or delete your account through the 
                  account settings.
                </p>
              </div>

              {/* Governing Law */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
                <p className="text-gray-600 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the State of 
                  Delaware, United States, without regard to its conflict of law provisions. Any disputes arising 
                  from these Terms or the Service shall be resolved in the courts located in Delaware.
                </p>
              </div>

              {/* Changes to Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
                <p className="text-gray-600 leading-relaxed">
                  We reserve the right to modify or replace these Terms at any time. If a revision is material, 
                  we will try to provide at least 30 days' notice prior to any new terms taking effect. What 
                  constitutes a material change will be determined at our sole discretion. By continuing to access 
                  or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                </p>
              </div>

              {/* Severability */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Severability</h2>
                <p className="text-gray-600 leading-relaxed">
                  If any provision of these Terms is held to be unenforceable or invalid, such provision will be 
                  changed and interpreted to accomplish the objectives of such provision to the greatest extent 
                  possible under applicable law, and the remaining provisions will continue in full force and effect.
                </p>
              </div>

              {/* Contact */}
              <div className="bg-gradient-to-br from-[#001f98]/5 to-[#3366cc]/5 border border-[#001f98]/20 rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Contact Us</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <ul className="text-gray-600 space-y-2">
                  <li><strong>Email:</strong> legal@avee.ai</li>
                  <li><strong>Address:</strong> {appConfig.app_name || "Avee"} Inc., Legal Department</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-4">
                {appConfig.app_logo_url ? (
                  <img
                    src={appConfig.app_logo_url}
                    alt={appConfig.app_name || "Logo"}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#001f98] to-[#3366cc]" />
                )}
                <span className="text-lg font-bold text-gray-900">{appConfig.app_name || "Avee"}</span>
              </Link>
              <p className="text-sm text-gray-500 max-w-xs">
                The AI-native social platform for creators. Build your digital twin and scale your presence.
              </p>
            </div>

            {[
              {
                title: "Product",
                links: [
                  { label: "Features", href: "/#product" },
                  { label: "Pricing", href: "/#pricing" },
                  { label: "Use cases", href: "/#use-cases" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About", href: "/about" },
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                ],
              },
            ].map((section, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">{section.title}</h4>
                <ul className="space-y-3">
                  {section.links.map((link, j) => (
                    <li key={j}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {appConfig.app_name || "Avee"}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
