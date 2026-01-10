"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAllCaches, setCurrentCacheUser } from "@/lib/apiCache";

// Test accounts for development - add your test accounts here
const TEST_ACCOUNTS = [
  {
    name: "Account 1 - Loic Gmail",
    email: "loic.ricci@gmail.com",
    password: "P7w1t2f1245!",
  },
  {
    name: "Account 2 - WF-MO",
    email: "loic@wf-mo.com",
    password: "P7w1t2f123!",
  },
  {
    name: "Account 3 - CryptoClub",
    email: "loic@cryptoclub.live",
    password: "P7w1t2f1!",
  },
];

export default function DevLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Ready");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [autoLogin, setAutoLogin] = useState(false);

  // Check current session on load
  useEffect(() => {
    checkCurrentUser();
    
    // Auto-login if email param is provided
    const emailParam = searchParams.get("email");
    const passwordParam = searchParams.get("password");
    if (emailParam && passwordParam) {
      setAutoLogin(true);
      loginWithCredentials(emailParam, passwordParam);
    }
  }, [searchParams]);

  async function checkCurrentUser() {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.email) {
      setCurrentUser(data.session.user.email);
    } else {
      setCurrentUser(null);
    }
  }

  async function clearAllUserData() {
    setStatus("Clearing all caches...");
    
    // Clear localStorage caches
    clearAllCaches();
    setCurrentCacheUser(null);
    
    // Clear sessionStorage caches
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('app_data_') || key.startsWith('cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear sessionStorage:', e);
    }
    
    // Clear other known cache keys
    const keysToRemove = [
      'user_profile', 'app_profile', 'app_avees', 
      'app_recommendations', 'app_feed', 'app_unified_feed',
      'app_config'
    ];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
    
    setStatus("All caches cleared!");
  }

  async function loginWithCredentials(email: string, password: string) {
    setLoading(true);
    setStatus(`Logging in as ${email}...`);
    
    try {
      // First, sign out if already logged in
      await supabase.auth.signOut();
      
      // Clear all caches
      await clearAllUserData();
      
      // Small delay to ensure cache clearing is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setStatus(`Login failed: ${error.message}`);
        setLoading(false);
        return;
      }
      
      if (data.session) {
        setStatus(`Logged in as ${email}! Redirecting...`);
        setCurrentUser(email);
        
        // Wait a bit then redirect
        await new Promise(resolve => setTimeout(resolve, 500));
        router.push("/app");
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setStatus("Logging out...");
    
    try {
      await supabase.auth.signOut();
      await clearAllUserData();
      setCurrentUser(null);
      setStatus("Logged out successfully!");
    } catch (e: any) {
      setStatus(`Logout error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loginAsAccount(account: typeof TEST_ACCOUNTS[0]) {
    await loginWithCredentials(account.email, account.password);
  }

  // Custom login form
  const [customEmail, setCustomEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");

  async function handleCustomLogin(e: React.FormEvent) {
    e.preventDefault();
    if (customEmail && customPassword) {
      await loginWithCredentials(customEmail, customPassword);
    }
  }

  if (autoLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Auto Login</h1>
          <p className="text-gray-600">{status}</p>
          {loading && (
            <div className="mt-4 flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">🔧 Dev Login Tester</h1>
        <p className="text-gray-400 mb-8">
          Quick account switching for testing cache isolation
        </p>
        
        {/* Status Bar */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-sm">Current User: </span>
              <span className="text-white font-medium">
                {currentUser || "Not logged in"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Status: </span>
              <span className={`font-medium ${status.includes("failed") || status.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={logout}
            disabled={loading || !currentUser}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            🚪 Logout
          </button>
          <button
            onClick={clearAllUserData}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            🗑️ Clear All Caches
          </button>
        </div>

        {/* Test Accounts */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">📋 Test Accounts</h2>
          <div className="space-y-3">
            {TEST_ACCOUNTS.map((account, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-gray-700 rounded-lg p-4"
              >
                <div>
                  <div className="text-white font-medium">{account.name}</div>
                  <div className="text-gray-400 text-sm">{account.email}</div>
                </div>
                <button
                  onClick={() => loginAsAccount(account)}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {loading ? "..." : "Login →"}
                </button>
              </div>
            ))}
            
            {TEST_ACCOUNTS.length === 0 && (
              <p className="text-gray-400 text-center py-4">
                No test accounts configured. Add them to the TEST_ACCOUNTS array.
              </p>
            )}
          </div>
        </div>

        {/* Custom Login */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">🔑 Custom Login</h2>
          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Password</label>
              <input
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !customEmail || !customPassword}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? "Logging in..." : "Login with Custom Credentials"}
            </button>
          </form>
        </div>

        {/* URL Login Info */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-2">💡 URL Auto-Login</h2>
          <p className="text-gray-400 text-sm mb-2">
            You can auto-login by passing credentials in the URL:
          </p>
          <code className="block bg-gray-900 rounded p-3 text-green-400 text-sm overflow-x-auto">
            /dev-login?email=user@example.com&password=yourpassword
          </code>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <a 
            href="/app"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            → Go to App
          </a>
          <a 
            href="/login"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            → Normal Login Page
          </a>
        </div>
      </div>
    </div>
  );
}

