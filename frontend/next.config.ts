import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Enable gzip compression
  compress: true,
  
  // Optimize package imports to reduce bundle size
  experimental: {
    // Tree-shake heavy packages
    optimizePackageImports: [
      '@supabase/supabase-js',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
    ],
  },
  
  // Image optimization configuration
  images: {
    // Modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    
    // Allow images from Supabase storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
    ],
    
    // Optimize image loading
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Reduce build output verbosity
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  
  // Performance: Disable x-powered-by header
  poweredByHeader: false,
  
  // Generate ETags for caching
  generateEtags: true,
};

export default nextConfig;
