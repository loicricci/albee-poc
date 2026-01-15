"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";

// Brand Colors - Light Theme (matches app pages)
// Primary: #001f98 (Deep Navy), #3366cc (Light Blue), #001670 (Hover Navy)
// Supporting: #e6eaff (Light Blue BG), #64748b (Slate gray for secondary text)
// Backgrounds: white, #f8fafc (Soft gray), #e6eaff (Primary Light)

// FAQ Item component for accordion
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium text-gray-900 group-hover:text-[#001f98] transition-colors">
          {question}
        </span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 pb-6" : "max-h-0"}`}
      >
        <p className="text-gray-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// Cookie Consent Banner component
function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookieConsent = localStorage.getItem("cookieConsent");
    if (!cookieConsent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookieConsent", "accepted");
    localStorage.setItem("cookieConsentDate", new Date().toISOString());
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    localStorage.setItem("cookieConsentDate", new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-4xl">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-200/50 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Cookie icon and text */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#001f98]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">We value your privacy</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                By clicking "Accept All", you consent to our use of cookies.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Link
                href="/privacy"
                className="h-10 px-5 inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-[#001f98] border border-gray-200 rounded-full hover:border-[#001f98]/30 transition-all"
              >
                See more
              </Link>
              <button
                onClick={handleDecline}
                className="h-10 px-5 inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full hover:border-gray-300 transition-all"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptAll}
                className="h-10 px-6 inline-flex items-center justify-center rounded-full bg-[#001f98] text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [appConfig, setAppConfig] = useState<AppConfig>({});
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    getAppConfig()
      .then((config) => setAppConfig(config))
      .catch(() => setAppConfig({ app_name: "Avee" }));
  }, []);

  // Scroll spy for navigation
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["product", "how-it-works", "use-cases", "pricing"];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* ============================================ */}
      {/* 1. STICKY NAVIGATION */}
      {/* ============================================ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo */}
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
              <span className="text-[10px] text-gray-500 -mt-1 hidden sm:block">
                AI-native social for creators
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#product", label: "Product" },
              { href: "#how-it-works", label: "How it works" },
              { href: "#use-cases", label: "Use cases" },
              { href: "#pricing", label: "Pricing" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  activeSection === link.href.slice(1)
                    ? "text-[#001f98]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
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
        {/* ============================================ */}
        {/* 2. HERO SECTION */}
        {/* ============================================ */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
          {/* Gradient mesh background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#001f98]/10 rounded-full blur-[128px] animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#3366cc]/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(to right, #001f98 1px, transparent 1px), linear-gradient(to bottom, #001f98 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-20 pb-32 lg:pt-32 lg:pb-40">
            <div className="max-w-4xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-[#001f98]/10 border border-[#001f98]/30 px-4 py-1.5 text-sm font-medium text-[#001f98] mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#001f98] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#001f98]" />
                </span>
                Now in public beta
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                <span className="text-gray-900">
                  Meet the AI that runs
                </span>
                <br />
                <span className="bg-gradient-to-r from-[#001f98] via-[#3366cc] to-[#001f98] bg-clip-text text-transparent">
                  your creator presence.
                </span>
              </h1>

              {/* Subhead */}
              <p className="mt-8 text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Launch an agent that learns your content, chats with your audience
                (text + voice), and auto-posts with images—without losing your tone.
              </p>

              {/* CTAs */}
              <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/signup"
                  className="group h-14 px-8 inline-flex items-center justify-center rounded-full bg-[#001f98] text-lg font-semibold text-white shadow-xl shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
                >
                  Start free
                  <svg
                    className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <button className="h-14 px-8 inline-flex items-center justify-center rounded-full border border-gray-300 bg-white text-lg font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all duration-300">
                  <svg className="mr-2 w-5 h-5 text-[#001f98]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch 90-sec demo
                </button>
              </div>

              {/* Trust line */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  No credit card
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Launch in minutes
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Control what it can say
                </div>
              </div>
            </div>

            {/* Agent Card Mockup */}
            <div className="mt-20 max-w-4xl mx-auto">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-[#001f98]/20 via-[#3366cc]/20 to-[#001f98]/20 rounded-3xl blur-2xl opacity-60" />
                
                {/* Card */}
                <div className="relative bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-2xl shadow-gray-200/50">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-[#001f98] to-[#3366cc] flex items-center justify-center text-2xl font-bold text-white">
                      Y
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">Your AI Agent</h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Online</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Trained on your content • Speaks in your voice</p>
                      
                      {/* Chat preview */}
                      <div className="mt-4 space-y-3">
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-xl rounded-tl-none px-4 py-2 text-sm text-gray-700">
                            Hey! What's your best advice for growing on social?
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <div className="bg-[#001f98]/10 border border-[#001f98]/20 rounded-xl rounded-tr-none px-4 py-2 text-sm text-gray-700">
                            Consistency beats virality every time. Post daily, engage genuinely, and let your authentic voice shine through...
                            <span className="inline-block w-2 h-4 bg-[#001f98] ml-1 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats bar */}
                  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        1.2k chats
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        4.8k followers
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Always on
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 3. SOCIAL PROOF STRIP */}
        {/* ============================================ */}
        <section className="border-y border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
            <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
              {[
                { value: "30s", label: "to launch your agent" },
                { value: "24/7", label: "always-on replies" },
                { value: "∞", label: "scheduled posts" },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-3xl font-bold bg-gradient-to-r from-[#001f98] to-[#3366cc] bg-clip-text text-transparent">
                    {stat.value}
                  </span>
                  <span className="text-sm text-gray-600">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 4. PROBLEM FRAMING */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="product">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Consistency is the hard part.
              </h2>
              <p className="text-xl text-gray-600">
                You know what to do. You just don't have time to do it all.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "Posting takes time",
                  description: "Content ideas, writing, editing, scheduling. Every day. It never ends.",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "DMs pile up",
                  description: "Same questions, different people. You can't scale yourself.",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  ),
                  title: "Voice gets diluted",
                  description: "Outsource to a VA? They'll never capture your authentic tone.",
                },
              ].map((pain, i) => (
                <div
                  key={i}
                  className="group relative bg-white border border-gray-200 rounded-2xl p-8 hover:border-[#001f98]/30 hover:shadow-lg hover:shadow-[#001f98]/5 transition-all duration-300"
                >
                  <div className="text-[#001f98] mb-4">{pain.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{pain.title}</h3>
                  <p className="text-gray-600">{pain.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 5. SOLUTION PILLARS */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">The solution</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Your AI-native creator presence.
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Learn → Engage → Publish. One agent that handles it all.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  gradient: "from-[#001f98] to-[#3366cc]",
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ),
                  title: "Learn your world",
                  description: "Auto-research the web, import docs and links. Your agent builds knowledge in seconds.",
                  features: ["Web research", "Doc uploads", "Link imports"],
                },
                {
                  gradient: "from-[#001670] to-[#001f98]",
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  ),
                  title: "Engage your community",
                  description: "DMs, chat, even voice. Context-aware replies that feel like you, not a bot.",
                  features: ["Smart DMs", "Voice chat", "Context memory"],
                },
                {
                  gradient: "from-[#3366cc] to-[#001f98]",
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  ),
                  title: "Publish for you",
                  description: "Auto-generate posts with AI images. Schedule, review, or let it run on autopilot.",
                  features: ["AI images", "Scheduling", "Topic selection"],
                },
              ].map((pillar, i) => (
                <div
                  key={i}
                  className="group relative bg-white border border-gray-200 rounded-2xl p-8 hover:border-[#001f98]/30 hover:shadow-lg transition-all duration-300"
                >
                  <div
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${pillar.gradient} text-white mb-6 shadow-lg`}
                  >
                    {pillar.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{pillar.title}</h3>
                  <p className="text-gray-600 mb-6">{pillar.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {pillar.features.map((feature, j) => (
                      <span
                        key={j}
                        className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 6. HOW IT WORKS */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="how-it-works">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">How it works</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Three steps. That's it.
              </h2>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <div className="space-y-12">
                  {[
                    {
                      step: "1",
                      title: "Create your agent",
                      description: "Give it a name, set the tone, define its expertise. Takes 30 seconds.",
                      color: "#001f98",
                    },
                    {
                      step: "2",
                      title: "Add knowledge fast",
                      description: "Turn on auto web research, upload docs, or paste links. Your agent learns instantly.",
                      color: "#3366cc",
                    },
                    {
                      step: "3",
                      title: "Turn on growth loops",
                      description: "Enable auto-posting, set topics, configure DM handling. Then sit back.",
                      color: "#001670",
                    },
                  ].map((item, i) => (
                    <div key={i} className="relative flex gap-8">
                      {/* Step number */}
                      <div
                        className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold z-10"
                        style={{
                          backgroundColor: `${item.color}15`,
                          borderColor: `${item.color}30`,
                          borderWidth: "1px",
                          color: item.color,
                        }}
                      >
                        {item.step}
                      </div>
                      {/* Content */}
                      <div className="flex-1 pt-2">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-lg text-gray-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Control callout */}
              <div className="mt-16 p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#001f98]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">You're always in control</h4>
                  <p className="text-gray-600">
                    Enable approval mode to review posts before they go live. Set guardrails for what topics your agent can discuss. Turn features on/off anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 7. FEATURE DEEP-DIVES */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-20">
              <p className="text-[#001f98] font-medium mb-4">Features</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
                Everything you need to scale.
              </h2>
            </div>

            <div className="space-y-24">
              {/* Feature 1: Instant Agent Creation */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001f98]/10 border border-[#001f98]/30 rounded-full text-sm text-[#001f98] mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Lightning fast
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Instant Agent Creation
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Go from blank to knowledgeable in 30–90 seconds. Our auto-research crawls the web, pulls relevant info, and trains your agent automatically.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Auto web research from Wikipedia, news, blogs",
                      "Topic-based bootstrap—just enter your niche",
                      "Continuous updates to keep knowledge fresh",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#001f98]/10 to-[#3366cc]/10 rounded-3xl blur-2xl opacity-50" />
                  <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="space-y-3 font-mono text-sm">
                      <p className="text-gray-400">$ Creating agent...</p>
                      <p className="text-[#3366cc]">→ Researching "digital marketing"...</p>
                      <p className="text-green-400">✓ Found 12 relevant sources</p>
                      <p className="text-[#001f98]">→ Training on 847 knowledge chunks...</p>
                      <p className="text-green-400">✓ Agent ready in 42 seconds</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2: Autonomous Content */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1 relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#001670]/10 to-[#001f98]/10 rounded-3xl blur-2xl opacity-50" />
                  <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Scheduled Post</span>
                      <span className="text-xs text-gray-500">Tomorrow, 9:00 AM</span>
                    </div>
                    <div className="p-4">
                      <div className="aspect-video bg-gradient-to-br from-[#001f98]/20 to-[#3366cc]/20 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-6xl">🎨</span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        "5 underrated tools every creator should know about in 2025. Thread incoming... 🧵"
                      </p>
                      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                        <span>AI-generated image</span>
                        <span>•</span>
                        <span>Topic: Productivity</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001670]/10 border border-[#001670]/30 rounded-full text-sm text-[#001670] mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    AI-powered
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Autonomous Content + AI Images
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Posts that look native to your brand. Select topics, set the schedule, and let your agent create engaging content with AI-generated images.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "DALL-E 3 integration for stunning visuals",
                      "Topic-based content generation",
                      "Smart scheduling based on engagement data",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Feature 3: Messaging */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#3366cc]/10 border border-[#3366cc]/30 rounded-full text-sm text-[#001f98] mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Always-on
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Messaging that Scales You
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Your inbox, handled—without sounding robotic. Context-aware replies that remember past conversations and route complex queries to you.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Semantic memory across all conversations",
                      "Read status and real-time updates",
                      "Smart escalation when human needed",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#3366cc]/10 to-[#001f98]/10 rounded-3xl blur-2xl opacity-50" />
                  <div className="relative bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
                    <div className="space-y-4">
                      {[
                        { from: "user", text: "How do I get started with content creation?" },
                        { from: "agent", text: "Great question! Based on your interests, I'd recommend starting with short-form video. Here's why..." },
                        { from: "user", text: "Can I schedule a call with you?" },
                        { from: "agent", text: "I'm an AI assistant, but I can connect you with [Creator] directly! Want me to set that up?", escalate: true },
                      ].map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                              msg.from === "agent"
                                ? "bg-gray-100 text-gray-700 rounded-tl-none"
                                : "bg-[#001f98] text-white rounded-tr-none"
                            }`}
                          >
                            {msg.text}
                            {msg.escalate && (
                              <span className="block mt-2 text-xs text-[#001f98]">
                                ↳ Escalation suggested
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 4: Voice */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1 relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#001f98]/10 to-[#001670]/10 rounded-3xl blur-2xl opacity-50" />
                  <div className="relative bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-center shadow-xl">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#001f98] to-[#3366cc] mb-6">
                        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">Voice: Nova</p>
                      <div className="mt-4 flex items-center justify-center gap-1">
                        {[16, 24, 12, 28, 18, 22, 14, 26, 20, 10, 24, 16, 28, 12, 22, 18, 26, 14, 20, 24].map((h, i) => (
                          <div
                            key={i}
                            className="w-1 bg-gradient-to-t from-[#001f98] to-[#3366cc] rounded-full animate-pulse"
                            style={{
                              height: `${h}px`,
                              animationDelay: `${i * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001f98]/10 border border-[#001f98]/30 rounded-full text-sm text-[#001f98] mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Voice-enabled
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Voice Conversations
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Talk to your agent like a co-host. Voice input with Whisper, natural responses with multiple TTS voices.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Whisper-powered speech recognition",
                      "6 natural voice options (alloy, echo, fable...)",
                      "Perfect for audio-first creators",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Feature 5: Privacy Layers */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001670]/10 border border-[#001670]/30 rounded-full text-sm text-[#001670] mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Privacy-first
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Privacy Layers
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Different audiences, different boundaries. Control what your agent reveals based on relationship level.
                  </p>
                  <div className="space-y-4">
                    {[
                      { level: "Public", desc: "General knowledge for everyone", color: "#64748b" },
                      { level: "Friends", desc: "Deeper insights for followers", color: "#3366cc" },
                      { level: "Intimate", desc: "Full access for inner circle", color: "#001f98" },
                    ].map((layer, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: layer.color }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{layer.level}</p>
                          <p className="text-sm text-gray-500">{layer.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#001670]/10 to-[#001f98]/10 rounded-3xl blur-2xl opacity-50" />
                  <div className="relative bg-white border border-gray-200 rounded-2xl p-8 shadow-xl">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#001670] to-[#001f98] mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">You set the boundaries</h4>
                      <p className="text-gray-500 text-sm">
                        Your content. Your rules. Scale interaction without sacrificing privacy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 8. USE CASES GRID */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="use-cases">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">Use cases</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Built for how creators work.
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: "📥",
                  title: "Inbox Co-pilot",
                  description: "Triage DMs, draft replies, escalate when needed. Never miss an important message.",
                },
                {
                  icon: "📅",
                  title: "Daily Posting Engine",
                  description: "Auto-generate posts from topics. Schedule a week ahead in minutes.",
                },
                {
                  icon: "💬",
                  title: "Community Companion",
                  description: "24/7 engagement with your audience. Answer questions while you sleep.",
                },
                {
                  icon: "🧠",
                  title: "Knowledge Persona",
                  description: "Your expertise, always available. Perfect for educators and consultants.",
                },
              ].map((useCase, i) => (
                <div
                  key={i}
                  className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#001f98]/30 hover:shadow-lg hover:shadow-[#001f98]/5 transition-all duration-300"
                >
                  <div className="text-4xl mb-4">{useCase.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                  <p className="text-gray-600 text-sm">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 9. DEMO BAND */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                See it in action.
              </h2>
              <p className="text-lg text-gray-600">
                Watch how creators are using Avee to scale their presence.
              </p>
            </div>

            {/* Video placeholder */}
            <div className="relative aspect-video bg-gray-900 border border-gray-200 rounded-2xl overflow-hidden group cursor-pointer shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-[#001f98]/20 to-[#3366cc]/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-sm text-gray-300">
                <span>Demo: Create to publish in 2 minutes</span>
                <span>2:34</span>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 h-14 px-8 rounded-full bg-[#001f98] text-lg font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
              >
                Start free
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 10. PRICING */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="pricing">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">Pricing</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Simple, creator-friendly pricing.
              </h2>
              <p className="text-lg text-gray-600">
                Start free. Scale when you're ready.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Free */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Free</h3>
                <p className="text-gray-500 text-sm mb-6">Perfect for getting started</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["1 agent", "Basic chat", "5 posts/month", "Community support"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block w-full h-12 flex items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all"
                >
                  Get started
                </Link>
              </div>

              {/* Creator - Featured */}
              <div className="relative bg-gradient-to-b from-[#001f98]/5 to-[#3366cc]/5 border-2 border-[#001f98]/30 rounded-2xl p-8">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#001f98] to-[#3366cc] rounded-full text-xs font-semibold text-white">
                  Most popular
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Creator</h3>
                <p className="text-gray-500 text-sm mb-6">For serious creators</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "3 agents",
                    "Unlimited chat + voice",
                    "50 posts/month with AI images",
                    "Auto-scheduling",
                    "Priority support",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block w-full h-12 flex items-center justify-center rounded-full bg-[#001f98] text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 transition-all"
                >
                  Start free trial
                </Link>
              </div>

              {/* Pro */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
                <p className="text-gray-500 text-sm mb-6">For teams and agencies</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Unlimited agents",
                    "Everything in Creator",
                    "Multi-agent orchestration",
                    "Advanced analytics",
                    "Dedicated support",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block w-full h-12 flex items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all"
                >
                  Contact sales
                </Link>
              </div>
            </div>

            {/* AI usage note */}
            <div className="mt-12 max-w-2xl mx-auto text-center">
              <p className="text-sm text-gray-500">
                💡 <strong className="text-gray-700">Transparent AI costs:</strong> We optimize API usage so you don't have to worry. GPT-4o-mini keeps costs low without sacrificing quality.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 11. TRUST & SAFETY */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#001f98]/10 mb-6">
                <svg className="w-8 h-8 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                You control the agent.
              </h2>
              <p className="text-lg text-gray-600 mb-12">
                Built with safety and control at the core.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 text-left">
                {[
                  {
                    title: "Approval modes",
                    description: "Review posts before they go live. Full control over what gets published.",
                  },
                  {
                    title: "Guardrails",
                    description: "Set topic boundaries. Your agent stays on-brand and on-topic.",
                  },
                  {
                    title: "Privacy layers",
                    description: "Control what different audiences can access. Your boundaries, enforced.",
                  },
                  {
                    title: "Kill switch",
                    description: "Disable any feature instantly. You're always in the driver's seat.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl">
                    <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 12. FAQ ACCORDION */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                Frequently asked questions
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              <FAQItem
                question="Will it sound like me?"
                answer="Yes! Your agent is trained on your content and uses your writing style. You can fine-tune the tone, adjust personality traits, and set specific phrases to use or avoid. Most users say their agents sound 90%+ like them."
              />
              <FAQItem
                question="Can I approve posts before publishing?"
                answer="Absolutely. Enable approval mode and every post goes to your review queue before going live. You can edit, approve, or reject. When you're confident, switch to autopilot mode."
              />
              <FAQItem
                question="What sources does it use?"
                answer="Your agent learns from web research (Wikipedia, news, blogs), any docs you upload, and links you provide. You control what goes in. We never train on your private messages without explicit permission."
              />
              <FAQItem
                question="Can it handle sensitive topics?"
                answer="You set the guardrails. Define topics your agent should avoid, and it will gracefully redirect those conversations. For sensitive queries, it can escalate to you directly."
              />
              <FAQItem
                question="How do voice and DMs work?"
                answer="Voice uses OpenAI's Whisper for speech-to-text and their TTS for responses. DMs are handled through our platform—your agent responds contextually while maintaining conversation history across sessions."
              />
              <FAQItem
                question="Can I turn features off anytime?"
                answer="Yes. Every feature (auto-posting, DM handling, voice) can be toggled independently. Disable anything instantly from your dashboard. No lock-in, no commitment."
              />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 13. FINAL CTA */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#001f98] via-[#001670] to-[#0E2A47]" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />

              <div className="relative px-8 py-20 lg:py-28 text-center">
                <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                  Start free. Meet your AI twin today.
                </h2>
                <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                  Join creators who are building AI versions of themselves. Takes minutes. No credit card required.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link
                    href="/signup"
                    className="group h-14 px-8 inline-flex items-center justify-center rounded-full bg-white text-lg font-semibold text-[#001f98] shadow-xl hover:bg-gray-100 hover:scale-105 transition-all duration-300"
                  >
                    Start free
                    <svg
                      className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <button className="h-14 px-8 inline-flex items-center justify-center rounded-full border-2 border-white/30 text-lg font-medium text-white hover:border-white/50 hover:bg-white/10 transition-all duration-300">
                    Watch demo
                  </button>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    No credit card
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cancel anytime
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 14. FOOTER */}
        {/* ============================================ */}
        <footer className="border-t border-gray-200 py-16 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Logo */}
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

              {/* Links */}
              {[
                {
                  title: "Product",
                  links: [
                    { label: "Features", href: "#product" },
                    { label: "Pricing", href: "#pricing" },
                    { label: "Use cases", href: "#use-cases" },
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

            {/* Bottom */}
            <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                © {new Date().getFullYear()} {appConfig.app_name || "Avee"}. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                {/* Social icons */}
                <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Cookie Consent Banner */}
      <CookieBanner />
    </div>
  );
}
