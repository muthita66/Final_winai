/**
 * A generic API client wrapper for Next.js 
 * Automatically handles JSON parsing and standard error throwing
 */

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
    const defaultOptions: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
        ...options,
    };

    const response = await fetch(url, defaultOptions);
    const data = await response.json();

    if (!response.ok || !data.success) {
        const errorMsg = data.message || data.error || `HTTP error! status: ${response.status}`;
        const detailedError = data.errors ? JSON.stringify(data.errors) : '';
        throw new Error(detailedError ? `${errorMsg} (${detailedError})` : errorMsg);
    }

    return data.data as T;
}
