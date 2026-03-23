"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";
import Portal from "@/components/Portal";
import ActivityEvaluationModal from "./ActivityEvaluationModal";
import { getCurrentAcademicYearBE, getAcademicSemesterDefault } from "@/features/student/academic-term";

interface ActivitiesFeatureProps {
    session: any;
}

const TH_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const TH_MONTHS_SHORT = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export function ActivitiesFeature({ session }: ActivitiesFeatureProps) {
    const student = session;

    // Data state
    // Queries
    const activitiesQuery = useQuery({
        queryKey: ["student", "activities"],
        queryFn: () => StudentApiService.getAllActivities(),
    });

    const events = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'list' | 'evaluation'>('month');
    const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string, events: any[] } | null>(null);
    const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYearBE());
    const [selectedSemester, setSelectedSemester] = useState(getAcademicSemesterDefault());
    const [selectedActivityForEval, setSelectedActivityForEval] = useState<any | null>(null);

    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => Number(y.year_name));

    const evalQuery = useQuery({
        queryKey: ["student", "activities", "evaluation", selectedYear, selectedSemester],
        queryFn: () => StudentApiService.getActivityEvaluations(selectedYear, selectedSemester),
        enabled: true,
    });

    const isLoading = activitiesQuery.isLoading;
    const isEvalLoading = evalQuery.isLoading;
    const fetchError = activitiesQuery.error ? (activitiesQuery.error as any).message : null;

    const shiftMonth = (delta: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Calendar logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    // Helper to get YYYY-MM-DD from Date without timezone shifts
    const toDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const monthEvents = events.filter((ev) => {
        const start = new Date(ev.start_date || ev.date);
        const end = ev.end_date ? new Date(ev.end_date) : start;
        if (isNaN(start.getTime())) return false;

        // Month Boundaries
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

        // Simple overlap check: (start <= monthEnd) && (end >= monthStart)
        return start <= monthEnd && end >= monthStart;
    });

    const eventMap = new Map();
    monthEvents.forEach((ev: any) => {
        try {
            const start = new Date(ev.start_date || ev.date);
            const end = ev.end_date ? new Date(ev.end_date) : start;
            if (isNaN(start.getTime())) return;

            const current = new Date(start);
            current.setHours(0, 0, 0, 0);
            const stop = new Date(end);
            stop.setHours(23, 59, 59, 999);

            // Cap the loop to prevent infinite loops if dates are invalid
            let safety = 0;
            while (current <= stop && safety < 100) {
                const key = toDateKey(current);
                if (!eventMap.has(key)) eventMap.set(key, []);
                eventMap.get(key).push(ev);
                current.setDate(current.getDate() + 1);
                safety++;
            }
        } catch (e: any) {
            console.error("Invalid date for event mapping", ev, e);
        }
    });

    const classifyEvent = (name = "") => {
        if (name.includes("ประชุม")) return "meeting text-emerald-700 bg-emerald-50 border-emerald-200";
        if (name.includes("สอบ") || name.includes("วิชาการ")) return "academic text-purple-700 bg-purple-50 border-purple-200";
        if (name.includes("หยุด")) return "holiday text-red-700 bg-red-50 border-red-200";
        return "other text-slate-700 bg-slate-50 border-slate-200";
    };

    const renderCalendarGrid = () => {
        const weeks = [];
        let dayNum = 1;
        let nextMonthDay = 1;

        for (let week = 0; week < 6; week++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                let displayDay: number | string = "";
                let dateKey = "";
                let isCurrentMonth = true;

                if (week === 0 && i < firstDay) {
                    displayDay = prevDays - firstDay + i + 1;
                    isCurrentMonth = false;
                } else if (dayNum > daysInMonth) {
                    displayDay = nextMonthDay++;
                    isCurrentMonth = false;
                } else {
                    displayDay = dayNum;
                    const d = new Date(year, month, dayNum);
                    // Use ISO date string format (YYYY-MM-DD) or local date for key
                    // To match the eventMap key (ISO string slice 0,10):
                    dateKey = toDateKey(new Date(year, month, dayNum));

                    dayNum++;
                }

                const dayEvents = eventMap.get(dateKey) || [];

                days.push(
                    <td
                        key={i}
                        className={`border border-slate-200 p-1 align-top h-20 md:h-28 transition-colors hover:bg-slate-50 relative cursor-pointer ${dayEvents.length > 0 ? 'bg-emerald-50/60' : !isCurrentMonth ? 'opacity-40 bg-slate-50/50' : 'bg-white'}`}
                        onClick={() => {
                            if (dayEvents.length > 0) {
                                setSelectedDateEvents({ date: dateKey, events: dayEvents });
                            }
                        }}
                    >
                        <div className="flex flex-col h-full">
                            <div className={`text-right text-sm font-medium p-1 ${isCurrentMonth && dayNum - 1 === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? 'text-teal-600 font-bold bg-teal-50 rounded-full w-7 h-7 flex items-center justify-center ml-auto' : 'text-slate-600'}`}>
                                {displayDay}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 custom-scrollbar">
                                {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                                    <div key={idx} className={`text-xs px-2 py-1 rounded border truncate shadow-sm cursor-pointer hover:shadow-md transition-shadow ${classifyEvent(ev.title || ev.name)}`} title={ev.title || ev.name}>
                                        {ev.title || ev.name}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-slate-500 font-medium px-1 mt-1">
                                        +{dayEvents.length - 3} รายการ
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                );
            }
            weeks.push(<tr key={week}>{days}</tr>);
            if (dayNum > daysInMonth) break;
        }
        return weeks;
    };

    const renderEvaluationView = () => {
        const evals = Array.isArray(evalQuery.data) ? evalQuery.data : [];

        // Filter: Show ONLY activities that have already started/passed
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastEvals = evals.filter((ev: any) => {
            if (!ev.date) return false;
            const eventDate = new Date(ev.date);
            // Show if the event date is before or equal to today
            return eventDate <= today;
        });

        if (isEvalLoading) return (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-500 font-medium">กำลังโหลดรายการกิจกรรม...</div>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">ปีการศึกษา</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all cursor-pointer shadow-sm"
                            >
                                {yearOptions.length > 0 ? (
                                    yearOptions.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))
                                ) : (
                                    <option value={selectedYear}>{selectedYear}</option>
                                )}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">ภาคเรียน</label>
                            <select
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all cursor-pointer shadow-sm"
                            >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                            </select>
                        </div>
                    </div>
                </div>

                {pastEvals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-lg font-bold text-slate-500">ไม่พบกิจกรรมที่ผ่านมาในภาคเรียนนี้</p>
                        <p className="text-sm mt-2">ประเมินได้เฉพาะกิจกรรมที่สิ้นสุดแล้วเท่านั้น</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {pastEvals.map((ev: any) => (
                            <div key={ev.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-teal-900/5 hover:border-teal-200 transition-all duration-300 flex flex-col md:flex-row items-center p-4 gap-4">
                                {/* Date Column */}
                                <div className="flex flex-col items-center justify-center bg-slate-50/80 rounded-xl px-4 py-3 min-w-[120px] border border-slate-100/50">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider mb-0.5">DATE</span>
                                    <span className="text-sm font-black text-slate-700">{formatDate(ev.date)}</span>
                                </div>

                                {/* Main Info Column */}
                                <div className="flex-1 min-w-0 text-center md:text-left">
                                    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                                        <span className="text-xs font-black text-teal-600/50 uppercase tracking-wider">กิจกรรม</span>
                                        <div className="h-px flex-1 bg-slate-100 hidden sm:block"></div>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-lg sm:text-xl truncate group-hover:text-teal-600 transition-colors uppercase">{ev.title}</h4>
                                    <div className="flex items-center gap-3 mt-1 justify-center md:justify-start">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="text-sm font-medium">{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Column */}
                                <div className="shrink-0">
                                    {ev.is_evaluated ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shadow-sm">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            <span className="text-xs font-bold">DONE</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shadow-sm">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="text-xs font-bold uppercase">Pending</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Column */}
                                <div className="shrink-0 w-full md:w-auto md:min-w-[170px]">
                                    {ev.is_evaluated ? (
                                        <button disabled className="w-full py-2.5 bg-slate-50 text-slate-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-slate-100 opacity-60">
                                            ประเมินเรียบร้อย
                                        </button>
                                    ) : ev.has_evaluation ? (
                                        <button
                                            onClick={() => setSelectedActivityForEval(ev)}
                                            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-black shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 group/btn"
                                        >
                                            ประเมินกิจกรรม
                                            <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        </button>
                                    ) : (
                                        <div className="w-full py-2.5 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold text-center border border-dashed border-slate-200 uppercase tracking-tight">
                                            No Eval Form
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };



    const renderListView = () => {
        const sortedMonthEvents = [...monthEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (sortedMonthEvents.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg">— ไม่มีกิจกรรมในเดือนนี้ —</p>
                </div>
            );
        }

        return (
            <div className="space-y-4 py-2">
                {sortedMonthEvents.map((ev, idx) => {
                    const d = new Date(ev.start_date || ev.date);
                    const dateNum = d.getDate();
                    const monthIdx = d.getMonth();

                    return (
                        <div key={idx} className={`flex gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${classifyEvent(ev.title || ev.name)}`}>
                            <div className="flex flex-col items-center justify-center bg-white/80 rounded-xl p-3 min-w-[70px] shrink-0 shadow-sm border border-black/5">
                                <span className="text-2xl font-black leading-none">{dateNum}</span>
                                <span className="text-xs uppercase font-bold mt-1 opacity-70">{TH_MONTHS_SHORT[monthIdx]}</span>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-bold text-lg leading-tight mb-1 truncate">{ev.title || ev.name}</h4>
                                <div className="flex items-center text-sm gap-4 opacity-70">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <span className="truncate">{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>{formatTimeRange(ev)}</span>
                                    </div>
                                </div>
                                {ev.description && (
                                    <p className="mt-2 text-sm opacity-80 line-clamp-2">{ev.description}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Upcoming logic
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(todayStr);

    const upcomingEvents = events
        .filter((ev: any) => ev.start_date || ev.date)
        .map((ev: any) => ({
            ...ev,
            startDateObj: new Date(ev.start_date || ev.date),
            endDateObj: ev.end_date ? new Date(ev.end_date) : new Date(ev.start_date || ev.date)
        }))
        .filter((ev: any) => ev.endDateObj >= todayDate)
        .sort((a: any, b: any) => a.startDateObj.getTime() - b.startDateObj.getTime())
        .slice(0, 6);

    const formatTimeRange = (ev: any) => {
        if (ev.is_all_day) return "ทั้งวัน";

        const start = new Date(ev.start_date || ev.date);
        const end = ev.end_date ? new Date(ev.end_date) : null;

        if (Number.isNaN(start.getTime())) return "";

        // Force UTC to match database local timestamps
        const startTime = start.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });

        if (!end || Number.isNaN(end.getTime())) return `เวลา ${startTime}`;

        const endTime = end.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });
        return `เวลา ${startTime} - ${endTime}`;
    };

    const formatDate = (value: string) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString("th-TH", { timeZone: 'UTC' });
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <section className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="w-full md:w-1/2">
                        <Skeleton variant="rounded" className="h-4 w-20 mb-3 bg-white/20" />
                        <Skeleton variant="rounded" className="h-7 w-64 mb-1 bg-white/20" />
                        <Skeleton variant="rounded" className="h-4 w-80 bg-white/20" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 inline-flex flex-col items-start min-w-[200px]">
                        <Skeleton variant="rounded" className="h-4 w-32 mb-1.5 bg-white/20" />
                        <Skeleton variant="rounded" className="h-6 w-24 bg-white/20" />
                    </div>
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between mb-6">
                            <Skeleton variant="rounded" className="h-10 w-48" />
                            <Skeleton variant="rounded" className="h-8 w-32" />
                            <Skeleton variant="rounded" className="h-10 w-32" />
                        </div>
                        <Skeleton variant="rounded" className="h-[500px] w-full" />
                    </div>
                    <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <Skeleton variant="rounded" className="h-10 w-full mb-6" />
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-16 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-red-500">
                <p>{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                        Activities
                    </div>
                    <h1 className="text-2xl font-bold mb-1">ปฏิทินกิจกรรมโรงเรียน</h1>
                    <p className="text-teal-100 text-sm mb-4 max-w-xl">
                        ติดตามกิจกรรมที่จะมาถึงและกิจกรรมที่ผ่านมาทั้งหมดตลอดปีการศึกษา
                    </p>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                </svg>
            </section>

            {/* Upcoming Activities Section */}
            {upcomingEvents.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">กิจกรรมที่กำลังจะมาถึง</h3>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold leading-none">{upcomingEvents.length} รายการ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingEvents.map((ev, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex gap-5 hover:shadow-md hover:border-emerald-200 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 opacity-50 transform rotate-45 translate-x-8 -translate-y-8"></div>
                                <div className="flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-xl p-3 min-w-[70px] h-[70px] shrink-0 border border-emerald-100 group-hover:bg-emerald-100 transition-colors z-10">
                                    <span className="text-2xl font-black leading-none">{ev.startDateObj.getDate()}</span>
                                    <span className="text-xs uppercase font-bold mt-1 tracking-wider">{TH_MONTHS_SHORT[ev.startDateObj.getMonth()]}</span>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                                    <h4 className="font-bold text-slate-800 text-lg mb-2 truncate group-hover:text-emerald-700 transition-colors" title={ev.name}>{ev.name}</h4>
                                    <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="truncate">{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>{formatTimeRange(ev)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content Layout */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => shiftMonth(-1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => shiftMonth(1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <h2 className="text-xl font-bold text-slate-800 ml-2 min-w-[150px] text-center" id="studentCalMonthLabel">
                            {TH_MONTHS[month]} {year + 543}
                        </h2>
                    </div>

                    <div className="flex border border-slate-200 rounded-xl overflow-hidden shrink-0 shadow-sm p-1 bg-white">
                        <button
                            onClick={() => setView('month')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all ${view === 'month' ? 'bg-teal-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}
                        >
                            เดือน
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all ${view === 'list' ? 'bg-teal-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}
                        >
                            ลิสต์
                        </button>
                        <button
                            onClick={() => setView('evaluation')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all ${view === 'evaluation' ? 'bg-teal-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}
                        >
                            ประเมินกิจกรรม
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl p-1 bg-slate-50/30">
                    {view === 'month' ? (
                        <table className="w-full text-slate-800 min-w-[600px] border-collapse bg-white rounded-lg overflow-hidden">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-4 px-2 text-center text-red-500 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">อา.</th>
                                    <th className="py-4 px-2 text-center text-slate-600 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">จ.</th>
                                    <th className="py-4 px-2 text-center text-slate-600 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">อ.</th>
                                    <th className="py-4 px-2 text-center text-slate-600 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">พ.</th>
                                    <th className="py-4 px-2 text-center text-slate-600 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">พฤ.</th>
                                    <th className="py-4 px-2 text-center text-slate-600 font-black text-[10px] uppercase tracking-widest border-r border-slate-200 w-[14.28%]">ศ.</th>
                                    <th className="py-4 px-2 text-center text-teal-600 font-black text-[10px] uppercase tracking-widest w-[14.28%]">ส.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderCalendarGrid()}
                            </tbody>
                        </table>
                    ) : view === 'list' ? (
                        <div className="bg-white p-4 rounded-lg">
                            {renderListView()}
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-lg min-h-[400px]">
                            {renderEvaluationView()}
                        </div>
                    )}
                </div>
            </div>
            {/* Event Detail Modal */}
            {selectedDateEvents && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-teal-600 to-teal-800 p-6 text-white relative">
                                <button
                                    onClick={() => setSelectedDateEvents(null)}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <h3 className="text-xl font-bold mb-1">
                                    กิจกรรมวันที่ {new Date(selectedDateEvents.date).getDate()} {TH_MONTHS[new Date(selectedDateEvents.date).getMonth()]} {new Date(selectedDateEvents.date).getFullYear() + 543}
                                </h3>
                                <p className="text-teal-100 text-sm opacity-90">
                                    พบ {selectedDateEvents.events.length} รายการ
                                </p>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
                                {selectedDateEvents.events.map((ev, idx) => (
                                    <div key={idx} className={`p-5 rounded-2xl border-l-4 shadow-sm ${classifyEvent(ev.name)}`}>
                                        <div className="flex justify-between items-start mb-4 group">
                                            <h4 className="font-black text-xl text-slate-800 leading-tight">{ev.name}</h4>
                                        </div>

                                        <div className="space-y-4 text-sm text-slate-600">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 border border-slate-100 relative overflow-hidden group/item">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/item:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ประเภทกิจกรรม</span>
                                                    <span className="font-bold text-slate-700">{ev.event_type_name}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 border border-slate-100 relative overflow-hidden group/item">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/item:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฝ่ายที่รับผิดชอบ</span>
                                                    <span className="font-bold text-slate-700">{ev.department_name}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 border border-slate-100 relative overflow-hidden group/item">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/item:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ครูผู้รับผิดชอบ</span>
                                                    <span className="font-bold text-slate-700">{ev.teacher_name}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 border border-slate-100 relative overflow-hidden group/item">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/item:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">วันเวลากิจกรรม</span>
                                                    <span className="font-bold text-slate-700">{formatTimeRange(ev)}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 border border-slate-100 md:col-span-2 relative overflow-hidden group/item">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover/item:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">อาคาร / สถานที่</span>
                                                    <span className="font-bold text-slate-700">{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                                </div>
                                            </div>

                                            {ev.targets && ev.targets.length > 0 && (
                                                <div className="flex flex-col gap-2 rounded-xl bg-teal-50/40 p-3 border border-teal-100/60 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-teal-400"></div>
                                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                        กลุ่มเป้าหมายผู้เข้าร่วม
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {ev.targets.map((t: any, i: number) => (
                                                            <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-white text-teal-700 text-xs font-bold border border-teal-200 shadow-sm">
                                                                {t.type_name}{t.value && t.value.trim() !== '' ? `: ${t.value}` : ""}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {ev.description && (
                                                <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4 border border-slate-100 mt-4 relative overflow-hidden group/desc min-h-[120px]">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 group-hover/desc:bg-teal-400 transition-colors"></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        รายละเอียดกิจกรรม
                                                    </span>
                                                    <p className="text-slate-600 leading-relaxed font-medium mt-1">
                                                        {ev.description}
                                                    </p>
                                                </div>
                                            )}
                                            {/* Evaluation Status & Action */}
                                            {/* Find if this activity is in the evaluation list */}
                                            {(() => {
                                                const evalInfo = (evalQuery.data || []).find((e: any) => e.id === ev.id);
                                                // Only show the box if we have evaluation info and it actually has an evaluation form linked
                                                if (!evalInfo || !evalInfo.has_evaluation) return null;

                                                return (
                                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-4 rounded-xl">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">สถานะการประเมิน</p>
                                                            {evalInfo.is_evaluated ? (
                                                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-md">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                    ประเมินแล้ว
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 text-yellow-600 font-bold text-sm bg-yellow-50 px-3 py-1 rounded-md">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    ยังไม่ได้ประเมิน
                                                                </div>
                                                            )}
                                                        </div>

                                                        {!evalInfo.is_evaluated && (
                                                            <button
                                                                onClick={() => setSelectedActivityForEval({ ...ev, form_id: evalInfo.form_id })}
                                                                className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all hover:-translate-y-0.5"
                                                            >
                                                                เริ่มการประเมิน
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>
                </Portal>
            )}

            {/* Evaluation Modal */}
            <ActivityEvaluationModal
                open={!!selectedActivityForEval}
                activity={selectedActivityForEval}
                year={selectedYear}
                semester={selectedSemester}
                onClose={() => setSelectedActivityForEval(null)}
                onSubmit={() => {
                    setSelectedActivityForEval(null);
                    evalQuery.refetch();
                }}
            />
        </div>
    );
}
