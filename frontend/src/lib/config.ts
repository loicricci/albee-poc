// API functions for app configuration

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type AppConfig = {
  app_name?: string;
  app_logo_url?: string;
  app_cover_url?: string;
  app_favicon_url?: string;
};

/**
 * Get all app configuration (public, no auth required)
 */
export async function getAppConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch app config: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Get a specific configuration value
 */
export async function getConfigValue(key: string): Promise<string> {
  const res = await fetch(`${API_BASE}/config/${key}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch config ${key}: ${res.statusText}`);
  }

  const data = await res.json();
  return data.value;
}

/**
 * Update a configuration value (requires authentication)
 */
export async function updateConfigValue(
  key: string,
  value: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/config/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ config_value: value }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update config: ${error}`);
  }
}








