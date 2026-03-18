"use client";

import React, { useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';

interface PrintButtonProps {
    contentRef: React.RefObject<HTMLElement | null>;
    label?: string;
    documentTitle?: string;
    className?: string;
}

export function PrintButton({
    contentRef,
    label = "พิมพ์ / บันทึก PDF",
    documentTitle = "WinAI School Report",
    className = "",
}: PrintButtonProps) {
    const reactToPrintFn = useReactToPrint({
        contentRef,
        documentTitle,
    });

    const handlePrint = useCallback(() => {
        reactToPrintFn();
    }, [reactToPrintFn]);

    return (
        <button
            onClick={handlePrint}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm ${className}`}
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            </svg>
            {label}
        </button>
    );
}
