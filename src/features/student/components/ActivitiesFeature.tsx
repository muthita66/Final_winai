"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";

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
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 543);
    const [selectedSemester, setSelectedSemester] = useState(1);
    const [selectedActivityForEval, setSelectedActivityForEval] = useState<any | null>(null);

    const evalQuery = useQuery({
        queryKey: ["student", "activities", "evaluation", selectedYear, selectedSemester],
        queryFn: () => StudentApiService.getActivityEvaluations(selectedYear, selectedSemester),
        enabled: view === 'evaluation',
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

    const monthEvents = events.filter((ev) => {
        if (!ev.date) return false;
        const d = new Date(ev.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const eventMap = new Map();
    monthEvents.forEach((ev: any) => {
        try {
            const d = new Date(ev.date);
            if (!isNaN(d.getTime())) {
                const key = d.toISOString().slice(0, 10);
                if (!eventMap.has(key)) eventMap.set(key, []);
                eventMap.get(key).push(ev);
            }
        } catch (e: any) {
            console.error("Invalid date for event", ev);
        }
    });

    const classifyEvent = (name = "") => {
        if (name.includes("ประชุม")) return "meeting text-blue-700 bg-blue-50 border-blue-200";
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
                    dateKey = new Date(year, month, dayNum).toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD

                    if (!eventMap.has(dateKey)) {
                        // Fallback to ISO string if locale varies
                        const isoD = new Date(year, month, dayNum);
                        isoD.setHours(12); // avoid timezone shifts
                        dateKey = isoD.toISOString().slice(0, 10);
                    }

                    dayNum++;
                }

                const dayEvents = eventMap.get(dateKey) || [];

                days.push(
                    <td
                        key={i}
                        className={`border border-slate-200 p-1 md:p-2 align-top h-24 md:h-32 transition-colors hover:bg-slate-50 relative cursor-pointer ${!isCurrentMonth ? 'opacity-40 bg-slate-50/50' : 'bg-white'}`}
                        onClick={() => {
                            if (dayEvents.length > 0) {
                                setSelectedDateEvents({ date: dateKey, events: dayEvents });
                            }
                        }}
                    >
                        <div className="flex flex-col h-full">
                            <div className={`text-right text-sm font-medium p-1 ${isCurrentMonth && dayNum - 1 === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? 'text-indigo-600 font-bold bg-indigo-50 rounded-full w-7 h-7 flex items-center justify-center ml-auto' : 'text-slate-600'}`}>
                                {displayDay}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 custom-scrollbar">
                                {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                                    <div key={idx} className={`text-xs px-2 py-1 rounded border truncate shadow-sm cursor-pointer hover:shadow-md transition-shadow ${classifyEvent(ev.name)}`} title={ev.name}>
                                        {ev.name}
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

        if (isEvalLoading) return <div className="py-10 text-center text-slate-500">กำลังโหลดรายการกิจกรรม...</div>;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-700">ปีการศึกษา:</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {[...Array(5)].map((_, i) => {
                                const y = new Date().getFullYear() + 543 - i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-700">ภาคเรียน:</label>
                        <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                        </select>
                    </div>
                </div>

                {evals.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <p className="text-lg">— ไม่พบกิจกรรมที่คุณเข้าร่วมในภาคเรียนนี้ —</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {evals.map((ev: any) => (
                            <div key={ev.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-slate-800 line-clamp-2 pr-2">{ev.title}</h4>
                                        {ev.is_evaluated ? (
                                            <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg shrink-0 border border-green-100 uppercase tracking-wider">ประเมินแล้ว</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg shrink-0 border border-amber-100 uppercase tracking-wider">ยังไม่ประเมิน</span>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span>{formatDate(ev.date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="truncate">{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-5">
                                    {ev.is_evaluated ? (
                                        <button disabled className="w-full py-2 bg-slate-100 text-slate-400 rounded-xl text-sm font-bold cursor-not-allowed">
                                            ทำแบบประเมินแล้ว
                                        </button>
                                    ) : ev.has_evaluation ? (
                                        <button 
                                            onClick={() => setSelectedActivityForEval(ev)}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                                        >
                                            ประเมินกิจกรรม
                                        </button>
                                    ) : (
                                        <button disabled className="w-full py-2 bg-slate-50 text-slate-400 rounded-xl text-sm font-medium italic cursor-not-allowed">
                                            ไม่มีแบบประเมิน
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const EvaluationModal = ({ activity, onClose }: { activity: any, onClose: () => void }) => {
        const [answers, setAnswers] = useState<Record<string, number | string>>({});
        const [feedback, setFeedback] = useState("");
        const [isSubmitting, setIsSubmitting] = useState(false);

        const questionsQuery = useQuery({
            queryKey: ["evaluation", "questions", activity.form_id],
            queryFn: () => StudentApiService.getEvaluationFormQuestions(activity.form_id),
            enabled: !!activity.form_id,
        });

        const questions = Array.isArray(questionsQuery.data) ? questionsQuery.data : [];

        const handleSubmit = async () => {
            try {
                // Validate all scale questions are answered
                const scaleQuestions = questions.filter(q => q.type === 'scale');
                const unanswered = scaleQuestions.find(q => answers[q.name] === undefined);
                if (unanswered) {
                    alert(`กรุณาตอบคำถาม: ${unanswered.name}`);
                    return;
                }

                setIsSubmitting(true);
                const payload = Object.entries(answers).map(([name, value]) => ({ name, value }));
                
                await StudentApiService.submitActivityEvaluation({
                    activity_id: activity.id,
                    year: selectedYear,
                    semester: selectedSemester,
                    data: payload,
                    feedback
                });

                evalQuery.refetch();
                alert("บันทึกการประเมินกิจกรรมสำเร็จ");
                onClose();
            } catch (error: any) {
                alert("เกิดข้อผิดพลาด: " + error.message);
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white relative shrink-0 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-all hover:rotate-90">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h3 className="text-2xl font-black mb-2">แบบประเมินกิจกรรม</h3>
                        <p className="text-indigo-100 text-sm font-medium opacity-90">{activity.title}</p>
                    </div>

                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                        {questionsQuery.isLoading ? (
                            <div className="py-20 text-center text-slate-400 font-medium">กำลังโหลดคำถาม...</div>
                        ) : questions.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-medium">ไม่พบรายการประเมินสำหรับกิจกรรมนี้</div>
                        ) : (
                            <div className="space-y-10">
                                {Object.values(questions.reduce((groups: any, q: any) => {
                                    const group = q.section_name || "ทั่วไป";
                                    if (!groups[group]) groups[group] = [];
                                    groups[group].push(q);
                                    return groups;
                                }, {})).map((sectionQuestions: any, sIdx: number) => (
                                    <div key={sIdx} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                        <h4 className="text-indigo-600 font-black text-sm uppercase tracking-widest mb-6 border-b border-indigo-50 pb-2">
                                            {sectionQuestions[0].section_name || "ส่วนที่ " + (sIdx + 1)}
                                        </h4>
                                        <div className="space-y-8">
                                            {sectionQuestions.map((q: any) => (
                                                <div key={q.id} className="space-y-4">
                                                    <p className="text-slate-800 font-bold leading-relaxed">{q.name}</p>
                                                    {q.type === 'scale' ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {(q.options || []).map((opt: any) => (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => setAnswers(prev => ({ ...prev, [q.name]: opt.value }))}
                                                                    className={`flex-1 min-w-[60px] py-3 rounded-2xl text-xs font-black transition-all border-2 ${answers[q.name] === opt.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 -translate-y-0.5' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <textarea
                                                            value={String(answers[q.name] || "")}
                                                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.name]: e.target.value }))}
                                                            placeholder="ระบุข้อเสนอแนะหรือความคิดเห็น..."
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[100px] font-medium"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                                    <label className="text-amber-800 font-black text-sm uppercase tracking-widest mb-4 block">ข้อเสนอแนะเพิ่มเติม</label>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="คุณมีความคิดเห็นอย่างไรเกี่ยวกับกิจกรรมนี้?"
                                        className="w-full bg-white border-2 border-amber-100 rounded-2xl p-4 text-sm focus:border-amber-400 transition-all outline-none min-h-[100px] font-medium"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-8 bg-white border-t border-slate-100 flex gap-4 shrink-0">
                        <button onClick={onClose} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl text-sm font-black hover:bg-slate-100 transition-all">ยกเลิก</button>
                        <button 
                            disabled={isSubmitting || questions.length === 0}
                            onClick={handleSubmit} 
                            className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-2xl text-sm font-black hover:shadow-xl hover:shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? "กำลังบันทึก..." : "ส่งการประเมิน"}
                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </button>
                    </div>
                </div>
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
                    // Use UTC methods to avoid timezone shifts from DB local timestamps
                    const dateNum = d.getUTCDate();
                    const monthIdx = d.getUTCMonth();

                    return (
                        <div key={idx} className={`flex gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${classifyEvent(ev.name)}`}>
                            <div className="flex flex-col items-center justify-center bg-white/80 rounded-xl p-3 min-w-[70px] shrink-0 shadow-sm border border-black/5">
                                <span className="text-2xl font-black leading-none">{dateNum}</span>
                                <span className="text-xs uppercase font-bold mt-1 opacity-70">{TH_MONTHS_SHORT[monthIdx]}</span>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-bold text-lg leading-tight mb-1 truncate">{ev.name}</h4>
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
        .filter((ev: any) => ev.date)
        .map((ev: any) => ({ ...ev, dateObj: new Date(ev.start_date || ev.date) }))
        .filter((ev: any) => ev.dateObj >= todayDate)
        .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime())
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
                <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
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
            <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                        Activities
                    </div>
                    <h1 className="text-2xl font-bold mb-1">ปฏิทินกิจกรรมโรงเรียน</h1>
                    <p className="text-indigo-100 text-sm mb-4 max-w-xl">
                        ติดตามกิจกรรมที่จะมาถึงและกิจกรรมที่ผ่านมาทั้งหมดตลอดปีการศึกษา
                    </p>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 inline-flex flex-col items-start min-w-[200px]">
                        <div className="text-indigo-100 text-xs font-medium mb-1.5">กิจกรรมที่กำลังจะมาถึง</div>
                        <div className="text-xl font-bold text-white flex items-center gap-2">
                            {upcomingEvents.length} รายการ
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                </svg>
            </section>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Calendar View */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => shiftMonth(-1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button onClick={() => shiftMonth(1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800" id="studentCalMonthLabel">
                            {TH_MONTHS[month]} {year + 543}
                        </h2>
                        <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
                            <button
                                onClick={() => setView('month')}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${view === 'month' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                เดือน
                            </button>
                            <button
                                onClick={() => setView('list')}
                                className={`px-4 py-2 font-medium text-sm border-l border-slate-200 transition-colors ${view === 'list' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                ลิสต์
                            </button>
                            <button
                                onClick={() => setView('evaluation')}
                                className={`px-4 py-2 font-medium text-sm border-l border-slate-200 transition-colors ${view === 'evaluation' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                ประเมินกิจกรรม
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl p-1">
                        {view === 'month' ? (
                            <table className="w-full text-slate-800 min-w-[700px] border-collapse bg-white">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="py-3 px-2 text-center text-red-500 font-medium border-r border-slate-200 w-[14.28%]">อา.</th>
                                        <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">จ.</th>
                                        <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">อ.</th>
                                        <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">พ.</th>
                                        <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">พฤ.</th>
                                        <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">ศ.</th>
                                        <th className="py-3 px-2 text-center text-indigo-500 font-medium w-[14.28%]">ส.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderCalendarGrid()}
                                </tbody>
                            </table>
                        ) : view === 'list' ? (
                            <div className="bg-white p-4">
                                {renderListView()}
                            </div>
                        ) : (
                            <div className="bg-white p-4">
                                {renderEvaluationView()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming Side List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800 leading-tight">กำลังจะมาถึง</h3>
                                <p className="text-slate-500 text-xs">กิจกรรมในปฏิทิน</p>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
                            {upcomingEvents.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    — ยังไม่มีกิจกรรมที่กำลังจะมาถึง —
                                </div>
                            ) : (
                                upcomingEvents.map((ev, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group">
                                        <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-700 rounded-lg p-2 min-w-[50px] shrink-0 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                                            <span className="text-lg font-bold leading-none">{ev.dateObj.getUTCDate()}</span>
                                            <span className="text-xs uppercase font-medium mt-1">{TH_MONTHS_SHORT[ev.dateObj.getUTCMonth()]}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-slate-800 text-sm truncate" title={ev.name}>{ev.name}</h4>
                                            <div className="mt-1 flex flex-wrap items-center text-xs text-slate-500 gap-y-1 gap-x-3">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    <span className="truncate" title={ev.location || "ไม่ได้ระบุ"}>{ev.location || "ไม่ได้ระบุ"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span>{formatTimeRange(ev)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
            {/* Event Detail Modal */}
            {selectedDateEvents && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white relative">
                            <button
                                onClick={() => setSelectedDateEvents(null)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <h3 className="text-xl font-bold mb-1">
                                กิจกรรมวันที่ {new Date(selectedDateEvents.date).getUTCDate()} {TH_MONTHS[new Date(selectedDateEvents.date).getUTCMonth()]} {new Date(selectedDateEvents.date).getUTCFullYear() + 543}
                            </h3>
                            <p className="text-indigo-100 text-sm opacity-90">
                                พบ {selectedDateEvents.events.length} รายการ
                            </p>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
                            {selectedDateEvents.events.map((ev, idx) => (
                                <div key={idx} className={`p-5 rounded-2xl border-l-4 shadow-sm ${classifyEvent(ev.name)}`}>
                                    <div className="flex justify-between items-start mb-2 group">
                                        <h4 className="font-bold text-lg text-slate-800 leading-tight">{ev.name}</h4>
                                    </div>

                                    <div className="space-y-2 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-100 rounded-md">
                                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <span>{formatTimeRange(ev)}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-100 rounded-md">
                                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                            <span>{ev.location || "ไม่ได้ระบุสถานที่"}</span>
                                        </div>

                                        {ev.description && (
                                            <div className="mt-4 pt-4 border-t border-black/5">
                                                <p className="text-slate-500 leading-relaxed">
                                                    {ev.description}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            )}

            {/* Evaluation Modal */}
            {selectedActivityForEval && (
                <EvaluationModal 
                    activity={selectedActivityForEval} 
                    onClose={() => setSelectedActivityForEval(null)} 
                />
            )}
        </div>
    );
}
