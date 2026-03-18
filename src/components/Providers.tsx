"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute default stale time
                refetchOnWindowFocus: false, // Prevents aggressive refetching when switching tabs
                retry: 1, // Only retry failed requests once to avoid spamming the backend
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#fff',
                        color: '#333',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        borderRadius: '0.75rem',
                        padding: '16px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#10B981', // Emerald 500
                            secondary: '#fff',
                        },
                    },
                    error: {
                        duration: 4000,
                        iconTheme: {
                            primary: '#EF4444', // Red 500
                            secondary: '#fff',
                        },
                    },
                }}
            />
        </QueryClientProvider>
    );
}
