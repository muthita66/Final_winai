"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from "@/features/student/academic-term";

interface ScheduleFeatureProps {
    session: any;
}

export function ScheduleFeature({ session }: ScheduleFeatureProps) {
    const student = session;
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const urlYear = searchParams.get('year');
    const urlSemester = searchParams.get('semester');

    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => y.year_name);

    const selectedYearData = yearOptionsData.find((y: any) => String(y.year_name) === String(year));
    const semesterOptions = selectedYearData?.semesters || [];

    // Initial year/semester setup
    const defaultYear = String(getCurrentAcademicYearBE());
    const defaultSemester = String(getAcademicSemesterDefault());

    const [year, setYear] = useState(urlYear || defaultYear);
    const [semester, setSemester] = useState(urlSemester || defaultSemester);

    // Sync year state if URL and default are not available but data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);

    const [activeTab, setActiveTab] = useState<"class" | "exam">("class");
    const [examFilter, setExamFilter] = useState<"all" | "midterm" | "final">("all");
    const [hasManualTermSelection, setHasManualTermSelection] = useState(Boolean(urlYear || urlSemester));
    const [didAutoFallback, setDidAutoFallback] = useState(false);

    const yearNum = Number.parseInt(year, 10);
    const semesterNum = Number.parseInt(semester, 10);
    const hasValidTerm = Number.isFinite(yearNum) && yearNum > 0 && Number.isFinite(semesterNum) && semesterNum > 0;

    // Queries
    const classScheduleQuery = useQuery({
        queryKey: ["student", "schedule", "class", year, semester],
        queryFn: () => StudentApiService.getClassSchedule(yearNum, semesterNum),
        enabled: hasValidTerm,
    });

    const examScheduleQuery = useQuery({
        queryKey: ["student", "schedule", "exam", year, semester],
        queryFn: () => StudentApiService.getExamSchedule(yearNum, semesterNum),
        enabled: hasValidTerm,
    });

    const advisorQuery = useQuery({
        queryKey: ["student", "advisor", year, semester],
        queryFn: () => StudentApiService.getAdvisor(yearNum, semesterNum),
        enabled: hasValidTerm,
    });

    const advisorLatestQuery = useQuery({
        queryKey: ["student", "advisor", "latest"],
        queryFn: () => StudentApiService.getAdvisor(),
    });

    const cartQuery = useQuery({
        queryKey: ["student", "cart", year, semester],
        queryFn: () => StudentApiService.getCart(yearNum, semesterNum),
        enabled: hasValidTerm,
    });

    const classRows = classScheduleQuery.data || [];
    const examRows = examScheduleQuery.data || [];
    const cartItems = cartQuery.data || [];
    const advDataAny = advisorQuery.data as any;
    const advisors = advDataAny?.advisors || (advDataAny?.advisor ? [advDataAny.advisor] : []);
    const isLoading = (hasValidTerm && (classScheduleQuery.isLoading || examScheduleQuery.isLoading || advisorQuery.isLoading || cartQuery.isLoading)) || academicYearsQuery.isLoading;

    const fixedSlots = [
        "8:00-8:50", "9:00-9:50", "10:00-10:50", "11:00-11:50",
        "12:00-12:50", "13:00-13:50", "14:00-14:50", "15:00-15:50"
    ];

    // Update URL when year/semester changes
    useEffect(() => {
        const currentYear = searchParams.get('year') || "";
        const currentSemester = searchParams.get('semester') || "";
        if (currentYear === year && currentSemester === semester) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('year', year);
        params.set('semester', semester);
        router.replace(`${pathname}?${params.toString()}`);
    }, [year, semester, pathname, router, searchParams]);

    useEffect(() => {
        if (didAutoFallback || hasManualTermSelection || !hasValidTerm) return;
        if (classScheduleQuery.isLoading || examScheduleQuery.isLoading || advisorQuery.isLoading || cartQuery.isLoading) return;

        const hasCurrentData = classRows.length > 0 || cartItems.length > 0 || examRows.length > 0 || advisors.length > 0;
        if (hasCurrentData) return;

        const latestDataAny = advisorLatestQuery.data as any;
        const latestAdvisors = latestDataAny?.advisors || (latestDataAny?.advisor ? [latestDataAny.advisor] : []);
        const latest = latestAdvisors[0];
        if (!latest?.year || !latest?.semester) return;

        const nextYear = String(latest.year);
        const nextSemester = String(latest.semester);
        if (nextYear === year && nextSemester === semester) return;

        setDidAutoFallback(true);
        setYear(nextYear);
        setSemester(nextSemester);
    }, [
        advisors.length,
        advisorLatestQuery.data,
        advisorQuery.isLoading,
        cartItems.length,
        cartQuery.isLoading,
        classRows.length,
        classScheduleQuery.isLoading,
        didAutoFallback,
        examRows.length,
        examScheduleQuery.isLoading,
        hasManualTermSelection,
        hasValidTerm,
        semester,
        year
    ]);

    // --- Helpers for Class Grid ---
    const normalizeDay = (day: string) => {
        const clean = String(day).trim();
        const map: any = {
            "Mon": "จันทร์", "Monday": "จันทร์", "จ.": "จันทร์", "จันทร์": "จันทร์",
            "Tue": "อังคาร", "Tuesday": "อังคาร", "อ.": "อังคาร", "อังคาร": "อังคาร",
            "Wed": "พุธ", "Wednesday": "พุธ", "พ.": "พุธ", "พุธ": "พุธ",
            "Thu": "พฤหัสบดี", "Thursday": "พฤหัสบดี", "พฤ.": "พฤหัสบดี", "พฤหัสบดี": "พฤหัสบดี",
            "Fri": "ศุกร์", "Friday": "ศุกร์", "ศ.": "ศุกร์", "ศุกร์": "ศุกร์",
            "Sat": "เสาร์", "Saturday": "เสาร์", "ส.": "เสาร์", "เสาร์": "เสาร์",
            "Sun": "อาทิตย์", "Sunday": "อาทิตย์", "อา.": "อาทิตย์", "อาทิตย์": "อาทิตย์"
        };
        return map[clean] || clean;
    };

    const toMinutes = (timeRange: string) => {
        if (!timeRange) return 0;
        const match = timeRange.match(/(\d{1,2}):(\d{2})/);
        if (!match) return 0;
        return Number(match[1]) * 60 + Number(match[2]);
    };

    const parseRange = (timeRange: string) => {
        if (!timeRange) return null;
        const clean = timeRange.replace(/\s/g, "").replace("–", "-").replace("—", "-");
        const parts = clean.split("-");
        if (parts.length < 2) {
            const startOnly = toMinutes(parts[0]);
            if (!startOnly) return null;
            return { start: startOnly, end: startOnly + 50 };
        }
        const start = toMinutes(parts[0]);
        const end = toMinutes(parts[1]);
        if (!start || !end) return null;
        return { start, end };
    };

    const slotMatch = (timeRange: string, slot: string) => {
        const r = parseRange(timeRange);
        const s = parseRange(slot);
        if (!r || !s) return false;
        return r.start < s.end && r.end > s.start;
    };

    const formatClock = (value: any) => {
        if (!value) return "";
        const raw = String(value);
        const m = raw.match(/(\d{2}:\d{2})/);
        return m ? m[1] : "";
    };
    const buildTimeRange = (row: any) => {
        const direct = String(row?.time_range || "").trim();
        if (direct) return direct;
        const start = formatClock(row?.start_time);
        const end = formatClock(row?.end_time);
        if (start && end) return `${start}-${end}`;
        return String(row?.period || "").trim();
    };

    const cartScheduleRows = (cartItems || []).flatMap((item: any) =>
        (Array.isArray(item?.schedules) ? item.schedules : []).map((sch: any) => ({
            section_id: item.section_id || item.teaching_assignment_id || item.id,
            subject_code: item.subject_code || "-",
            subject_name: item.subject_name || "-",
            teacher: item.teacher_name || "",
            room_name: sch?.room_name || sch?.room || "",
            room: sch?.room_name || sch?.room || "",
            classroom: item.room || "",
            day_of_week: sch?.day_of_week || sch?.day || "",
            time_range: sch?.time_range || sch?.period || "",
            source: "cart" as const,
        }))
    );
    const mergedClassRows = [
        ...(classRows || []).map((r: any) => ({
            ...r,
            day_of_week: r?.day_of_week || r?.day || "",
            time_range: buildTimeRange(r),
            teacher: r?.teacher || r?.teacher_name || "",
            room_name: r?.room_name || r?.room || "",
            source: "registered" as const,
        })),
        ...cartScheduleRows,
    ].filter((r: any) => String(r?.day_of_week || "").trim() && String(r?.time_range || "").trim());

    // Prepare grid data
    const byDay: Record<string, any[]> = {};
    mergedClassRows.forEach((r: any) => {
        const day = normalizeDay(r.day_of_week || "-");
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(r);
    });

    const baseDays = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
    const weekdayDays = baseDays.slice(0, 5);
    const hiddenDays = new Set(baseDays.slice(5));
    const extraDays = Object.keys(byDay).filter(d => d !== "-" && !baseDays.includes(d) && !hiddenDays.has(d));
    const dayOrder = weekdayDays.concat(extraDays);

    // Prepare exam data
    const filteredExams = examRows.filter(r => examFilter === "all" || String(r.exam_type).toLowerCase() === examFilter);
    const groupedExams = new Map();

    filteredExams.forEach(r => {
        const key = `${r.section_id || ""}-${r.subject_code || ""}`;
        if (!groupedExams.has(key)) {
            groupedExams.set(key, {
                subject_code: r.subject_code || "-",
                subject_name: r.subject_name || "-",
                group: r.class_level || r.room ? `${r.class_level || ""}${r.room ? "/" + r.room : ""}` : "-",
                midterm: null,
                final: null
            });
        }
        const record = groupedExams.get(key);
        if (String(r.exam_type).toLowerCase() === "midterm") record.midterm = r;
        else if (String(r.exam_type).toLowerCase() === "final") record.final = r;
    });

    const formatThaiDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("th-TH", {
            year: "numeric", month: "short", day: "numeric"
        });
    };

    const renderExamCell = (exam: any) => {
        if (!exam) return "-";
        const date = exam.exam_date ? formatThaiDate(exam.exam_date) : "-";
        const time = exam.time_range || "-";
        const room = exam.room ? `ห้อง ${exam.room}` : "-";
        return (
            <div className="flex flex-col items-center">
                <div>{date}</div>
                <div>{time}</div>
                <div className="text-sm text-slate-500">{room}</div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                        Schedule
                    </div>
                    <h1 className="text-2xl font-bold mb-1">ตารางเรียน / ตารางสอบ</h1>
                    <p className="text-blue-100 text-sm max-w-2xl">
                        เลือกปีการศึกษาและภาคเรียนเพื่อดูตารางล่าสุด
                    </p>
                </div>

                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-500 rounded-full blur-2xl opacity-50"></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 relative z-10">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                        <div className="text-blue-200 text-xs mb-1">จำนวนคาบเรียน</div>
                        <div className="text-2xl font-bold">{classRows.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                        <div className="text-blue-200 text-xs mb-1">จำนวนสอบ</div>
                        <div className="text-2xl font-bold">{examRows.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                        <div className="text-blue-200 text-xs mb-1">ครูที่ปรึกษา</div>
                        <div className="text-base font-bold truncate">
                            {advisors.length > 0 ? (
                                advisors.map((adv: any, idx: number) => (
                                    <div key={idx} className="leading-tight">{`${adv.teacher_code || ""} ${adv.first_name || ""} ${adv.last_name || ""}`.trim()}</div>
                                ))
                            ) : (
                                "-"
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Controls */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Selectors */}
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">ปีการศึกษา</label>
                            <select
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                                value={year}
                                onChange={e => {
                                    setHasManualTermSelection(true);
                                    setYear(e.target.value);
                                }}
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={String(y)}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">ภาคเรียน</label>
                            <select
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                                value={semester}
                                onChange={e => {
                                    setHasManualTermSelection(true);
                                    setSemester(e.target.value);
                                }}
                            >
                                    {semesterOptions.length > 0 ? (
                                        semesterOptions.map((s: any) => (
                                            <option key={s.semester_number} value={String(s.semester_number)}>
                                                {s.semester_number}
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                        </>
                                    )}
                            </select>
                        </div>
                    </div>

                    {/* Right: Tabs & Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'exam' && (
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${examFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setExamFilter('all')}>ทั้งหมด</button>
                                <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${examFilter === 'midterm' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setExamFilter('midterm')}>กลางภาค</button>
                                <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${examFilter === 'final' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setExamFilter('final')}>ปลายภาค</button>
                            </div>
                        )}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'class' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                onClick={() => setActiveTab('class')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                ตารางเรียน
                            </button>
                            <button
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'exam' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                onClick={() => setActiveTab('exam')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                ตารางสอบ
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Display Area */}
            {isLoading ? (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <Skeleton variant="rounded" className="h-6 w-48 mb-6" />
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-16 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {activeTab === 'class' && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-6">
                                <h3 className="text-lg font-bold text-slate-800">ตารางเรียน</h3>
                            </div>
                            <div className="overflow-x-auto pb-4">
                                <table className="w-full text-xs text-left border-collapse min-w-[1600px] table-fixed">
                                    <thead className="text-[11px] text-slate-600 bg-slate-50 border-b border-t border-slate-200 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-2 border-r border-slate-200 text-center w-20">วัน/เวลา</th>
                                            {fixedSlots.map(slot => (
                                                <th key={slot} className="px-3 py-2 border-r border-slate-200 text-center min-w-[180px] font-bold">{slot}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mergedClassRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={fixedSlots.length + 1} className="px-6 py-8 text-center text-slate-500 border-b border-slate-200">
                                                    ไม่มีข้อมูลตารางเรียน
                                                </td>
                                            </tr>
                                        ) : (
                                            dayOrder.map(day => {
                                                const dayRows = byDay[day] || [];
                                                return (
                                                    <tr key={day} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                        <th className="px-3 py-4 font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200 text-center">{day}</th>
                                                        {fixedSlots.map(slot => {
                                                            const matches = dayRows.filter(r => slotMatch(r.time_range, slot));
                                                            if (!matches.length) return <td key={slot} className="px-2 py-2 border-r border-slate-200"></td>;

                                                            return (
                                                                <td key={slot} className={`px-2 py-2 border-r border-slate-200 align-top ${matches.length > 1 ? 'bg-rose-50/60' : ''}`}>
                                                                    {matches.map((r, i) => (
                                                                        <div key={`${r.source || 'registered'}-${r.section_id || r.subject_code || i}-${i}`} className={`rounded-xl p-2.5 mb-2 last:mb-0 text-xs border shadow-sm ${r.source === 'cart' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'}`}>
                                                                            <div className={`font-bold mb-1 leading-tight ${r.source === 'cart' ? 'text-amber-700' : 'text-indigo-700'}`}>{r.subject_code || "-"}</div>
                                                                            <div className="text-slate-800 font-bold leading-tight mb-1.5">{r.subject_name || "-"}</div>
                                                                            <div className="text-[10.5px] text-slate-600" title={`ผู้สอน ${r.teacher || "-"}`}>ผู้สอน: {r.teacher || "-"}</div>
                                                                            <div className="text-[10.5px] text-slate-500 font-medium mt-1">ห้อง: {(r.room_name || r.room || "-").replace(/ห้องเรียน|ห้อง/g, "").trim()}</div>
                                                                        </div>
                                                                    ))}
                                                                    {matches.length > 1 && (
                                                                        <div className="text-[10px] font-bold text-rose-700 px-1 mt-1.5">ชนเวลา {matches.length} รายการ</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'exam' && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-6">
                                <h3 className="text-lg font-bold text-slate-800">ตารางสอบ</h3>
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-md">กำหนดการสอบ</span>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200 uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-600">รหัสวิชา</th>
                                            <th className="px-6 py-4 font-semibold text-slate-600">ชื่อรายวิชา</th>
                                            <th className="px-6 py-4 font-semibold text-slate-600 text-center">สอบกลางภาค</th>
                                            <th className="px-6 py-4 font-semibold text-slate-600 text-center">สอบปลายภาค</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedExams.size === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                                    ยังไม่มีข้อมูลกำหนดการสอบ
                                                </td>
                                            </tr>
                                        ) : (
                                            Array.from(groupedExams.values()).map((item: any, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{item.subject_code}</td>
                                                    <td className="px-6 py-4 text-slate-600">{item.subject_name}</td>
                                                    <td className="px-6 py-4">
                                                        {renderExamCell(item.midterm)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {renderExamCell(item.final)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
