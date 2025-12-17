export async function apiFetch(path: string, token: string, init?: RequestInit) {
    const base = process.env.NEXT_PUBLIC_API_BASE!;
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res;
  }
  