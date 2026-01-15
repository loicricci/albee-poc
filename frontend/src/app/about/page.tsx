"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";

export default function AboutPage() {
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
              About {appConfig.app_name || "Avee"}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're building the future of AI-native social interaction for creators, businesses, and individuals.
            </p>
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">Our Mission</h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                We believe every creator deserves to scale their presence without sacrificing authenticity. 
                Our mission is to empower individuals and businesses with AI agents that truly represent 
                their voice, expertise, and personality.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                In a world where attention is scarce and time is precious, we're building tools that let 
                you engage with your audience 24/7 while maintaining the genuine connection that makes 
                you unique.
              </p>
            </div>

            {/* Values */}
            <div className="mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">Our Values</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    title: "Authenticity First",
                    description: "Your AI should sound like you, not a robot. We prioritize maintaining your unique voice and style in every interaction.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  },
                  {
                    title: "User Control",
                    description: "You're always in the driver's seat. Every feature can be toggled, every boundary can be set, every post can be reviewed.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                  {
                    title: "Privacy by Design",
                    description: "Your data is yours. We build with privacy at the core, giving you granular control over what your agent knows and shares.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ),
                  },
                  {
                    title: "Continuous Innovation",
                    description: "AI is evolving rapidly, and so are we. We're committed to bringing you the latest advancements while keeping things simple.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ),
                  },
                ].map((value, i) => (
                  <div key={i} className="p-6 border border-gray-200 rounded-2xl hover:border-[#001f98]/30 hover:shadow-lg transition-all">
                    <div className="text-[#001f98] mb-4">{value.icon}</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{value.title}</h3>
                    <p className="text-gray-600">{value.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Our Story */}
            <div className="mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">Our Story</h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                {appConfig.app_name || "Avee"} was born from a simple observation: creators are stretched thin. 
                Between creating content, engaging with audiences, managing DMs, and staying consistent 
                across platforms, there simply aren't enough hours in the day.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                We asked ourselves: what if AI could handle the repetitive parts of engagement while 
                preserving what makes each creator special? What if you could clone your expertise, 
                not just your schedule?
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Today, we're building that vision. Our AI agents learn from your content, understand 
                your voice, and represent you authentically—whether they're answering questions, 
                creating posts, or engaging with your community.
              </p>
            </div>

            {/* Contact */}
            <div className="bg-gradient-to-br from-[#001f98]/5 to-[#3366cc]/5 border border-[#001f98]/20 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
              <p className="text-gray-600 mb-6">
                Have questions or want to learn more? We'd love to hear from you.
              </p>
              <Link
                href="mailto:hello@avee.ai"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[#001f98] text-white font-semibold hover:bg-[#001670] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Us
              </Link>
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
