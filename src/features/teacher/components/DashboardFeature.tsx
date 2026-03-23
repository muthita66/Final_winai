"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import Link from "next/link";

export function DashboardFeature({ session }: { session: any }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        setLoading(true);
        setError(null);
        console.log(`[Dashboard] Loading for session.id: ${session.id}...`);
        TeacherApiService.getDashboardSummary(session.id)
            .then(d => {
                console.log(`[Dashboard] Data received:`, d);
                setData(d);
                setLoading(false);
            })
            .catch(err => {
                console.error(`[Dashboard] Error loading:`, err);
                setError(err.message || "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้");
                setLoading(false);
            });

        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, [session.id]);

    const dateStr = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                <svg className="w-8 h-8 animate-spin text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p>กำลังโหลดแดชบอร์ด...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-red-200 flex flex-col items-center justify-center text-red-500">
                <svg className="w-12 h-12 mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold mb-2">เกิดข้อผิดพลาด</h3>
                <p className="text-sm opacity-80">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-sm">ลองอีกครั้ง</button>
            </div>
        );
    }

    const stats = [
        {
            label: "นักเรียนในที่ปรึกษา", value: data?.advisoryStudents || 0, color: "from-emerald-600 to-teal-700", icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ), href: "/teacher/students", show: data?.isAdvisor
        },
        {
            label: "รายวิชาที่สอน", value: data?.subjects || 0, color: "from-emerald-500 to-teal-600", icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.432.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            ), href: "/teacher/scores", show: true
        },
        {
            label: "จำนวนรายการคะแนน", value: data?.scoreItems || 0, color: "from-teal-600 to-cyan-700", icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            ), href: "/teacher/score_input", show: true
        },
        {
            label: "กิจกรรมทั้งหมด", value: data?.allEvents || 0, color: "from-teal-500 to-emerald-600", icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            ), href: "/teacher/activity_calendar", show: true
        },
    ].filter(s => s.show);

    return (
        <div className="space-y-6">
            {/* Hero */}
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-teal-500 rounded-full blur-2xl opacity-50"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-white/20">Teacher Console</div>
                        <h1 className="text-3xl font-bold mb-2">สวัสดี, {session.name || "ครู"}</h1>

                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 min-w-[220px]">
                        <div className="text-emerald-100 text-sm font-medium mb-3">ภาพรวมวันนี้</div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-emerald-100">กิจกรรมใกล้ถึง</span><strong className="text-white">{data?.upcomingEvents || 0}</strong></div>
                            {data?.isAdvisor && (
                                <div className="flex justify-between text-sm"><span className="text-emerald-100">นักเรียนในที่ปรึกษา</span><strong className="text-white">{data?.advisoryStudents || 0}</strong></div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <Link key={i} href={s.href} className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-0.5 flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-md shrink-0`}>{s.icon}</div>
                        <div>
                            <div className="text-sm text-slate-500 font-medium">{s.label}</div>
                            <div className="text-3xl font-bold text-slate-800 mt-0.5">{s.value}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Events */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-slate-800">กิจกรรมล่าสุด</h3>
                        <Link href="/teacher/activity_calendar" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">ดูทั้งหมด</Link>
                    </div>
                    <div className="space-y-3">
                        {(data?.recentEvents || []).length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">ยังไม่มีกิจกรรม</p>
                        ) : (
                            (data?.recentEvents || []).map((ev: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <span className="text-sm text-slate-700 font-medium">{ev.title}</span>
                                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">{ev.event_date ? new Date(ev.event_date).toLocaleDateString("th-TH") : "-"}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Tasks */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-slate-800">งานที่ต้องทำ</h3>
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium border border-emerald-100">วันนี้</span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { 
                                text: "เช็คชื่อนักเรียน", 
                                href: "/teacher/attendance",
                                icon: (
                                    <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                )
                            },
                            { 
                                text: "บันทึกคะแนน", 
                                href: "/teacher/score_input",
                                icon: (
                                    <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                )
                            },
                            { 
                                text: "ตรวจสอบตารางสอน", 
                                href: "/teacher/calendar",
                                icon: (
                                    <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                )
                            },
                            { 
                                text: "ตัดเกรด", 
                                href: "/teacher/grade_cut",

                                icon: (
                                    <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                    </svg>
                                )
                            },
                            { 
                                text: "ปฏิทินกิจกรรม", 
                                href: "/teacher/activity_calendar",

                                icon: (
                                    <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                )
                            },
                        ].map((task, i) => (
                            <Link key={i} href={task.href} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group">
                                {task.icon}
                                <span className="text-sm text-slate-700 font-medium group-hover:text-emerald-700 transition-colors">{task.text}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
