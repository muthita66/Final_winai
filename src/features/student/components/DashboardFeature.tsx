"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StudentApiService } from '@/services/student-api.service';

type StudentDashboardSession = {
    name?: string;
    code?: string;
    class_level?: string;
    room?: string;
};

type StudentDashboardData = {
    profile?: {
        id?: number;
        student_code?: string;
        image_url?: string | null;
        name?: string;
        class_level?: string;
        room?: string;
    };
    currentTerm?: {
        semester?: number;
        year?: string;
    } | null;
    stats?: {
        registeredSubjects?: number;
        completedGrades?: number;
        pendingGrades?: number;
        gpa?: number;
        attendanceRate?: number;
        conductScore?: number;
        upcomingActivities?: number;
    };
    attendance?: {
        present?: number;
        absent?: number;
        late?: number;
        leave?: number;
        total?: number;
        rate?: number;
    };
    upcomingActivities?: Array<{
        id: number;
        title: string;
        start_date: string | Date;
        location?: string;
    }>;
    recentGrades?: Array<{
        enrollment_id: number;
        subject_code: string;
        subject_name: string;
        letter_grade?: string | null;
        total_score?: number | null;
    }>;
};

function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

import { BookOpen, Calendar, Clock, Award } from 'lucide-react';

export function DashboardFeature({ session }: { session: StudentDashboardSession }) {
    const [data, setData] = useState<StudentDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        StudentApiService.getDashboardSummary()
            .then((res) => {
                if (!mounted) return;
                setData(res);
                setError(null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || 'Failed to load dashboard');
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-slate-500">
                กำลังโหลดแดชบอร์ดนักเรียน...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 rounded-2xl p-8 border border-red-200 text-red-700">
                โหลดข้อมูลไม่สำเร็จ: {error}
            </div>
        );
    }

    const profile = data?.profile || {};
    const stats = data?.stats || {};
    const attendance = data?.attendance || {};
    const currentTerm = data?.currentTerm;

    const displayClassLevel = profile.class_level || session.class_level || '-';
    const rawRoom = profile.room || session.room || '-';
    const displayRoom = rawRoom.includes('/') ? rawRoom.split('/').pop() : rawRoom;

    const cards = [
        { label: 'วิชาที่ลงทะเบียน', value: stats.registeredSubjects ?? 0, href: '/student/registration', color: 'from-emerald-500 to-teal-600', icon: BookOpen },
        { label: 'กิจกรรมที่กำลังจะมา', value: stats.upcomingActivities ?? 0, href: '/student/activities', color: 'from-emerald-500 to-teal-600', icon: Calendar },
        { label: 'การเข้าเรียน (%)', value: stats.attendanceRate ?? 0, href: '/student/schedule', color: 'from-amber-500 to-orange-600', icon: Clock },
        { label: 'คะแนนความประพฤติ', value: stats.conductScore ?? 0, href: '/student/conduct', color: 'from-fuchsia-500 to-pink-600', icon: Award },
    ];

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-6 items-start">
                    <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                        {/* Profile Photo */}
                        <div className="relative shrink-0">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 overflow-hidden shadow-inner flex items-center justify-center">
                                {profile.image_url ? (
                                    <img
                                        src={profile.image_url}
                                        alt={profile.name || 'Student'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-white opacity-40">
                                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm bg-white/15 border border-white/20 inline-flex px-3 py-1 rounded-full backdrop-blur-sm">
                                Student Dashboard
                            </div>
                            <h1 className="text-2xl font-bold mt-2">
                                สวัสดี, {profile.name || session.name || 'นักเรียน'}
                            </h1>
                            <div className="flex flex-col gap-1 mt-1.5">
                                <p className="text-emerald-100 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                    <span className="text-sm">รหัสนักเรียน:</span>
                                    <span className="font-medium tracking-tight text-white">{profile.student_code || session.code || '-'}</span>
                                </p>
                                <p className="text-emerald-100 text-sm flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                    ชั้น{displayClassLevel} ห้อง {displayRoom}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 border border-white/15 rounded-2xl p-4 min-w-[240px]">
                        <div className="text-sm text-emerald-100 mb-2">ภาคเรียนปัจจุบัน</div>
                        {currentTerm ? (
                            <>
                                <div className="text-xl font-bold">ภาคเรียนที่ {currentTerm.semester}</div>
                                <div className="text-emerald-100">ปีการศึกษา {currentTerm.year}</div>
                            </>
                        ) : (
                            <div className="text-emerald-100">ยังไม่พบภาคเรียนที่ active</div>
                        )}
                        <div className="mt-4 text-xs text-emerald-100">
                            GPA (ข้อมูลที่มี): {Number(stats.gpa ?? 0).toFixed(2)}
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Link
                            key={card.label}
                            href={card.href}
                            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-4"
                        >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm shrink-0`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-500 font-medium">{card.label}</div>
                                <div className="text-2xl font-bold text-slate-800">{card.value}</div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">สรุปการเข้าเรียน</h2>
                        <Link href="/student/schedule" className="text-sm text-emerald-700 hover:text-emerald-800">
                            ดูตารางเรียน
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                            <div className="text-xs text-emerald-700">มาเรียน</div>
                            <div className="text-2xl font-bold tracking-tight text-emerald-800">{attendance.present ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                            <div className="text-xs text-red-700">ขาดเรียน</div>
                            <div className="text-2xl font-bold tracking-tight text-red-800">{attendance.absent ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <div className="text-xs text-amber-700">มาสาย</div>
                            <div className="text-2xl font-bold tracking-tight text-amber-800">{attendance.late ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                            <div className="text-xs text-slate-600">รวมทั้งหมด</div>
                            <div className="text-2xl font-bold tracking-tight text-slate-800">{attendance.total ?? 0}</div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">กิจกรรมที่กำลังจะมา</h2>
                        <Link href="/student/activities" className="text-sm text-emerald-700 hover:text-emerald-800">
                            ดูทั้งหมด
                        </Link>
                    </div>
                    {(data?.upcomingActivities || []).length === 0 ? (
                        <p className="text-sm text-slate-500">ยังไม่มีกิจกรรมที่ลงทะเบียนไว้</p>
                    ) : (
                        <div className="space-y-3">
                            {(data?.upcomingActivities || []).map((item) => (
                                <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">{formatDateTime(item.start_date)}</div>
                                    <div className="text-xs text-slate-500">{item.location || '-'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
