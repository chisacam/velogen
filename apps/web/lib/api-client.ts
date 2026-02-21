const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function resolveErrorMessage(response: Response): Promise<string> {
  let message = `Request failed: ${response.status}`;
  try {
    const errorData = (await response.json()) as { message?: string };
    if (errorData.message) {
      return errorData.message;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      return message;
    }
  }
  return message;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_BASE, apiRequest };
