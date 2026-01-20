"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";

// Brand Colors - Light Theme (matches app pages)
// Primary: #001f98 (Deep Navy), #3366cc (Light Blue), #001670 (Hover Navy)
// Supporting: #e6eaff (Light Blue BG), #64748b (Slate gray for secondary text)
// Backgrounds: white, #f8fafc (Soft gray), #e6eaff (Primary Light)

// Cookie Consent Banner component
function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem("cookieConsent");
    if (!cookieConsent) {
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

export default function AppV3() {
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
      const sections = ["what-is-avee", "how-it-works", "for-individuals", "for-businesses", "what-makes-different", "pricing"];
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
          <Link href="/v2" className="flex items-center gap-3 group">
            {appConfig.app_logo_url ? (
              <img
                src={appConfig.app_logo_url}
                alt={appConfig.app_name || "Logo"}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#001f98] to-[#3366cc] shadow-lg shadow-[#001f98]/25" />
            )}
            <span className="text-lg font-bold text-gray-900 group-hover:text-[#001f98] transition-colors">
              {appConfig.app_name || "Avee"}
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#what-is-avee", label: "What is Avee" },
              { href: "#how-it-works", label: "How it works" },
              { href: "#for-individuals", label: "For individuals" },
              { href: "#for-businesses", label: "For businesses" },
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
              Create your agent
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
                Your personal agent
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                <span className="text-gray-900">
                  Your personal agent,
                </span>
                <br />
                <span className="bg-gradient-to-r from-[#001f98] via-[#3366cc] to-[#001f98] bg-clip-text text-transparent">
                  online.
                </span>
              </h1>

              {/* Subhead */}
              <p className="mt-8 text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Avee manages online interactions for people and businesses — messages, posts, and repetitive questions — so you don't have to be everywhere.
              </p>

              {/* CTAs */}
              <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/signup"
                  className="group h-14 px-8 inline-flex items-center justify-center rounded-full bg-[#001f98] text-lg font-semibold text-white shadow-xl shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
                >
                  Create your personal agent
                  <svg
                    className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="#how-it-works"
                  className="h-14 px-8 inline-flex items-center justify-center rounded-full border border-gray-300 bg-white text-lg font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all duration-300"
                >
                  <svg className="mr-2 w-5 h-5 text-[#001f98]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  See how it works
                </a>
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
                      A
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">Your Personal Agent</h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Handling your interactions • Always available</p>
                      
                      {/* Chat preview */}
                      <div className="mt-4 space-y-3">
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-xl rounded-tl-none px-4 py-2 text-sm text-gray-700">
                            Hi! What services do you offer?
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <div className="bg-[#001f98]/10 border border-[#001f98]/20 rounded-xl rounded-tr-none px-4 py-2 text-sm text-gray-700">
                            Thanks for reaching out! I specialize in digital marketing and brand strategy. Would you like to know more about any specific service?
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
                        Messages handled
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Posts published
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
        {/* 3. WHAT IS AVEE */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="what-is-avee">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">What is Avee?</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Avee is a personal agent.
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                It acts on your behalf online.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {[
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "Answer common questions",
                  description: "Your agent handles repetitive questions automatically, so you don't have to answer the same thing twice.",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "Handle messages",
                  description: "From inquiries to follow-ups, your agent manages conversations on your behalf.",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  ),
                  title: "Post updates",
                  description: "Keep your audience engaged with regular content, even when you're busy doing other things.",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "Stay active when you're offline",
                  description: "Your agent never sleeps. It maintains your presence 24/7.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group relative bg-white border border-gray-200 rounded-2xl p-8 hover:border-[#001f98]/30 hover:shadow-lg hover:shadow-[#001f98]/5 transition-all duration-300"
                >
                  <div className="text-[#001f98] mb-4">{item.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Control callout */}
            <div className="max-w-3xl mx-auto">
              <div className="p-8 bg-gradient-to-br from-[#001f98]/5 to-[#3366cc]/5 border border-[#001f98]/10 rounded-2xl text-center">
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
                  You stay in control.
                </h3>
                <p className="text-lg text-gray-600">
                  You step in only when it matters.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 4. HOW IT WORKS */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50" id="how-it-works">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">How it works</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Three simple steps.
              </h2>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <div className="space-y-16">
                  {[
                    {
                      step: "1",
                      title: "Create your agent",
                      description: "Define what your agent knows, how it speaks, and what it can handle.",
                      color: "#001f98",
                      details: ["Set your agent's personality and tone", "Define its areas of expertise", "Configure what topics it can discuss"],
                    },
                    {
                      step: "2",
                      title: "Let it interact",
                      description: "Your agent replies to messages, answers questions, and posts updates.",
                      color: "#3366cc",
                      details: ["Automatic message responses", "Content scheduling and publishing", "Consistent voice across all interactions"],
                    },
                    {
                      step: "3",
                      title: "Take over when needed",
                      description: "Important or sensitive conversations are routed to you.",
                      color: "#001670",
                      details: ["Smart escalation for complex queries", "Full visibility into all interactions", "Seamless handoff when you step in"],
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
                        <p className="text-lg text-gray-600 mb-4">{item.description}</p>
                        <ul className="space-y-2">
                          {item.details.map((detail, j) => (
                            <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                              <svg className="w-4 h-4 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 5. FOR INDIVIDUALS */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="for-individuals">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001f98]/10 border border-[#001f98]/30 rounded-full text-sm text-[#001f98] mb-6">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  For individuals
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  A personal agent for people with an online presence
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  If you receive too many messages, the same questions again and again, or feel pressure to stay visible — your personal agent handles it.
                </p>

                <div className="mb-8">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">If you receive:</h4>
                  <div className="space-y-3">
                    {[
                      "Too many messages",
                      "The same questions again and again",
                      "Pressure to stay visible",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">You get:</h4>
                  <div className="space-y-3">
                    {[
                      "Fewer interruptions",
                      "More consistency",
                      "Presence without constant availability",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#001f98]/10 to-[#3366cc]/10 rounded-3xl blur-2xl opacity-50" />
                <div className="relative bg-white border border-gray-200 rounded-2xl p-8 shadow-xl">
                  <div className="space-y-6">
                    {/* Message notifications */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#001f98]/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">42 messages handled</p>
                          <p className="text-sm text-gray-500">This week by your agent</p>
                        </div>
                      </div>
                      <span className="text-green-500 text-sm font-medium">Auto-replied</span>
                    </div>

                    {/* Time saved */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#3366cc]/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#3366cc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">3.5 hours saved</p>
                          <p className="text-sm text-gray-500">Your time, back to you</p>
                        </div>
                      </div>
                    </div>

                    {/* Posts published */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#001670]/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#001670]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">7 posts published</p>
                          <p className="text-sm text-gray-500">Consistent presence maintained</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 6. FOR BUSINESSES */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gray-50" id="for-businesses">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#001670]/10 to-[#001f98]/10 rounded-3xl blur-2xl opacity-50" />
                <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-gray-700">Business Agent Active</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* Task 1 */}
                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <svg className="w-5 h-5 text-[#001f98] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Answered inbound question</p>
                          <p className="text-xs text-gray-500">Product pricing inquiry • 2 min ago</p>
                        </div>
                      </div>

                      {/* Task 2 */}
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Handled support conversation</p>
                          <p className="text-xs text-gray-500">Order status check • 15 min ago</p>
                        </div>
                      </div>

                      {/* Task 3 */}
                      <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Posted announcement</p>
                          <p className="text-xs text-gray-500">New feature release • 1 hour ago</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#001670]/10 border border-[#001670]/30 rounded-full text-sm text-[#001670] mb-6">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  For businesses
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  A personal agent for teams and brands
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  For businesses, Avee becomes a first line of interaction, a consistent voice, and an always-available agent.
                </p>

                <div className="mb-8">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Your agent can:</h4>
                  <div className="space-y-3">
                    {[
                      "Answer inbound questions",
                      "Handle basic support and sales conversations",
                      "Post updates and announcements",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-[#001f98]/5 border border-[#001f98]/10 rounded-xl">
                  <p className="text-lg font-medium text-gray-900">
                    Your team focuses on higher-value work.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 7. WHAT MAKES AVEE DIFFERENT */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white" id="what-makes-different">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-[#001f98] font-medium mb-4">What makes Avee different</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Built for real interaction.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {[
                {
                  title: "One agent, not many tools",
                  description: "A unified solution that handles messages, posts, and questions in one place.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  ),
                },
                {
                  title: "Works for people and businesses",
                  description: "Whether you're an individual creator or a team, Avee adapts to your needs.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  ),
                },
                {
                  title: "Always on, but under your control",
                  description: "Your agent works 24/7, but you set the rules and boundaries.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ),
                },
                {
                  title: "Handles repetition, not decisions",
                  description: "Your agent takes care of routine interactions, leaving important decisions to you.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ),
                },
                {
                  title: "Escalates when a human is needed",
                  description: "Smart routing ensures sensitive or complex conversations reach you directly.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
                {
                  title: "Avee does not replace you",
                  description: "It handles interaction. You handle what matters.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#001f98]/30 hover:shadow-lg hover:shadow-[#001f98]/5 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#001f98]/10 flex items-center justify-center text-[#001f98] mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 8. CONTROL AND TRUST */}
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
                Control and trust
              </h2>
              <p className="text-lg text-gray-600 mb-12">
                You decide how your agent operates.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 text-left mb-12">
                {[
                  {
                    title: "What your agent can say",
                    description: "Define the topics, tone, and information your agent is allowed to share.",
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    ),
                  },
                  {
                    title: "What it cannot answer",
                    description: "Set boundaries for sensitive topics or information that should remain private.",
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ),
                  },
                  {
                    title: "When it should escalate",
                    description: "Configure when conversations need your personal attention.",
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ),
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-[#001f98]/10 flex items-center justify-center text-[#001f98] flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-gradient-to-br from-[#001f98]/5 to-[#3366cc]/5 border border-[#001f98]/10 rounded-2xl">
                <p className="text-xl lg:text-2xl font-medium text-gray-900 mb-2">
                  Your voice stays yours.
                </p>
                <p className="text-lg text-gray-600">
                  Your agent follows your rules.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 9. SIMPLE PROMISE */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Simple promise
            </h2>
            <p className="text-2xl lg:text-3xl text-gray-600 leading-relaxed">
              <span className="text-[#001f98] font-semibold">Avee handles online interaction.</span>
              <br />
              <span className="text-gray-900 font-semibold">You handle what matters.</span>
            </p>
          </div>
        </section>

        {/* ============================================ */}
        {/* 10. DEMO VIDEO */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                See it in action.
              </h2>
              <p className="text-lg text-gray-600">
                Watch how Avee manages online interactions for you.
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

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/signup"
                className="group h-14 px-8 inline-flex items-center justify-center rounded-full bg-[#001f98] text-lg font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
              >
                Start free
                <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </div>
        </section>

        {/* ============================================ */}
        {/* 11. PRICING */}
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

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
              {/* Free */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Free</h3>
                <p className="text-gray-500 text-sm mb-6">Perfect for getting started</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
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
                  className="block w-full h-12 flex items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all mt-auto"
                >
                  Get started
                </Link>
              </div>

              {/* Starter - Featured (Most Popular) */}
              <div className="relative bg-gradient-to-b from-[#001f98]/5 to-[#3366cc]/5 border-2 border-[#001f98]/30 rounded-2xl p-8 flex flex-col">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#001f98] to-[#3366cc] rounded-full text-xs font-semibold text-white">
                  Most popular
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
                <p className="text-gray-500 text-sm mb-6">For growing creators</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$14</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "1 agent",
                    "Unlimited chat + voice",
                    "20 posts/month with AI images",
                    "Auto-scheduling",
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
                  className="block w-full h-12 flex items-center justify-center rounded-full bg-[#001f98] text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 hover:shadow-[#001f98]/40 transition-all mt-auto"
                >
                  Start free trial
                </Link>
              </div>

              {/* Creator */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Creator</h3>
                <p className="text-gray-500 text-sm mb-6">For serious creators</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "3 agents",
                    "Unlimited chat + voice",
                    "50 posts/month with AI images",
                    "Auto-scheduling",
                    "Priority support",
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
                  className="block w-full h-12 flex items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all mt-auto"
                >
                  Start free trial
                </Link>
              </div>

              {/* Pro */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
                <p className="text-gray-500 text-sm mb-6">For teams and agencies</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "15 agents",
                    "300 posts/month with AI images",
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
                  className="block w-full h-12 flex items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#001f98] hover:text-[#001f98] transition-all mt-auto"
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
        {/* 12. CLOSING CTA */}
        {/* ============================================ */}
        <section className="py-24 lg:py-32 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#001f98] via-[#001670] to-[#0E2A47]" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />

              <div className="relative px-8 py-20 lg:py-28 text-center">
                <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                  Be present without being everywhere.
                </h2>
                <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                  Create your personal agent and let it handle your online interactions while you focus on what matters most.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link
                    href="/signup"
                    className="group h-14 px-8 inline-flex items-center justify-center rounded-full bg-white text-lg font-semibold text-[#001f98] shadow-xl hover:bg-gray-100 hover:scale-105 transition-all duration-300"
                  >
                    Create your personal agent
                    <svg
                      className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <a
                    href="#how-it-works"
                    className="h-14 px-8 inline-flex items-center justify-center rounded-full border-2 border-white/30 text-lg font-medium text-white hover:border-white/50 hover:bg-white/10 transition-all duration-300"
                  >
                    <svg className="mr-2 w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    See how it works
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 13. FOOTER */}
        {/* ============================================ */}
        <footer className="border-t border-gray-200 py-16 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Logo */}
              <div className="col-span-2">
                <Link href="/v2" className="flex items-center gap-3 mb-4">
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
                  Your personal agent, online. Avee manages interactions so you don't have to be everywhere.
                </p>
              </div>

              {/* Links */}
              {[
                {
                  title: "Product",
                  links: [
                    { label: "What is Avee", href: "#what-is-avee" },
                    { label: "How it works", href: "#how-it-works" },
                    { label: "For individuals", href: "#for-individuals" },
                    { label: "For businesses", href: "#for-businesses" },
                    { label: "Pricing", href: "#pricing" },
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
