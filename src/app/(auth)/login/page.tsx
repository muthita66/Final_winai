'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const roleMap = {
    student: {
        title: 'เข้าสู่ระบบนักเรียน',
        subtitle: 'ใช้รหัสนักเรียนและรหัสผ่าน',
        codeLabel: 'รหัสนักเรียน',
        codePlaceholder: 'เช่น 6501001',
        redirect: '/student/dashboard',
    },
    teacher: {
        title: 'เข้าสู่ระบบครู',
        subtitle: 'ใช้รหัสครูและรหัสผ่าน',
        codeLabel: 'รหัสครู',
        codePlaceholder: 'เช่น T001',
        redirect: '/teacher/dashboard',
    },
    director: {
        title: 'เข้าสู่ระบบผู้อำนวยการ',
        subtitle: 'ใช้รหัสผู้อำนวยการและรหัสผ่าน',
        codeLabel: 'รหัสผู้อำนวยการ',
        codePlaceholder: 'เช่น D001',
        redirect: '/director/dashboard',
    }
};

export default function LoginPage() {
    const router = useRouter();
    const [role, setRole] = useState('student');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const config = roleMap[role as keyof typeof roleMap];

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (!code || !password) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, password, role }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || 'รหัสผ่านไม่ถูกต้อง หรือเชื่อมต่อไม่ได้');
            } else {
                // Success, session cookie is set
                router.push(config.redirect);
                router.refresh(); // Refresh root layout to update Header/Sidebar
            }
        } catch (err) {
            setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Decorative gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-10 transition-all duration-300">

                {/* Header */}
                <div className="p-8 pb-6 text-center border-b border-slate-100">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/30 mb-4">
                        W
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{config.title}</h1>
                    <p className="text-sm text-slate-500 mt-1">{config.subtitle}</p>
                </div>

                {/* Role Tabs */}
                <div className="flex px-6 pt-4 gap-2">
                    {Object.keys(roleMap).map((r) => (
                        <button
                            key={r}
                            onClick={() => { setRole(r); setError(''); setCode(''); setPassword(''); }}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${role === r
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {r === 'student' ? 'นักเรียน' : r === 'teacher' ? 'ครู' : 'ผู้อำนวยการ'}
                        </button>
                    ))}
                </div>

                {/* Form */}
                <div className="p-8 pt-6">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{config.codeLabel}</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder={config.codePlaceholder}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-slate-700 placeholder-slate-400"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="********"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-slate-700 placeholder-slate-400"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
