"use client";
import { useState, useEffect } from "react";

interface ScheduleSlot {
    assignment_id: number;
    subject_code: string;
    subject_name: string;
    credit: any;
    class_level: string;
    classroom: string;
    day_id: number;
    day_name: string;
    day_short: string;
    day_color: string | null;
    period_id: number;
    period_name: string;
    start_time: string;
    end_time: string;
    room: string;
    subject_type: string;
    semester: number;
    academic_year: string;
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7]; // Sun=1..Sat=7 (depends on DB)
const DAY_COLORS: Record<number, { bg: string; text: string; border: string }> = {
    1: { bg: "bg-amber-50 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]", text: "text-amber-700", border: "border-amber-200" }, // Monday (Yellow/Amber)
    2: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" }, // Tuesday
    3: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" }, // Wednesday (Green)
    4: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" }, // Thursday
    5: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" }, // Friday (Blue/Sky)
    6: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" }, // Saturday
    7: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" }, // Sunday
};

export function TeachingScheduleFeature({ session }: { session: any }) {
    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/teacher/teaching-schedule?teacher_id=${session.id}`);
                const json = await res.json();
                setSlots(json?.data || []);
            } catch (e: any) {
                setError(e?.message || "โหลดตารางสอนไม่สำเร็จ");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [session.id]);

    // Group by day
    const byDay: Record<number, ScheduleSlot[]> = {};
    for (const slot of slots) {
        if (!byDay[slot.day_id]) byDay[slot.day_id] = [];
        byDay[slot.day_id].push(slot);
    }
    const activeDays = Object.keys(byDay).map(Number).sort((a, b) => a - b);

    // Get all unique periods sorted
    const allPeriods = Array.from(
        new Map(slots.map(s => [s.period_id, { period_id: s.period_id, period_name: s.period_name, start_time: s.start_time, end_time: s.end_time }])).values()
    ).sort((a, b) => (a.period_id ?? 99) - (b.period_id ?? 99));

    // Helper to get classroom suffix (e.g., "1/2" -> "2")
    const getRoomSuffix = (roomStr: string) => roomStr.includes('/') ? roomStr.split('/').pop() || '-' : roomStr;


    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">ยังไม่มีตารางสอน</p>
            <p className="text-sm mt-1">ภาคเรียนนี้ยังไม่มีคาบสอนที่ถูกกำหนดไว้</p>
        </div>
    );

    const renderSlotCard = (slot: ScheduleSlot, idx: number) => {
        const colors = DAY_COLORS[slot.day_id] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
        return (
            <div key={`${slot.assignment_id}-${slot.period_id}-${idx}`}
                className={`${colors.bg} ${colors.border} border rounded-lg p-2 text-xs space-y-0.5`}>
                <div className={`font-bold text-sm ${colors.text} leading-tight`}>{slot.subject_name}</div>
                <div className="text-slate-500">{slot.subject_code} • {slot.credit} หน่วยกิต</div>
                <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="bg-white/80 px-1.5 py-0.5 rounded-full border border-slate-200 text-slate-600 flex items-center gap-1 w-fit">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {slot.class_level}/{slot.classroom.includes('/') ? slot.classroom.split('/').pop() : slot.classroom}
                    </span>
                    <span className="bg-white/80 px-1.5 py-0.5 rounded-full border border-slate-200 text-slate-600 flex items-center gap-1 w-fit">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        ห้อง {slot.room.replace(/^(ห้องเรียน|ห้อง)\s*/, '')}
                    </span>
                </div>
                <div className="text-slate-500 pt-0.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {slot.start_time} – {slot.end_time}
                </div>
            </div>
        );
    };

    const renderListView = () => (
        <div className="space-y-4">
            {activeDays.map(dayId => {
                const daySlots = byDay[dayId];
                const colors = DAY_COLORS[dayId] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
                return (
                    <div key={dayId} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className={`${colors.bg} px-6 py-3 border-b ${colors.border} flex items-center justify-between`}>
                            <h3 className={`font-bold text-base ${colors.text}`}>วัน{daySlots[0]?.day_name ?? "-"}</h3>
                            <span className={`text-xs px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border ${colors.text} font-medium`}>
                                {daySlots.length} คาบ
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {daySlots.map((slot, i) => (
                                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                                    <div className={`shrink-0 w-20 text-center`}>
                                        <div className={`text-sm font-bold ${colors.text}`}>{slot.period_name}</div>
                                        <div className="text-xs text-slate-400">{slot.start_time}–{slot.end_time}</div>
                                    </div>
                                    <div className="h-10 w-px bg-slate-200" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-slate-800 truncate">{slot.subject_name}</div>
                                        <div className="text-xs text-slate-500">{slot.subject_code} • {slot.credit} หน่วยกิต</div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500 shrink-0">
                                        <div className="font-medium text-slate-700">{slot.class_level}/{slot.classroom.includes('/') ? slot.classroom.split('/').pop() : slot.classroom}</div>
                                        <div>ห้อง {slot.room.replace(/^(ห้องเรียน|ห้อง)\s*/, '')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderGridView = () => {
        if (allPeriods.length === 0) return null;

        // Standard Mon-Fri (1-5 based on previous feedback where Mon=1)
        const weekDays = [1, 2, 3, 4, 5];
        const DAY_NAMES_TH: Record<number, string> = {
            1: "จันทร์", 2: "อังคาร", 3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์"
        };

        // Calculate total table width to ensure equal column sizing
        const dayColWidth = 80;
        const periodColWidth = 140;
        const totalTableWidth = dayColWidth + (allPeriods.length * periodColWidth);

        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto">
                <table
                    className="border-collapse table-fixed"
                    style={{ minWidth: `${totalTableWidth}px`, width: '100%' }}
                >
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 border-r border-slate-200" style={{ width: `${dayColWidth}px` }}>
                                วัน / คาบ
                            </th>
                            {allPeriods.map(period => (
                                <th
                                    key={period.period_id}
                                    className="px-1 py-2 text-center border-r border-slate-200 last:border-r-0"
                                    style={{ width: `${periodColWidth}px` }}
                                >
                                    <div className="text-sm font-bold text-slate-700">{period.period_name}</div>
                                    <div className="text-[10px] text-slate-400 font-normal">{period.start_time}–{period.end_time}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {weekDays.map(dayId => {
                            const colors = DAY_COLORS[dayId] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
                            const sample = byDay[dayId]?.[0];
                            const dayName = sample?.day_name || DAY_NAMES_TH[dayId] || dayId.toString();

                            return (
                                <tr key={dayId} className="border-b border-slate-100 last:border-b-0">
                                    <td className={`px-2 py-2 border-r border-slate-200 ${colors.bg} font-bold ${colors.text} text-sm text-center`}>
                                        วัน{dayName}
                                    </td>
                                    {allPeriods.map(period => {
                                        const slot = byDay[dayId]?.find(s => s.period_id === period.period_id);
                                        return (
                                            <td key={period.period_id} className="p-1 border-r border-slate-100 last:border-r-0 align-top">
                                                {slot ? renderSlotCard(slot, dayId) : (
                                                    <div className="h-full min-h-[60px] flex items-center justify-center text-slate-200 text-xs">—</div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Hero Banner */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500 rounded-full blur-2xl opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Teaching Schedule</div>
                        <h1 className="text-3xl font-bold">ตารางสอน</h1>
                        <p className="text-blue-100 mt-2">ตารางการสอนประจำภาคเรียนของคุณ</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[120px]">
                        <div className="text-3xl font-bold">{slots.length}</div>
                        <div className="text-blue-100 text-sm mt-1">คาบสอนทั้งหมด</div>
                    </div>
                </div>
            </section>

            {/* View Toggle */}
            {!loading && !error && slots.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${viewMode === "list" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        รายวัน
                    </button>
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${viewMode === "grid" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        ตาราง
                    </button>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-2xl p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                    <svg className="w-8 h-8 animate-spin text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p>กำลังโหลดตารางสอน...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-8 text-center">{error}</div>
            ) : slots.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">{renderEmpty()}</div>
            ) : viewMode === "list" ? renderListView() : renderGridView()}

        </div>
    );
}
