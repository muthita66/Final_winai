import React from "react";

interface SkeletonProps {
    className?: string;
    variant?: "text" | "circular" | "rectangular" | "rounded";
    width?: string | number;
    height?: string | number;
}

export function Skeleton({
    className = "",
    variant = "rectangular",
    width,
    height,
}: SkeletonProps) {
    const baseClasses = "animate-pulse bg-slate-200";

    const variantClasses = {
        text: "h-4 w-full rounded-md",
        circular: "rounded-full",
        rectangular: "rounded-none",
        rounded: "rounded-xl",
    };

    const style = {
        width,
        height,
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
}

// Special wrapper for groups of skeletons
export function SkeletonGroup({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {children}
        </div>
    );
}
