const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken(): string | null {
    return localStorage.getItem("voiceaid_token");
}

export function setToken(token: string) {
    localStorage.setItem("voiceaid_token", token);
}

export function clearToken() {
    localStorage.removeItem("voiceaid_token");
}

export async function api<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data as T;
}

// Convenience methods
api.get = <T = any>(path: string) => api<T>(path, { method: "GET" });
api.post = <T = any>(path: string, body: any) =>
    api<T>(path, { method: "POST", body: JSON.stringify(body) });
api.put = <T = any>(path: string, body: any) =>
    api<T>(path, { method: "PUT", body: JSON.stringify(body) });
api.delete = <T = any>(path: string) => api<T>(path, { method: "DELETE" });
