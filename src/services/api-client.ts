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
    let data: any;
    try {
        data = await response.json();
    } catch (e: any) {
        const text = await response.text();
        console.error(`[fetchApi] Failed to parse JSON from ${url}. Status: ${response.status}`);
        console.error(`[fetchApi] Response body starts with: ${text.substring(0, 500)}`);
        throw new Error(`Invalid JSON response from ${url}: ${e.message}`);
    }

    if (!response.ok || !data.success) {
        const errorMsg = data.message || data.error || `HTTP error! status: ${response.status}`;
        const detailedError = data.errors ? JSON.stringify(data.errors) : '';
        throw new Error(detailedError ? `${errorMsg} (${detailedError})` : errorMsg);
    }

    return data.data as T;
}
