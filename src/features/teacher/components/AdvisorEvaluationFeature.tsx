"use client";

import React, { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import toast from "react-hot-toast";
import { getCurrentAcademicYearBE, getRecentAcademicYearsBE, getAcademicSemesterDefault } from "@/features/student/academic-term";

interface AdvisorEvaluationFeatureProps {
    session: any;
}

function getScoreTextColor(avg: number): string {
    if (avg >= 4) return "text-emerald-600";
    if (avg >= 3) return "text-teal-600";
    if (avg >= 2) return "text-amber-600";
    return "text-rose-600";
}

// Participation summary card
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div className={`${color} rounded-2xl p-5 flex flex-col gap-1.5 min-w-[120px] flex-1`}>
            <div className="text-2xl font-black tracking-tight">{value}</div>
            <div className="text-xs font-bold opacity-80 uppercase tracking-wider leading-tight">{label}</div>
        </div>
    );
}

// Participation table component
function ParticipationTable({
    students,
    searchTerm,
    onSearchChange,
}: {
    students: any[];
    searchTerm: string;
    onSearchChange: (v: string) => void;
}) {
    const filtered = students.filter((s) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (s.student_code || "").toLowerCase().includes(q) ||
            (s.student_name || s.name || "").toLowerCase().includes(q)
        );
    });

    const evaluated = students.filter((s) => s.evaluated || s.submitted_at).length;
    const notEvaluated = students.length - evaluated;

    return (
        <div className="space-y-5">
            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
                <StatCard label="นักเรียนทั้งหมด" value={students.length} color="bg-slate-100 text-slate-800" />
                <StatCard label="ประเมินแล้ว" value={evaluated} color="bg-emerald-50 text-emerald-700" />
                <StatCard label="ยังไม่ประเมิน" value={notEvaluated} color="bg-rose-50 text-rose-700" />
                {students.length > 0 && (
                    <StatCard
                        label="อัตราการประเมิน"
                        value={`${Math.round((evaluated / students.length) * 100)}%`}
                        color="bg-teal-50 text-teal-700"
                    />
                )}
            </div>

            {/* Progress bar */}
            {students.length > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <span>ความคืบหน้าการประเมิน</span>
                        <span>{evaluated} / {students.length} คน</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-50 rounded-full transition-all duration-700"
                            style={{ width: `${students.length > 0 ? (evaluated / students.length) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="ค้นหาชื่อ หรือรหัสนักเรียน..."
                    className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all font-medium shadow-sm"
                />
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 text-sm font-bold text-slate-500 text-center w-20 whitespace-nowrap">เลขที่</th>
                                <th className="px-5 py-3 text-sm font-bold text-slate-500 w-32">รหัสนักเรียน</th>
                                <th className="px-5 py-3 text-sm font-bold text-slate-500">ชื่อ-นามสกุล</th>
                                <th className="px-5 py-3 text-sm font-bold text-slate-500 text-center">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                                filtered.map((s, idx) => {
                                    const isEval = !!(s.evaluated || s.submitted_at);
                                    return (
                                        <tr
                                            key={s.id || idx}
                                            className={`transition-colors ${isEval ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "hover:bg-slate-50/70"}`}
                                        >
                                            <td className="px-5 py-3 text-center text-sm text-slate-400">
                                                {(idx + 1).toString().padStart(2, "0")}
                                            </td>
                                            <td className="px-5 py-3 text-slate-500 text-sm font-normal">
                                                {s.student_code}
                                            </td>
                                            <td className="px-5 py-3 text-slate-700 text-sm font-normal">
                                                {s.student_name || s.name || "—"}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {isEval ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                        ประเมินแล้ว
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-100">
                                                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
                                                        ยังไม่ประเมิน
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-slate-400 italic font-medium">
                                        {searchTerm ? "ไม่พบนักเรียนตามเงื่อนไขการค้นหา" : "ยังไม่มีข้อมูลนักเรียน"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Score summary section
function ScoreSummary({ summary, comments }: { summary: any[]; comments: any[] }) {
    const overallAvg = summary.length > 0
        ? summary.reduce((a, b) => a + Number(b.average), 0) / summary.length
        : 0;

    // Group by section
    const sectionNames = Array.from(new Set(summary.map(s => s.section_name || "ไม่ระบุตอน")));
    const grouped = sectionNames.map(name => ({
        name,
        items: summary.filter(s => (s.section_name || "ไม่ระบุตอน") === name)
    }));

    return (
        <div className="space-y-8">
            {/* Scores */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Topic list */}
                <div className="lg:col-span-3 space-y-6">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                        คะแนนเฉลี่ยรายหัวข้อ
                    </h3>
                    {summary.length > 0 ? (
                        <div className="space-y-8">
                            {grouped.map((section, sIdx) => (
                                <div key={sIdx} className="space-y-3">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border-l-4 border-emerald-400">
                                        <span className="text-sm md:text-base font-black text-emerald-600 uppercase tracking-wider">{section.name}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {section.items.map((item: any, idx: number) => {
                                            const avg = Number(item.average || 0);
                                            const displayTopic = item.topic.replace(/^\d+(\.\d+)?\s*/, '');
                                            return (
                                                <div key={idx} className="flex justify-between items-baseline gap-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all px-2 rounded-lg">
                                                    <span className="text-sm md:text-base font-medium text-slate-700 leading-relaxed flex-1 min-w-0">{displayTopic}</span>
                                                    <span className={`flex-shrink-0 text-sm font-medium ${getScoreTextColor(avg)}`}>
                                                        {avg.toFixed(2)} <span className="text-slate-300 font-normal">/ 5</span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 italic font-medium">
                            ยังไม่มีข้อมูลการประเมิน
                        </div>
                    )}
                </div>

                {/* Overall avg card */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="sticky top-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 flex flex-col items-center justify-center text-center gap-4 shadow-sm h-fit">
                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">คะแนนรวมเฉลี่ย</div>
                        <div className={`text-6xl font-black tracking-tighter ${summary.length > 0 ? getScoreTextColor(overallAvg) : "text-slate-300"}`}>
                            {summary.length > 0 ? overallAvg.toFixed(2) : "—"}
                        </div>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const filled = overallAvg >= star;
                                const half = !filled && overallAvg >= star - 0.5;
                                return (
                                    <svg
                                        key={star}
                                        className={`w-5 h-5 ${filled || half ? "text-amber-400" : "text-slate-200"} fill-current`}
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                );
                            })}
                        </div>
                        <p className="text-slate-500 text-xs font-bold">จาก {summary[0]?.count ?? "—"} การตอบกลับ</p>
                    </div>

                    {/* Comments section repositioned here */}
                    <div className="space-y-4">
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-2">
                            <div className="w-1 h-5 bg-teal-500 rounded-full" />
                            ข้อเสนอแนะจากนักเรียน
                            <span className="ml-1 px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] rounded-full font-bold uppercase border border-teal-100">
                                {comments.length} รายการ
                            </span>
                        </h3>

                        {comments.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 border-b border-slate-100 text-[14px] font-black text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3 w-28">วันที่</th>
                                            <th className="px-4 py-3">ข้อเสนอแนะจากนักเรียน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {comments.map((c: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-teal-50/5 transition-colors">
                                                <td className="px-4 py-3 text-[12px] text-slate-500 font-normal whitespace-nowrap align-top">
                                                    {new Date(c.submitted_at || c.created_at).toLocaleDateString("th-TH")}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 font-normal leading-relaxed">
                                                    {c.text}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 italic font-medium text-xs">
                                ยังไม่มีข้อเสนอแนะในภาคเรียนนี้
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AdvisorEvaluationFeature({ session }: AdvisorEvaluationFeatureProps) {
    const teacher_id = session.id;

    // Main tabs: subject results vs advisor results
    const [activeTab, setActiveTab] = useState<"subject" | "advisor">("subject");

    // Filter states
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());

    // Subject tab states
    const [assignments, setAssignments] = useState<any[]>([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
    const [subjectStudents, setSubjectStudents] = useState<any[]>([]);
    const [subjectSummary, setSubjectSummary] = useState<any[]>([]);
    const [subjectComments, setSubjectComments] = useState<any[]>([]);
    const [subjectSearch, setSubjectSearch] = useState("");
    const [isSubjectLoading, setIsSubjectLoading] = useState(false);

    // Advisor tab states
    const [advisorStudents, setAdvisorStudents] = useState<any[]>([]);
    const [advisorSummary, setAdvisorSummary] = useState<any[]>([]);
    const [advisorComments, setAdvisorComments] = useState<any[]>([]);
    const [advisorSearch, setAdvisorSearch] = useState("");
    const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Load assignments for subject tab
    useEffect(() => {
        if (activeTab !== "subject") return;
        const load = async () => {
            try {
                const data = await TeacherApiService.getTeachingEvaluation(teacher_id, year, semester);
                setAssignments(data || []);
                if (data && data.length > 0) {
                    setSelectedAssignmentId((prev) => {
                        const valid = data.some((a: any) => a.teaching_assignment_id === prev);
                        return valid ? prev : data[0].teaching_assignment_id;
                    });
                } else {
                    setSelectedAssignmentId(null);
                }
            } catch (err) {
                console.error("Failed to load assignments", err);
                setAssignments([]);
            }
        };
        load();
    }, [activeTab, teacher_id, year, semester]);

    // Load subject evaluation results when assignment changes
    useEffect(() => {
        if (!selectedAssignmentId) {
            setSubjectStudents([]);
            setSubjectSummary([]);
            setSubjectComments([]);
            return;
        }
        const load = async () => {
            setIsSubjectLoading(true);
            try {
                const [resultsData, studentsData] = await Promise.all([
                    TeacherApiService.getTeachingEvaluationDetailed(teacher_id, selectedAssignmentId, year, semester),
                    TeacherApiService.getTeachingStudentEvaluationResults(teacher_id, selectedAssignmentId, year, semester),
                ]);
                setSubjectSummary(resultsData?.summary || []);
                setSubjectComments(resultsData?.comments || []);
                setSubjectStudents(studentsData || []);
            } catch (err) {
                console.error("Failed to load subject results", err);
                toast.error("ไม่สามารถโหลดข้อมูลผลประเมินได้");
            } finally {
                setIsSubjectLoading(false);
            }
        };
        load();
    }, [selectedAssignmentId, teacher_id, year, semester]);

    // Load advisor evaluation results
    useEffect(() => {
        if (activeTab !== "advisor") return;
        const load = async () => {
            setIsAdvisorLoading(true);
            try {
                const [resSummary, resStudents] = await Promise.all([
                    TeacherApiService.getAdvisorEvaluation(teacher_id, year, semester),
                    TeacherApiService.getAdvisoryStudents(teacher_id, year, semester, "student_results"),
                ]);

                const topicMap = new Map<string, { total: number; count: number; section: string; topic: string }>();
                const comments: any[] = [];

                (resSummary || []).forEach((r: any) => {
                    const topic = r.topic || "ไม่ระบุหัวข้อ";
                    const section = r.section_name || "ไม่ระบุตอน";
                    const key = `${section}@@${topic}`;
                    const cur = topicMap.get(key) || { total: 0, count: 0, section, topic };
                    topicMap.set(key, {
                        total: cur.total + Number(r.score || 0),
                        count: cur.count + 1,
                        section,
                        topic
                    });
                    if (r.feedback?.trim() && !comments.find((c) => c.text === r.feedback)) {
                        comments.push({ text: r.feedback, submitted_at: r.submitted_at || r.created_at });
                    }
                });

                const summary = Array.from(topicMap.values()).map((val) => ({
                    topic: val.topic,
                    section_name: val.section,
                    count: val.count,
                    average: val.count ? (val.total / val.count).toFixed(2) : "0",
                }));

                setAdvisorSummary(summary);
                setAdvisorComments(comments);
                setAdvisorStudents(resStudents || []);
            } catch (err) {
                console.error("Failed to load advisor results", err);
                toast.error("ไม่สามารถโหลดข้อมูลผลประเมินได้");
            } finally {
                setIsAdvisorLoading(false);
            }
        };
        load();
    }, [activeTab, teacher_id, year, semester]);

    const isLoading = activeTab === "subject" ? isSubjectLoading : isAdvisorLoading;

    return (
        <div className="space-y-6">
            {/* Header */}
            <section className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[-20%] left-[30%] w-48 h-48 bg-teal-400/20 rounded-full blur-2xl" />
                <div className="relative z-10">
                    <div className="space-y-2">
                        <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-sm text-emerald-50">
                            Results Analysis
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white">ผลการประเมินนักเรียน</h1>
                        <p className="text-emerald-100 font-medium">ดูสรุปและรายละเอียดผลการประเมินในที่ปรึกษา</p>
                    </div>
                </div>
            </section>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-end bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <label className="block text-[14px] font-black text-slate-700 uppercase mb-1.5 ml-1">ปีการศึกษา</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-xl bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all cursor-pointer min-w-[120px]"
                    >
                        {getRecentAcademicYearsBE(5).map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[14px] font-black text-slate-700 uppercase mb-1.5 ml-1">ภาคเรียน</label>
                    <select
                        value={semester}
                        onChange={(e) => setSemester(Number(e.target.value))}
                        className="rounded-xl bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all cursor-pointer min-w-[100px]"
                    >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <div className="ml-auto flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider pb-2">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    อัปเดตข้อมูลล่าสุด {isMounted ? new Date().toLocaleTimeString("th-TH") : ""}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => setActiveTab("subject")}
                    className={`flex items-center gap-4 px-6 py-5 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${activeTab === "subject"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200 scale-[1.02]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                        }`}
                >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${activeTab === "subject" ? "bg-white/20" : "bg-emerald-50 text-emerald-600"}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-black">ผลประเมินรายวิชาจากนักเรียน</div>
                        <div className={`text-xs mt-0.5 ${activeTab === "subject" ? "text-emerald-100" : "text-slate-400"}`}>
                            ดูผลที่นักเรียนประเมินการสอนในรายวิชา
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setActiveTab("advisor")}
                    className={`flex items-center gap-4 px-6 py-5 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${activeTab === "advisor"
                        ? "bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-200 scale-[1.02]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50"
                        }`}
                >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${activeTab === "advisor" ? "bg-white/20" : "bg-teal-50 text-teal-600"}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-black">ผลการประเมินจากนักเรียนในที่ปรึกษา</div>
                        <div className={`text-xs mt-0.5 ${activeTab === "advisor" ? "text-teal-100" : "text-slate-400"}`}>
                            ดูผลที่นักเรียนในที่ปรึกษาประเมินครู
                        </div>
                    </div>
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                {activeTab === "subject" && (
                    <div className="animate-in fade-in duration-300">
                        <div className="px-8 pt-8 pb-0">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">เลือกรายวิชา</h2>
                            </div>
                            {assignments.length > 0 ? (
                                <select
                                    value={selectedAssignmentId ?? ""}
                                    onChange={(e) => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full md:w-auto min-w-[320px] rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-400 outline-none transition-all shadow-sm cursor-pointer"
                                >
                                    <option value="">— กรุณาเลือกรายวิชา —</option>
                                    {assignments.map((as) => (
                                        <option key={as.teaching_assignment_id} value={as.teaching_assignment_id}>
                                            {as.subject_code} — {as.subject_name} ({as.class_level}/{as.room?.split("/").pop()})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="py-4 text-sm text-slate-400 italic">ไม่พบรายวิชาในภาคเรียนนี้</div>
                            )}
                        </div>

                        <div className="border-t border-slate-100 mt-6" />

                        {isSubjectLoading ? (
                            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-medium">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : !selectedAssignmentId ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                                <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="font-medium text-lg text-slate-400">กรุณาเลือกรายวิชาเพื่อดูผล</p>
                            </div>
                        ) : (
                            <div className="p-8 space-y-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-5">
                                        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                        <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">สถานะการประเมินของนักเรียน</h2>
                                    </div>
                                    <ParticipationTable
                                        students={subjectStudents}
                                        searchTerm={subjectSearch}
                                        onSearchChange={setSubjectSearch}
                                    />
                                </div>

                                <div className="border-t border-slate-100" />
                                <ScoreSummary summary={subjectSummary} comments={subjectComments} />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "advisor" && (
                    <div className="animate-in fade-in duration-300">
                        {isAdvisorLoading ? (
                            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-medium">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : (
                            <div className="p-8 space-y-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-5">
                                        <div className="w-1 h-5 bg-teal-500 rounded-full" />
                                        <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">สถานะการประเมินของนักเรียนในที่ปรึกษา</h2>
                                    </div>
                                    <ParticipationTable
                                        students={advisorStudents}
                                        searchTerm={advisorSearch}
                                        onSearchChange={setAdvisorSearch}
                                    />
                                </div>

                                <div className="border-t border-slate-100" />
                                <ScoreSummary summary={advisorSummary} comments={advisorComments} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
