"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppConfig, type AppConfig } from "@/lib/config";
import dynamic from "next/dynamic";

// Dynamically import ParticleSphere to avoid SSR issues with Three.js
const ParticleSphere = dynamic(() => import("@/components/ParticleSphere"), {
  ssr: false,
});

export default function OldLanding() {
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  useEffect(() => {
    getAppConfig()
      .then((config) => {
        console.log("[Landing] App config loaded:", config);
        setAppConfig(config);
      })
      .catch((error) => {
        console.warn("App config not available:", error);
        setAppConfig({ app_name: "Avee" });
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#FAFAFA] to-white font-sans dark:from-[#0B0B0C] dark:via-[#0F0F10] dark:to-[#0B0B0C]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-[#E6E6E6]/50 dark:bg-[#0B0B0C]/80 dark:border-white/[.06]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-all duration-300 hover:opacity-70">
            {appConfig.app_logo_url && appConfig.app_logo_url.trim() !== "" ? (
              <>
                <img src={appConfig.app_logo_url} 
                  alt={appConfig.app_name || "Logo"}
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    console.error("Failed to load logo on landing page");
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="text-xl font-bold tracking-tight text-[#0B0B0C] dark:text-white">
                  {appConfig.app_name || "AGENT"}
                </div>
              </>
            ) : (
              <>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg dark:from-white dark:to-zinc-200" />
                <div className="text-xl font-bold tracking-tight text-[#0B0B0C] dark:text-white">
                  {appConfig.app_name || "AGENT"}
                </div>
              </>
            )}
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="h-11 px-6 inline-flex items-center justify-center rounded-full text-sm font-semibold text-[#0B0B0C] transition-all duration-300
                         hover:text-[#2E3A59] hover:bg-[#E6E6E6]/50 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/[.08]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="h-11 px-7 inline-flex items-center justify-center rounded-full bg-[#2E3A59] text-sm font-semibold text-white 
                         transition-all duration-300 hover:bg-[#1a2236] hover:scale-105 shadow-lg hover:shadow-xl
                         dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pb-24">
        {/* Hero with Video Background */}
        <div className="relative overflow-hidden">
          {/* Background Video Container */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white dark:via-[#0B0B0C]/60 dark:to-[#0B0B0C] z-10" />
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-50 dark:opacity-35"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            >
              <source src="/hero-video.mp4" type="video/mp4" />
              <source src="/hero-video.webm" type="video/webm" />
              {/* Fallback image if video fails to load */}
              <img src="/hero-fallback.jpg"
                    loading="lazy"
                    decoding="async" 
                alt="Hero background"
                className="w-full h-full object-cover"
              />
            </video>
          </div>

          {/* Particle Sphere Animation */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            <div className="w-[600px] h-[600px] max-w-full">
              <ParticleSphere />
            </div>
          </div>

          {/* Hero Content */}
          <div className="relative z-20 mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-32">
            <div className="max-w-6xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#2E3A59]/5 border border-[#2E3A59]/10 px-5 py-2 text-sm font-medium text-[#2E3A59] dark:bg-white/[.03] dark:border-white/[.08] dark:text-zinc-300 mb-8 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E3A59] opacity-75 dark:bg-white"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E3A59] dark:bg-white"></span>
                </span>
                AI native social platform
              </div>
              
              <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.05] font-bold tracking-tight text-[#0B0B0C] dark:text-white drop-shadow-sm">
                Avee set you free
              </h1>
              
              <h2 className="mt-8 text-4xl md:text-5xl lg:text-6xl leading-[1.1] font-bold tracking-tight text-[#2E3A59] dark:text-zinc-400 drop-shadow-sm">
                The future of social interaction is here
              </h2>

              <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:justify-center sm:items-center">
                <Link
                  href="/signup"
                  className="group h-16 px-10 inline-flex items-center justify-center rounded-full bg-[#2E3A59] text-lg font-semibold text-white 
                             transition-all duration-300 hover:bg-[#1a2236] hover:scale-105 shadow-xl hover:shadow-2xl
                             dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-[#E6E6E6]"
                >
                  Create your AI
                  <svg className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>

                <Link
                  href="/login"
                  className="h-16 px-10 inline-flex items-center justify-center rounded-full border-2 border-[#E6E6E6] bg-white/50 backdrop-blur-sm text-lg font-semibold text-[#0B0B0C] 
                             transition-all duration-300 hover:border-[#2E3A59] hover:bg-white/80 hover:scale-105
                             dark:border-white/[.20] dark:bg-[#0B0B0C]/50 dark:text-white dark:hover:border-white/[.30] dark:hover:bg-[#0B0B0C]/70"
                >
                  Explore creators
                </Link>
              </div>

              <div className="mt-14 flex items-center justify-center gap-8 text-sm text-[#2E3A59]/70 dark:text-zinc-500">
                <div className="flex items-center gap-2 backdrop-blur-sm bg-white/30 dark:bg-[#0B0B0C]/30 px-4 py-2 rounded-full">
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Automatised messaging
                </div>
                <div className="flex items-center gap-2 backdrop-blur-sm bg-white/30 dark:bg-[#0B0B0C]/30 px-4 py-2 rounded-full">
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  AI boosted content creation
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition Section - Ultra Premium */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 -mt-20">
          <div className="relative max-w-6xl mx-auto">
            {/* Multi-layered glow effects */}
            <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-br from-[#2E3A59]/20 via-[#C8A24A]/10 to-[#2E3A59]/20 opacity-60 blur-3xl animate-pulse" />
            <div className="absolute -inset-2 rounded-[3rem] bg-gradient-to-tr from-[#C8A24A]/15 to-transparent opacity-40 blur-2xl" />
            
            {/* Main card with premium glass effect */}
            <div className="relative border-[3px] border-[#E6E6E6]/80 dark:border-white/[.15] rounded-[2.5rem] 
                            bg-gradient-to-br from-white via-white to-[#f8f8f8] dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900
                            backdrop-blur-2xl p-14 lg:p-20 
                            shadow-[0_8px_30px_rgb(0,0,0,0.12),0_20px_60px_rgb(0,0,0,0.08)] 
                            dark:shadow-[0_8px_30px_rgb(0,0,0,0.5),0_20px_60px_rgb(0,0,0,0.3)]
                            transition-all duration-700 hover:shadow-[0_8px_40px_rgb(0,0,0,0.15),0_25px_70px_rgb(0,0,0,0.1)]">
              
              {/* Decorative top accent */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#2E3A59] to-[#C8A24A] opacity-20 blur-xl" />
                  <div className="relative bg-gradient-to-br from-[#2E3A59] to-[#1a2236] dark:from-white dark:to-zinc-300 
                                  rounded-full px-8 py-3 shadow-xl">
                    <span className="text-sm font-bold tracking-wide text-white dark:text-[#0B0B0C] uppercase">
                      Value Proposition
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced typography with gradient effects */}
              <div className="text-center space-y-6">
                <p className="text-3xl lg:text-4xl xl:text-5xl font-bold leading-[1.2] tracking-tight">
                  <span className="bg-gradient-to-r from-[#0B0B0C] to-[#2E3A59] dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
                    Create your AI, boost your online presence
                  </span>
                </p>
                
                <p className="text-xl lg:text-2xl xl:text-3xl leading-[1.4] text-[#2E3A59]/80 dark:text-zinc-400 max-w-4xl mx-auto">
                  AI-powered content creation, smart messaging, and social connectivity
                </p>
              </div>
              
              {/* Divider with gradient */}
              <div className="relative my-14">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gradient-to-r from-transparent via-[#E6E6E6] to-transparent dark:via-white/[.15]" />
                </div>
                <div className="relative flex justify-center">
                  <div className="bg-gradient-to-r from-[#2E3A59] to-[#C8A24A] rounded-full p-[2px]">
                    <div className="bg-white dark:bg-zinc-950 rounded-full px-4 py-1">
                      <svg className="h-4 w-4 text-[#2E3A59] dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium feature cards with enhanced design */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-10">
                {/* Feature 1 */}
                <div className="group relative">
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#2E3A59]/30 to-transparent opacity-0 blur-xl 
                                  transition-all duration-500 group-hover:opacity-100" />
                  <div className="relative bg-gradient-to-br from-[#f8f9fa] to-white dark:from-zinc-900 dark:to-zinc-950
                                  border-2 border-[#E6E6E6]/60 dark:border-white/[.08]
                                  rounded-3xl p-8 h-full
                                  transition-all duration-500 
                                  group-hover:border-[#2E3A59]/40 dark:group-hover:border-white/[.20]
                                  group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] opacity-10 blur-md group-hover:opacity-20 transition-opacity" />
                      <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-2xl 
                                      bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                      dark:from-white dark:to-zinc-200
                                      group-hover:scale-110 transition-transform duration-500">
                        <svg className="h-8 w-8 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#0B0B0C] dark:text-white mb-3 tracking-tight">
                      Automated content
                    </h3>
                    <p className="text-base leading-relaxed text-[#2E3A59]/80 dark:text-zinc-400">
                      Generate engaging posts and content automatically with AI
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="group relative">
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#2E3A59]/30 to-transparent opacity-0 blur-xl 
                                  transition-all duration-500 group-hover:opacity-100" />
                  <div className="relative bg-gradient-to-br from-[#f8f9fa] to-white dark:from-zinc-900 dark:to-zinc-950
                                  border-2 border-[#E6E6E6]/60 dark:border-white/[.08]
                                  rounded-3xl p-8 h-full
                                  transition-all duration-500 
                                  group-hover:border-[#2E3A59]/40 dark:group-hover:border-white/[.20]
                                  group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] opacity-10 blur-md group-hover:opacity-20 transition-opacity" />
                      <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-2xl 
                                      bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                      dark:from-white dark:to-zinc-200
                                      group-hover:scale-110 transition-transform duration-500">
                        <svg className="h-8 w-8 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#0B0B0C] dark:text-white mb-3 tracking-tight">
                      Assisted messaging
                    </h3>
                    <p className="text-base leading-relaxed text-[#2E3A59]/80 dark:text-zinc-400">
                      Smart AI support to help you engage with your audience
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="group relative">
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#2E3A59]/30 to-transparent opacity-0 blur-xl 
                                  transition-all duration-500 group-hover:opacity-100" />
                  <div className="relative bg-gradient-to-br from-[#f8f9fa] to-white dark:from-zinc-900 dark:to-zinc-950
                                  border-2 border-[#E6E6E6]/60 dark:border-white/[.08]
                                  rounded-3xl p-8 h-full
                                  transition-all duration-500 
                                  group-hover:border-[#2E3A59]/40 dark:group-hover:border-white/[.20]
                                  group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] opacity-10 blur-md group-hover:opacity-20 transition-opacity" />
                      <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-2xl 
                                      bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                      dark:from-white dark:to-zinc-200
                                      group-hover:scale-110 transition-transform duration-500">
                        <svg className="h-8 w-8 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#0B0B0C] dark:text-white mb-3 tracking-tight">
                      Best in class AI models
                    </h3>
                    <p className="text-base leading-relaxed text-[#2E3A59]/80 dark:text-zinc-400">
                      Powered by cutting-edge AI technology and models
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="group relative">
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#C8A24A]/30 to-transparent opacity-0 blur-xl 
                                  transition-all duration-500 group-hover:opacity-100" />
                  <div className="relative bg-gradient-to-br from-[#f8f9fa] to-white dark:from-zinc-900 dark:to-zinc-950
                                  border-2 border-[#E6E6E6]/60 dark:border-white/[.08]
                                  rounded-3xl p-8 h-full
                                  transition-all duration-500 
                                  group-hover:border-[#C8A24A]/40 dark:group-hover:border-[#C8A24A]/[.30]
                                  group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#C8A24A] to-[#b8923a] opacity-10 blur-md group-hover:opacity-20 transition-opacity" />
                      <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-2xl 
                                      bg-gradient-to-br from-[#C8A24A] to-[#b8923a] shadow-lg
                                      dark:from-[#C8A24A] dark:to-[#d4ae5c]
                                      group-hover:scale-110 transition-transform duration-500">
                        <svg className="h-8 w-8 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#0B0B0C] dark:text-white mb-3 tracking-tight">
                      Social platform connected
                    </h3>
                    <p className="text-base leading-relaxed text-[#2E3A59]/80 dark:text-zinc-400 mb-4">
                      Seamlessly integrate with major social networks
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-auto pt-2">
                      {/* X (Twitter) */}
                      <div className="h-8 w-8 rounded-lg bg-black dark:bg-white flex items-center justify-center transition-transform hover:scale-110">
                        <svg className="h-4 w-4 text-white dark:text-black" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </div>
                      {/* Facebook */}
                      <div className="h-8 w-8 rounded-lg bg-[#1877F2] flex items-center justify-center transition-transform hover:scale-110">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      {/* Instagram */}
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] flex items-center justify-center transition-transform hover:scale-110">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                      {/* LinkedIn */}
                      <div className="h-8 w-8 rounded-lg bg-[#0A66C2] flex items-center justify-center transition-transform hover:scale-110">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-32 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold text-[#0B0B0C] dark:text-white mb-5">
                How it works
              </h2>
              <p className="text-xl text-[#2E3A59]/80 dark:text-zinc-400">
                Three steps. Complete control.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#2E3A59]/20 to-[#C8A24A]/20 opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100 dark:from-white/10 dark:to-zinc-500/10" />
              <div className="relative border border-[#E6E6E6] dark:border-white/[.08] rounded-[1.75rem] bg-white dark:bg-zinc-950 p-10 h-full
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-2xl group-hover:-translate-y-1 
                              dark:group-hover:border-white/[.20]">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                dark:from-white dark:to-zinc-200">
                  <span className="text-2xl font-bold text-white dark:text-[#0B0B0C]">1</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold text-[#0B0B0C] dark:text-white">Create your AI</h3>
                <p className="mt-5 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                  Upload your content. Train it with your knowledge. It learns your voice and expertise.
                </p>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#2E3A59]/20 to-[#C8A24A]/20 opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100 dark:from-white/10 dark:to-zinc-500/10" />
              <div className="relative border border-[#E6E6E6] dark:border-white/[.08] rounded-[1.75rem] bg-white dark:bg-zinc-950 p-10 h-full
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-2xl group-hover:-translate-y-1
                              dark:group-hover:border-white/[.20]">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                dark:from-white dark:to-zinc-200">
                  <span className="text-2xl font-bold text-white dark:text-[#0B0B0C]">2</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold text-[#0B0B0C] dark:text-white">Set access levels</h3>
                <p className="mt-5 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                  Public for everyone. Private for subscribers. Intimate for your inner circle.
                </p>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#2E3A59]/20 to-[#C8A24A]/20 opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100 dark:from-white/10 dark:to-zinc-500/10" />
              <div className="relative border border-[#E6E6E6] dark:border-white/[.08] rounded-[1.75rem] bg-white dark:bg-zinc-950 p-10 h-full
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-2xl group-hover:-translate-y-1
                              dark:group-hover:border-white/[.20]">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg
                                dark:from-white dark:to-zinc-200">
                  <span className="text-2xl font-bold text-white dark:text-[#0B0B0C]">3</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold text-[#0B0B0C] dark:text-white">Let people interact</h3>
                <p className="mt-5 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                  They ask questions. Your AI answers. You keep your time and energy.
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* For creators & viewers */}
        <div className="mt-40 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Creators Card */}
            <div className="group relative">
              <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-br from-[#2E3A59]/30 to-[#1a2236]/30 opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100 dark:from-white/10 dark:to-white/5" />
              <div className="relative border-2 border-[#E6E6E6] dark:border-white/[.10] rounded-[2rem] bg-gradient-to-br from-white via-[#FAFAFA] to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-12 h-full
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-2xl dark:group-hover:border-white/[.20]">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#2E3A59]/10 border border-[#2E3A59]/20 dark:bg-white/[.06] dark:border-white/[.10] px-5 py-2 text-sm font-semibold text-[#2E3A59] dark:text-zinc-200">
                  For creators
                </div>
                <h3 className="mt-8 text-4xl font-bold text-[#0B0B0C] dark:text-white leading-tight">
                  Monetize your expertise.
                  <br />
                  <span className="text-[#2E3A59] dark:text-zinc-400">Keep your time.</span>
                </h3>
                
                <ul className="mt-10 space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#2E3A59]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#2E3A59] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">Answer questions without answering</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Let your AI handle repetitive interactions</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#2E3A59]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#2E3A59] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">Control who sees what</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Set boundaries. Protect your privacy</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#2E3A59]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#2E3A59] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">Monetize depth, not noise</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Earn from knowledge. Not from attention</div>
                    </div>
                  </li>
                </ul>

                <Link
                  href="/signup"
                  className="mt-10 h-14 px-8 inline-flex items-center justify-center rounded-full bg-[#2E3A59] text-base font-semibold text-white 
                             transition-all duration-300 hover:bg-[#1a2236] hover:scale-105 shadow-lg hover:shadow-xl
                             dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
                >
                  Start as a creator
                </Link>
              </div>
            </div>

            {/* Viewers Card */}
            <div className="group relative">
              <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-br from-[#C8A24A]/30 to-[#C8A24A]/10 opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100 dark:from-white/10 dark:to-white/5" />
              <div className="relative border-2 border-[#E6E6E6] dark:border-white/[.10] rounded-[2rem] bg-gradient-to-br from-white via-[#FAFAFA] to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-12 h-full
                              transition-all duration-300 group-hover:border-[#C8A24A]/40 group-hover:shadow-2xl dark:group-hover:border-white/[.20]">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#C8A24A]/10 border border-[#C8A24A]/20 dark:bg-white/[.06] dark:border-white/[.10] px-5 py-2 text-sm font-semibold text-[#C8A24A] dark:text-zinc-200">
                  For viewers
                </div>
                <h3 className="mt-8 text-4xl font-bold text-[#0B0B0C] dark:text-white leading-tight">
                  Access real expertise.
                  <br />
                  <span className="text-[#C8A24A] dark:text-zinc-400">Pay for depth.</span>
                </h3>
                
                <ul className="mt-10 space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#C8A24A]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#C8A24A]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#C8A24A] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">Ask real questions</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Get real answers from expert knowledge</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#C8A24A]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#C8A24A]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#C8A24A] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">Access private knowledge</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Go deeper than public content</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-xl bg-[#C8A24A]/10 dark:bg-white/[.08] flex items-center justify-center ring-1 ring-[#C8A24A]/20 dark:ring-white/[.10]">
                      <svg className="h-4 w-4 text-[#C8A24A] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#0B0B0C] dark:text-white">No ads. No noise</div>
                      <div className="mt-2 text-base text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">Pure signal. Zero distractions</div>
                    </div>
                  </li>
                </ul>

                <Link
                  href="/login"
                  className="mt-10 h-14 px-8 inline-flex items-center justify-center rounded-full border-2 border-[#C8A24A]/30 text-base font-semibold text-[#0B0B0C] 
                             transition-all duration-300 hover:border-[#C8A24A] hover:bg-[#C8A24A]/5 hover:scale-105
                             dark:border-white/[.20] dark:text-white dark:hover:border-white/[.40] dark:hover:bg-white/[.05]"
                >
                  Explore creators
                </Link>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Access layers */}
        <div className="mt-40 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-[#0B0B0C] dark:text-white mb-5">
              Three layers of access
            </h2>
            <p className="text-xl text-[#2E3A59]/80 dark:text-zinc-400">
              You control what each layer reveals.
            </p>
          </div>

          <div className="space-y-7">
            {/* Public Layer */}
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#2E3A59]/10 to-transparent opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100" />
              <div className="relative border-2 border-[#E6E6E6] dark:border-white/[.08] rounded-[1.75rem] bg-white dark:bg-zinc-950 p-10 
                              transition-all duration-300 group-hover:border-[#2E3A59]/30 group-hover:shadow-xl group-hover:-translate-y-0.5
                              dark:group-hover:border-white/[.16]">
                <div className="flex items-start justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-[#E6E6E6] dark:bg-zinc-900 flex items-center justify-center ring-1 ring-[#2E3A59]/10 dark:ring-white/[.08]">
                        <div className="h-4 w-4 rounded-full bg-[#2E3A59]/40 dark:bg-zinc-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-[#0B0B0C] dark:text-white">Public</div>
                        <div className="text-base text-[#2E3A59]/60 dark:text-zinc-500 mt-1">Free for everyone</div>
                      </div>
                    </div>
                    <p className="mt-6 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                      Basic knowledge. General questions. Open to all.
                    </p>
                  </div>
                  <div className="flex-shrink-0 rounded-full bg-[#E6E6E6] dark:bg-zinc-900 px-6 py-2.5 text-base font-semibold text-[#2E3A59] dark:text-zinc-300 ring-1 ring-[#2E3A59]/10 dark:ring-white/[.08]">
                    Free
                  </div>
                </div>
              </div>
            </div>

            {/* Private Layer */}
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#2E3A59]/20 to-transparent opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100" />
              <div className="relative border-2 border-[#2E3A59]/20 dark:border-white/[.12] rounded-[1.75rem] bg-white dark:bg-zinc-950 p-10 
                              transition-all duration-300 group-hover:border-[#2E3A59]/50 group-hover:shadow-xl group-hover:-translate-y-0.5
                              dark:group-hover:border-white/[.20]">
                <div className="flex items-start justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-[#2E3A59]/10 dark:bg-zinc-900 flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-white/[.12]">
                        <div className="h-4 w-4 rounded-full bg-[#2E3A59] dark:bg-zinc-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-[#0B0B0C] dark:text-white">Private</div>
                        <div className="text-base text-[#2E3A59]/60 dark:text-zinc-500 mt-1">For subscribers</div>
                      </div>
                    </div>
                    <p className="mt-6 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                      Deeper insights. More context. Real expertise. Nuanced answers.
                    </p>
                  </div>
                  <div className="flex-shrink-0 rounded-full bg-[#2E3A59]/10 dark:bg-white/[.08] px-6 py-2.5 text-base font-semibold text-[#2E3A59] dark:text-white ring-1 ring-[#2E3A59]/20 dark:ring-white/[.12]">
                    Paid
                  </div>
                </div>
              </div>
            </div>

            {/* Intimate Layer */}
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#C8A24A]/30 to-transparent opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100" />
              <div className="relative border-2 border-[#C8A24A]/30 dark:border-white/[.16] rounded-[1.75rem] bg-gradient-to-br from-[#C8A24A]/5 to-white dark:from-zinc-900 dark:to-zinc-950 p-10 
                              transition-all duration-300 group-hover:border-[#C8A24A]/50 group-hover:shadow-2xl group-hover:-translate-y-0.5
                              dark:group-hover:border-white/[.24]">
                <div className="flex items-start justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-[#C8A24A]/20 dark:bg-white flex items-center justify-center ring-1 ring-[#C8A24A]/30 dark:ring-[#0B0B0C]">
                        <div className="h-4 w-4 rounded-full bg-[#C8A24A] dark:bg-[#0B0B0C]" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-[#0B0B0C] dark:text-white">Intimate</div>
                        <div className="text-base text-[#C8A24A] dark:text-zinc-400 mt-1">Your inner circle</div>
                      </div>
                    </div>
                    <p className="mt-6 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                      Personal stories. Private thoughts. Full access to everything. Unfiltered.
                    </p>
                  </div>
                  <div className="flex-shrink-0 rounded-full bg-[#C8A24A] dark:bg-white px-6 py-2.5 text-base font-semibold text-white dark:text-[#0B0B0C] shadow-lg">
                    Exclusive
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Why different */}
        <div className="mt-40 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-[#0B0B0C] dark:text-white leading-tight">
              This is not a chatbot.
            </h2>
            <p className="mt-5 text-3xl font-semibold text-[#2E3A59] dark:text-zinc-400">
              It's a new relationship layer.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div className="group text-center">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-white to-[#FAFAFA] dark:from-zinc-900 dark:to-zinc-800 
                              border-2 border-[#E6E6E6] dark:border-white/[.10] flex items-center justify-center
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-xl group-hover:scale-105
                              dark:group-hover:border-white/[.20]">
                <svg className="h-9 w-9 text-[#2E3A59] dark:text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-7 text-2xl font-bold text-[#0B0B0C] dark:text-white">Time</h3>
              <p className="mt-4 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                Keep yours.
                <br />
                Share knowledge.
              </p>
            </div>

            <div className="group text-center">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-white to-[#FAFAFA] dark:from-zinc-900 dark:to-zinc-800 
                              border-2 border-[#E6E6E6] dark:border-white/[.10] flex items-center justify-center
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-xl group-hover:scale-105
                              dark:group-hover:border-white/[.20]">
                <svg className="h-9 w-9 text-[#2E3A59] dark:text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-7 text-2xl font-bold text-[#0B0B0C] dark:text-white">Boundaries</h3>
              <p className="mt-4 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                You decide.
                <br />
                Not the platform.
              </p>
            </div>

            <div className="group text-center">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-white to-[#FAFAFA] dark:from-zinc-900 dark:to-zinc-800 
                              border-2 border-[#E6E6E6] dark:border-white/[.10] flex items-center justify-center
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-xl group-hover:scale-105
                              dark:group-hover:border-white/[.20]">
                <svg className="h-9 w-9 text-[#2E3A59] dark:text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <h3 className="mt-7 text-2xl font-bold text-[#0B0B0C] dark:text-white">Depth</h3>
              <p className="mt-4 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                Not breadth.
                <br />
                Quality over reach.
              </p>
            </div>

            <div className="group text-center">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-white to-[#FAFAFA] dark:from-zinc-900 dark:to-zinc-800 
                              border-2 border-[#E6E6E6] dark:border-white/[.10] flex items-center justify-center
                              transition-all duration-300 group-hover:border-[#2E3A59]/40 group-hover:shadow-xl group-hover:scale-105
                              dark:group-hover:border-white/[.20]">
                <svg className="h-9 w-9 text-[#2E3A59] dark:text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mt-7 text-2xl font-bold text-[#0B0B0C] dark:text-white">Control</h3>
              <p className="mt-4 text-lg leading-relaxed text-[#2E3A59]/70 dark:text-zinc-400">
                Full ownership.
                <br />
                Your content. Your rules.
              </p>
            </div>
          </div>
        </div>

        {/* Monetization */}
        <div className="mt-40 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-br from-[#2E3A59]/20 to-[#C8A24A]/10 opacity-50 blur-3xl" />
            <div className="relative border-2 border-[#E6E6E6] dark:border-white/[.12] rounded-[2rem] bg-gradient-to-br from-white via-[#FAFAFA] to-white dark:from-zinc-900 dark:to-zinc-950 p-16">
              <div className="text-center mb-16">
                <h2 className="text-5xl font-bold text-[#0B0B0C] dark:text-white mb-5">
                  How money works
                </h2>
                <p className="text-xl text-[#2E3A59]/80 dark:text-zinc-400">
                  Simple. Transparent. Fair.
                </p>
              </div>

              <div className="grid gap-12 md:grid-cols-3">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2E3A59]/10 to-emerald-500/10 dark:from-emerald-900/30 dark:to-emerald-800/20 flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-emerald-500/30">
                    <svg className="h-8 w-8 text-[#2E3A59] dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="mt-6 text-2xl font-bold text-[#0B0B0C] dark:text-white">Creators never pay</div>
                  <p className="mt-4 text-lg text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">
                    No subscriptions.
                    <br />
                    No hidden fees.
                  </p>
                </div>

                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#C8A24A]/10 to-blue-500/10 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center ring-1 ring-[#C8A24A]/20 dark:ring-blue-500/30">
                    <svg className="h-8 w-8 text-[#C8A24A] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="mt-6 text-2xl font-bold text-[#0B0B0C] dark:text-white">Viewers pay for access</div>
                  <p className="mt-4 text-lg text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">
                    You set the price.
                    <br />
                    Per layer. Per month.
                  </p>
                </div>

                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2E3A59]/10 to-purple-500/10 dark:from-purple-900/30 dark:to-purple-800/20 flex items-center justify-center ring-1 ring-[#2E3A59]/20 dark:ring-purple-500/30">
                    <svg className="h-8 w-8 text-[#2E3A59] dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="mt-6 text-2xl font-bold text-[#0B0B0C] dark:text-white">Platform takes a cut</div>
                  <p className="mt-4 text-lg text-[#2E3A59]/70 dark:text-zinc-400 leading-relaxed">
                    Transparent percentage.
                    <br />
                    That's how we operate.
                  </p>
                </div>
              </div>

              <div className="mt-14 pt-10 border-t-2 border-[#E6E6E6] dark:border-white/[.08] text-center">
                <p className="text-lg text-[#2E3A59]/70 dark:text-zinc-400">
                  No token usage. No pay-per-message. Just simple subscriptions.
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-40 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2E3A59] via-[#1a2236] to-[#2E3A59] dark:from-white dark:via-zinc-100 dark:to-white" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
            
            <div className="relative px-12 py-20 text-center">
              <h2 className="text-6xl font-bold text-white dark:text-[#0B0B0C] mb-6">
                Ready to start?
              </h2>
              <p className="text-2xl text-white/90 dark:text-[#2E3A59] max-w-3xl mx-auto leading-relaxed">
                Join creators who are building AI versions of themselves.
                Or explore the knowledge they're sharing.
              </p>

              <div className="mt-14 flex flex-col gap-5 sm:flex-row sm:justify-center sm:items-center">
                <Link
                  href="/signup"
                  className="group h-16 px-10 inline-flex items-center justify-center rounded-full bg-white text-lg font-semibold text-[#2E3A59] 
                             transition-all duration-300 hover:bg-[#E6E6E6] hover:scale-105 shadow-2xl hover:shadow-3xl
                             dark:bg-[#0B0B0C] dark:text-white dark:hover:bg-zinc-900"
                >
                  Start as a creator
                  <svg className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>

                <Link
                  href="/login"
                  className="h-16 px-10 inline-flex items-center justify-center rounded-full border-2 border-white/[.40] text-lg font-semibold text-white 
                             transition-all duration-300 hover:border-white hover:bg-white/[.15] hover:scale-105 backdrop-blur-sm
                             dark:border-[#0B0B0C]/[.40] dark:text-[#0B0B0C] dark:hover:border-[#0B0B0C] dark:hover:bg-[#0B0B0C]/[.10]"
                >
                  Explore as a viewer
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center gap-10 text-base text-white/70 dark:text-[#2E3A59]/70">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-white/90 dark:text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Free to create
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-white/90 dark:text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Start earning today
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-32 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="pt-16 pb-12 border-t-2 border-[#E6E6E6]/50 dark:border-white/[.06]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              {/* Logo and Brand */}
              <div className="md:col-span-2">
                <Link href="/" className="flex items-center gap-3 transition-all duration-300 hover:opacity-70 mb-6">
                  {appConfig.app_logo_url && appConfig.app_logo_url.trim() !== "" ? (
                    <>
                      <img src={appConfig.app_logo_url} 
                        alt={appConfig.app_name || "Logo"}
                        className="h-9 w-auto object-contain"
                      />
                      <div className="text-lg font-bold text-[#0B0B0C] dark:text-white">
                        {appConfig.app_name || "AGENT"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-md dark:from-white dark:to-zinc-200" />
                      <div className="text-lg font-bold text-[#0B0B0C] dark:text-white">
                        {appConfig.app_name || "AGENT"}
                      </div>
                    </>
                  )}
                </Link>
                <p className="text-base text-[#2E3A59]/70 dark:text-zinc-400 max-w-md">
                  Build and share your AI. Get paid for depth, not attention.
                </p>
              </div>

              {/* Company Links */}
              <div>
                <h3 className="text-sm font-bold text-[#0B0B0C] dark:text-white uppercase tracking-wider mb-4">
                  Company
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href="/about" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/careers" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Careers
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/contact" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/news" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      News
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources Links */}
              <div>
                <h3 className="text-sm font-bold text-[#0B0B0C] dark:text-white uppercase tracking-wider mb-4">
                  Resources
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href="/documentation" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/privacy" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Privacy policy
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/legal" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Legal
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/status" 
                      className="text-base text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                    >
                      Status
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Footer */}
            <div className="pt-8 border-t border-[#E6E6E6]/50 dark:border-white/[.06]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-base text-[#2E3A59]/60 dark:text-zinc-500">
                  © {new Date().getFullYear()} Avee. All rights reserved.
                </div>
                <div className="flex items-center gap-6">
                  <Link 
                    href="/terms" 
                    className="text-sm text-[#2E3A59]/60 dark:text-zinc-500 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                  >
                    Terms
                  </Link>
                  <Link 
                    href="/privacy" 
                    className="text-sm text-[#2E3A59]/60 dark:text-zinc-500 hover:text-[#2E3A59] dark:hover:text-white transition-colors duration-200"
                  >
                    Privacy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
