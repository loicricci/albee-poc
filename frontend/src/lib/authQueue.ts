/**
 * Auth Queue - Ensures API calls wait for auth token to be ready
 * Eliminates 401 errors from race conditions
 */

import { supabase } from "./supabaseClient";

let authReadyPromise: Promise<string | null> | null = null;
let authToken: string | null = null;
let authError: Error | null = null;

/**
 * Get auth token, waiting for it to be ready if necessary
 * Returns null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  // If we already have a valid token, return it immediately
  if (authToken) {
    return authToken;
  }

  // If there was an auth error, throw it
  if (authError) {
    throw authError;
  }

  // If auth is already being fetched, wait for it
  if (authReadyPromise) {
    return authReadyPromise;
  }

  // Start fetching auth token
  authReadyPromise = supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        authError = error;
        throw error;
      }
      authToken = data.session?.access_token || null;
      return authToken;
    })
    .catch((error) => {
      authError = error;
      throw error;
    });

  return authReadyPromise;
}

/**
 * Clear cached auth token (call on logout or auth change)
 */
export function clearAuthToken() {
  authToken = null;
  authReadyPromise = null;
  authError = null;
}

/**
 * Set auth token manually (useful for auth state changes)
 */
export function setAuthToken(token: string | null) {
  authToken = token;
  authError = null;
  authReadyPromise = token ? Promise.resolve(token) : null;
}

/**
 * Check if user is authenticated (synchronous check)
 */
export function isAuthenticated(): boolean {
  return authToken !== null;
}


