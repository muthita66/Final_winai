"use client";

import React, { useState, useEffect, Fragment } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import toast from "react-hot-toast";
import { getCurrentAcademicYearBE, getRecentAcademicYearsBE, getAcademicSemesterDefault } from "@/features/student/academic-term";

interface AdvisorEvaluationFeatureProps {
    session: any;
}

export function AdvisorEvaluationFeature({ session }: AdvisorEvaluationFeatureProps) {
    const teacher_id = session.id;
    const [activeTab, setActiveTab] = useState<'advisor_to_student' | 'student_to_advisor'>('advisor_to_student');

    // Filter states
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());
    const [searchTerm, setSearchTerm] = useState("");

    // Data states
    const [students, setStudents] = useState<any[]>([]); // Advisory students for "advisor_to_student"
    const [studentFeedbackResults, setStudentFeedbackResults] = useState<any[]>([]); // Students evaluating advisor for "student_to_advisor"
    const [isLoading, setIsLoading] = useState(false);

    // Inline Evaluation state
    const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
    const [evalTemplate, setEvalTemplate] = useState<any>(null);
    const [evalForm, setEvalForm] = useState<{ scores: Record<string, number>, feedback: string }>({
        scores: {},
        feedback: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

    // Load data based on active tab
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                if (activeTab === 'advisor_to_student') {
                    // Fetch all advisory students (Homeroom)
                    const data = await TeacherApiService.getAdvisoryStudents(teacher_id, year, semester);
                    setStudents(data);
                } else {
                    // Fetch results of students evaluating the advisor
                    const data = await TeacherApiService.getAdvisorEvaluation(teacher_id, year, semester);
                    setStudentFeedbackResults(data);
                }
            } catch (err) {
                console.error("Failed to fetch advisor evaluation data", err);
                toast.error("ไม่สามารถโหลดข้อมูลได้");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeTab, teacher_id, year, semester]);

    // Handle opening inline evaluation for a student
    const handleToggleEval = async (studentId: number) => {
        if (expandedStudentId === studentId) {
            setExpandedStudentId(null);
            return;
        }

        setIsLoadingTemplate(true);
        try {
            const template = await TeacherApiService.getStudentAdvisorEvaluationTemplate(studentId, teacher_id, year, semester);
            setEvalTemplate(template);

            // Initialize scores from existing ones or default to 0
            const initialScores: Record<string, number> = {};
            template.topics.forEach((t: any) => {
                const existing = template.current.find((c: any) => c.name === t.name);
                initialScores[t.name] = existing ? existing.score : 0;
            });

            setEvalForm({
                scores: initialScores,
                feedback: template.feedback || ""
            });
            setExpandedStudentId(studentId);
        } catch (err) {
            toast.error("ไม่สามารถโหลดแบบประเมินได้");
        } finally {
            setIsLoadingTemplate(false);
        }
    };

    const handleScoreChange = (topicName: string, score: number) => {
        setEvalForm(prev => ({
            ...prev,
            scores: { ...prev.scores, [topicName]: score }
        }));
    };

    const handleSubmitEval = async () => {
        if (!expandedStudentId) return;

        // Check if all rated (at least one score)
        const hasScores = Object.values(evalForm.scores).some(s => s > 0);
        if (!hasScores) {
            toast.error("กรุณาให้คะแนนอย่างน้อย 1 หัวข้อ");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                student_id: expandedStudentId,
                teacher_id,
                year,
                semester,
                data: Object.entries(evalForm.scores).map(([name, score]) => ({ name, score })),
                feedback: evalForm.feedback
            };

            await TeacherApiService.saveStudentAdvisorEvaluation(payload);
            toast.success("บันทึกการประเมินเรียบร้อยแล้ว");
            setExpandedStudentId(null);

            // Refresh student list to update evaluation status if possible
        } catch (err) {
            toast.error("บันทึกไม่สำเร็จ");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate sum of feedback results grouped by topic for summary
    const feedbackSummary = (() => {
        const topicMap = new Map<string, { total: number; count: number }>();
        const comments: any[] = [];

        studentFeedbackResults.forEach((r) => {
            const topic = r.topic || "ไม่ระบุหัวข้อ";
            const current = topicMap.get(topic) || { total: 0, count: 0 };
            topicMap.set(topic, {
                total: current.total + Number(r.score || 0),
                count: current.count + 1
            });

            // Collect unique comments/feedback if available
            if (r.feedback && r.feedback.trim() && !comments.find(c => c.text === r.feedback)) {
                comments.push({
                    text: r.feedback,
                    submitted_at: r.created_at || new Date().toISOString()
                });
            }
        });

        const summary = Array.from(topicMap.entries()).map(([topic, val]) => ({
            topic,
            count: val.count,
            total: val.total,
            average: val.count ? (val.total / val.count).toFixed(2) : "0"
        }));

        return { summary, comments };
    })();

    // Helper: format room label from student data
    const getRoomLabel = (s: any) => `${s.class_level}/${s.classroom}`;

    // Filter students based on search term
    const filteredStudents = students.filter(s => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase().trim();
        return (
            s.first_name.toLowerCase().includes(q) ||
            s.last_name.toLowerCase().includes(q) ||
            s.student_code.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header section - orange style matching TeachingEvaluationFeature */}
            <section className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center">
                    {/* Left: Title */}
                    <div className="shrink-0 group cursor-default">
                        <h1 className="text-xl font-bold flex items-center gap-2 whitespace-nowrap group-hover:text-orange-100 transition-colors">
                            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            การประเมินที่ปรึกษา
                        </h1>
                        <p className="text-orange-100/70 text-[10px] mt-0.5 ml-8 uppercase tracking-wider">Advisor and Home Room Evaluation</p>
                    </div>

                    {/* Right: Filter Controls (Expanded) */}
                    <div className="flex-1 w-full lg:ml-8">
                        <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-3 shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr] gap-3 items-center">
                                {/* ค้นหานักเรียน - Expanded to fill more space */}
                                <div className="space-y-1">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-100/80 ml-1">ค้นหานักเรียน</span>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="ค้นหาชื่อ, นามสกุล หรือรหัสนักเรียน..."
                                            className="w-full rounded-xl bg-white/20 border border-white/30 text-white pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-white/40 placeholder:text-orange-100/40"
                                        />
                                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-100/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Semester and Year on the same row */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* ภาคเรียน */}
                                    <div className="space-y-1">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-100/80 ml-1">ภาคเรียน</span>
                                        <select
                                            value={semester}
                                            onChange={(e) => setSemester(Number(e.target.value))}
                                            className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:text-slate-800"
                                        >
                                            <option value={1}>1</option>
                                            <option value={2}>2</option>
                                        </select>
                                    </div>

                                    {/* ปีการศึกษา */}
                                    <div className="space-y-1">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-100/80 ml-1">ปีการศึกษา</span>
                                        <select
                                            value={year}
                                            onChange={(e) => setYear(Number(e.target.value))}
                                            className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:text-slate-800"
                                        >
                                            {getRecentAcademicYearsBE(5).map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Row */}
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between px-1">
                            <span className="text-sm text-orange-50 flex items-center gap-1.5 font-medium">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                                </svg>
                                {activeTab === 'advisor_to_student' ? "จำนวนนักเรียนทั้งหมด" : "จำนวนรายการผลการประเมิน"}
                            </span>
                            <span className="text-sm font-bold text-white bg-orange-600/60 px-3 py-1 rounded-full border border-white/20 shadow-sm">
                                {activeTab === 'advisor_to_student' ? (filteredStudents.length || 0) : (studentFeedbackResults.length || 0)} รายการ
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation Row - Integrated into header */}
                <div className="relative z-10 mt-6 flex justify-center">
                    <div className="flex p-1.5 bg-white/10 backdrop-blur-md rounded-2xl w-full max-w-sm border border-white/20 shadow-lg">
                        <button
                            onClick={() => setActiveTab('advisor_to_student')}
                            className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'advisor_to_student'
                                ? 'bg-white text-orange-600 shadow-md scale-105'
                                : 'text-orange-50 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            ประเมินนักเรียน
                        </button>
                        <button
                            onClick={() => setActiveTab('student_to_advisor')}
                            className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'student_to_advisor'
                                ? 'bg-white text-orange-600 shadow-md scale-105'
                                : 'text-orange-50 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            ผลการประเมิน
                        </button>
                    </div>
                </div>
            </section >

            {/* Tab Content Section */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[500px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-medium">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : activeTab === 'advisor_to_student' ? (
                    <div className="p-0">
                        {students.length === 0 ? (
                            <div className="p-20 text-center text-slate-400">
                                <p className="font-medium">ไม่พบข้อมูลนักเรียนในที่ปรึกษา</p>
                            </div>
                        ) : filteredStudents.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center w-16">#</th>
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center w-32">รหัสนักเรียน</th>
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">สถานะ</th>
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">ประเมินล่าสุด</th>
                                            <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s, idx) => (
                                            <Fragment key={s.id}>
                                                <tr className={`border-b border-slate-100 transition-colors ${expandedStudentId === s.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-5 py-4 text-sm text-slate-400 text-center">{idx + 1}</td>
                                                    <td className="px-5 py-4 font-mono text-sm text-slate-500 tracking-tight text-center">{s.student_code}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                                            {s.prefix && <span>{s.prefix}</span>}
                                                            <span>{s.first_name} {s.last_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {s.evaluated ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                ประเมินแล้ว
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                                                                รอประเมิน
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-sm text-slate-400">
                                                        {s.last_evaluated_date ? new Date(s.last_evaluated_date).toLocaleDateString('th-TH') : '-'}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <button
                                                            onClick={() => handleToggleEval(s.id)}
                                                            disabled={isLoadingTemplate}
                                                            className={`transition-all flex items-center justify-center ml-auto ${expandedStudentId === s.id
                                                                ? 'p-1 rounded-full text-slate-400 hover:bg-slate-200 focus:outline-none'
                                                                : 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 gap-2 shadow-sm'
                                                                }`}
                                                            title={expandedStudentId === s.id ? "ปิด" : ""}
                                                        >
                                                            {isLoadingTemplate && expandedStudentId === s.id ? (
                                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                                                            ) : expandedStudentId === s.id ? (
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            ) : (
                                                                <>

                                                                    {s.evaluated ? 'แก้ไข' : 'ประเมิน'}
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* Inline Evaluation Form Row */}
                                                {expandedStudentId === s.id && evalTemplate && (
                                                    <tr>
                                                        <td colSpan={6} className="p-0 border-none">
                                                            <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-8 animate-in slide-in-from-top duration-300">
                                                                {/* Form header */}
                                                                <div className="mb-6">
                                                                    <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                                                        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                        </svg>
                                                                        รายการประเมิน — {s.first_name} {s.last_name}
                                                                    </h3>
                                                                    <p className="text-sm font-medium text-indigo-500 mt-1">เกณฑ์การประเมิน — 5: ดีมาก, 4: ดี, 3: ปานกลาง, 2: พอใช้, 1: ปรับปรุง</p>
                                                                </div>

                                                                <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
                                                                    {/* Score header row */}
                                                                    <div className="grid border-b border-slate-100 bg-slate-50" style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}>
                                                                        <div className="px-5 py-3 text-sm font-bold text-slate-500 uppercase tracking-wider">หัวข้อประเมิน</div>
                                                                        {[5, 4, 3, 2, 1].map(v => (
                                                                            <div key={v} className="py-3 text-center">
                                                                                <div className="text-base font-bold text-slate-700">{v}</div>
                                                                                <div className="text-xs font-semibold text-slate-400">{v === 5 ? 'ดีมาก' : v === 4 ? 'ดี' : v === 3 ? 'ปานกลาง' : v === 2 ? 'พอใช้' : 'ปรับปรุง'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Topic rows */}
                                                                    {evalTemplate.topics.map((t: any, tidx: number) => (
                                                                        <div key={tidx} className={`grid border-b border-slate-50 items-center ${tidx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`} style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}>
                                                                            <div className="px-5 py-4 text-base text-slate-700 font-medium">
                                                                                <span className="text-slate-400 mr-2">{tidx + 1}.</span>{t.name}
                                                                            </div>
                                                                            {[5, 4, 3, 2, 1].map(v => (
                                                                                <div key={v} className="flex justify-center py-3">
                                                                                    <div
                                                                                        onClick={() => handleScoreChange(t.name, v)}
                                                                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${evalForm.scores[t.name] === v
                                                                                            ? 'border-indigo-600 bg-white'
                                                                                            : 'border-slate-200 bg-white hover:border-indigo-300'
                                                                                            }`}
                                                                                    >
                                                                                        {evalForm.scores[t.name] === v && (
                                                                                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-in zoom-in duration-200"></div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Feedback & Submit */}
                                                                <div className="mt-6 space-y-4">
                                                                    <label className="block text-sm font-bold text-slate-700 ml-1">ข้อเสนอแนะ / หมายเหตุ (ถ้ามี)</label>
                                                                    <textarea
                                                                        value={evalForm.feedback}
                                                                        onChange={(e) => setEvalForm(prev => ({ ...prev, feedback: e.target.value }))}
                                                                        placeholder="ข้อเสนอแนะเพิ่มเติม..."
                                                                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all min-h-[100px] resize-none shadow-sm"
                                                                    />
                                                                    <div className="flex justify-end gap-3 pt-2">
                                                                        <button
                                                                            onClick={() => setExpandedStudentId(null)}
                                                                            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all shadow-sm"
                                                                        >
                                                                            ยกเลิก
                                                                        </button>
                                                                        <button
                                                                            onClick={handleSubmitEval}
                                                                            disabled={isSubmitting}
                                                                            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 group"
                                                                        >
                                                                            {isSubmitting ? (
                                                                                <>
                                                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                                    <span>กำลังบันทึก...</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                    <span>บันทึกการประเมิน</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-24 text-center bg-slate-50/50">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-300 mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-slate-600 font-bold text-lg">ไม่พบข้อมูลตามเงื่อนไข</h3>
                                <p className="text-slate-400 text-sm mt-1">ลองเปลี่ยนคำค้นหาดูนะ</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Student Feedback Results Summary View - Refactored to match TeachingEvaluationFeature */
                    <div className="p-8 space-y-10 animate-in fade-in duration-500">
                        {/* Summary Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                    คะแนนเฉลี่ยแยกตามหัวข้อ
                                </h2>
                                <div className="space-y-4">
                                    {feedbackSummary.summary.length > 0 ? (
                                        feedbackSummary.summary.map((item, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between text-sm font-semibold text-slate-600">
                                                    <span>{item.topic}</span>
                                                    <span className="text-indigo-600">{item.average} / 5</span>
                                                </div>
                                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-700"
                                                        style={{ width: `${(Number(item.average) / 5) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 italic font-medium">
                                            ยังไม่มีข้อมูลการประเมิน
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 flex flex-col items-center justify-center text-center">
                                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">คะแนนรวมเฉลี่ย</div>
                                <div className="text-6xl font-black text-indigo-700 mb-3 tracking-tighter">
                                    {feedbackSummary.summary.length > 0
                                        ? (feedbackSummary.summary.reduce((a, b) => a + Number(b.average), 0) / feedbackSummary.summary.length).toFixed(2)
                                        : '0.00'}
                                </div>
                                <div className="flex gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <svg key={star} className="w-6 h-6 text-amber-400 fill-current" viewBox="0 0 24 24">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    ))}
                                </div>
                                <p className="text-slate-500 text-sm font-medium">คะแนนเฉลี่ยจากการประเมินทั้งหมด</p>
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-fuchsia-600 rounded-full"></div>
                                ข้อเสนอแนะ / หมายเหตุ
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {feedbackSummary.comments.length > 0 ? (
                                    feedbackSummary.comments.map((c, idx) => (
                                        <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                            <p className="text-slate-700 text-sm font-medium leading-relaxed">&ldquo;{c.text}&rdquo;</p>
                                            <div className="mt-3 text-xs text-slate-400 flex items-center gap-2 font-bold">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                เมื่อ {new Date(c.submitted_at).toLocaleDateString('th-TH')}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-16 text-center text-slate-400 font-medium italic">
                                        ยังไม่มีข้อเสนอแนะ
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h4 className="font-bold text-indigo-900">เกี่ยวกับผลการประเมิน</h4>
                            </div>
                            <p className="text-indigo-700/70 text-sm font-medium leading-relaxed">
                                ผลสรุปนี้คำนวณจากคะแนนที่นักเรียนในที่ปรึกษาประเมินการปฏิบัติหน้าที่ครูที่ปรึกษาของคุณในภาคเรียนนี้ ข้อมูลทั้งหมดจะถูกเก็บเป็นความลับเพื่อใช้ในการวิเคราะห์และพัฒนาระบบการดูแลช่วยเหลือนักเรียน
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
