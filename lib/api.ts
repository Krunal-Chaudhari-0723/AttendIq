const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped calls opt in to loose data
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("attendiq_token");
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("attendiq_token", token);
  } else {
    localStorage.removeItem("attendiq_token");
  }
};

/** Download a server-generated file (e.g. CSV report) with the user's credentials. */
export async function apiDownload(endpoint: string, filename: string): Promise<{ success: boolean; error?: string }> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const token = getAuthToken();
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { success: false, error: body?.error || `Download failed (${res.status})` };
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    return { success: true };
  } catch {
    return { success: false, error: "Network error or server unavailable. Please try again." };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass a type for new code
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error) {
    console.error(`[API Fetch Error] ${endpoint}:`, error);
    return { success: false, error: "Cannot reach the AttendIQ server. Check your connection and try again." };
  }

  // A rejected session anywhere signs the user out (except the login call itself)
  if (res.status === 401 && !endpoint.startsWith("/auth/") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON body, e.g. an HTML error page from a proxy while the server restarts
    return {
      success: false,
      error: res.status >= 500 ? `The server is temporarily unavailable (${res.status}). Please try again shortly.` : `Unexpected response from the server (${res.status}).`,
    };
  }
}

export const SESSION_EXPIRED_EVENT = "attendiq:session-expired";
