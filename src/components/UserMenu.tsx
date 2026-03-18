'use client';

import { useRouter } from 'next/navigation';

export default function UserMenu({ session }: { session: any }) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh(); // Clear client cache
    };

    if (!session) {
        return (
            <button
                onClick={() => router.push('/login')}
                className="h-9 px-4 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition-colors shadow-sm"
            >
                เข้าสู่ระบบ
            </button>
        );
    }

    const initial = session.name ? session.name.charAt(0).toUpperCase() : 'U';

    return (
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-700 leading-tight">{session.name}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{session.role}</span>
            </div>

            <div className="flex items-center gap-3">

                <button
                    onClick={handleLogout}
                    className="h-10 px-4 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:shadow-sm text-sm font-medium transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    ออกจากระบบ
                </button>
            </div>
        </div>
    );
}
