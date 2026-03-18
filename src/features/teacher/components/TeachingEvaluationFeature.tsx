"use client";

import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import toast from "react-hot-toast";
import { getCurrentAcademicYearBE, getRecentAcademicYearsBE, getAcademicSemesterDefault } from "@/features/student/academic-term";

interface TeachingEvaluationFeatureProps {
    session: any;
}

export function TeachingEvaluationFeature({ session }: TeachingEvaluationFeatureProps) {
    const teacher_id = session.id;
    const [activeTab, setActiveTab] = useState<'teacher_to_student' | 'student_to_teacher'>('teacher_to_student');

    // Filter states
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());
    const [searchTerm, setSearchTerm] = useState("");
    const [assignments, setAssignments] = useState<any[]>([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

    // Data states
    const [students, setStudents] = useState<any[]>([]);
    const [evaluationResults, setEvaluationResults] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetStudent, setTargetStudent] = useState<any | null>(null);
    const [evalTemplate, setEvalTemplate] = useState<any>(null);
    const [evalForm, setEvalForm] = useState<{ scores: Record<string, number>, feedback: string }>({
        scores: {},
        feedback: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial load: Fetch assignments
    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const data = await TeacherApiService.getTeachingEvaluation(teacher_id, year, semester);
                setAssignments(data);

                // If currently selected ID is not in new data, reset it
                if (selectedAssignmentId) {
                    const isValid = data.some(a => a.teaching_assignment_id === selectedAssignmentId);
                    if (!isValid) setSelectedAssignmentId(null);
                }
            } catch (err) {
                console.error("Failed to fetch assignments", err);
                setAssignments([]);
                setSelectedAssignmentId(null);
            }
        };
        fetchAssignments();
    }, [teacher_id, year, semester]);

    // Fetch data based on active tab and selected assignment
    useEffect(() => {
        if (!selectedAssignmentId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                if (activeTab === 'teacher_to_student') {
                    const data = await TeacherApiService.getSectionStudentsForEvaluation(teacher_id, selectedAssignmentId, year, semester);
                    setStudents(data);
                } else {
                    const data = await TeacherApiService.getTeachingEvaluationDetailed(teacher_id, selectedAssignmentId, year, semester);
                    setEvaluationResults(data);
                }
            } catch (err) {
                console.error("Failed to fetch evaluation data", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeTab, selectedAssignmentId, year, semester, teacher_id]);

    const handleOpenEvalModal = async (student: any) => {
        setTargetStudent(student);
        try {
            const template = await TeacherApiService.getSubjectEvaluationTemplate(teacher_id, student.id, selectedAssignmentId!, year, semester);
            setEvalTemplate(template);

            // Initialize scores
            const initialScores: Record<string, number> = {};
            template.topics.forEach((t: any) => {
                const existing = template.current.find((c: any) => c.name === t.name);
                initialScores[t.name] = existing ? existing.score : 0;
            });
            setEvalForm({
                scores: initialScores,
                feedback: template.feedback || ""
            });
            setIsModalOpen(true);
        } catch (err) {
            toast.error("ไม่สามารถโหลดแบบประเมินได้");
        }
    };

    const handleScoreChange = (topic: string, score: number) => {
        setEvalForm(prev => ({
            ...prev,
            scores: { ...prev.scores, [topic]: score }
        }));
    };

    const handleSubmitEvaluation = async () => {
        if (Object.values(evalForm.scores).some(s => s === 0)) {
            toast.error("กรุณาให้คะแนนครบทุกหัวข้อ");
            return;
        }

        setIsSubmitting(true);
        try {
            await TeacherApiService.submitSubjectEvaluation({
                teacher_id,
                student_id: targetStudent.id,
                section_id: selectedAssignmentId!,
                year,
                semester,
                data: Object.entries(evalForm.scores).map(([name, score]) => ({ name, score })),
                feedback: evalForm.feedback
            });
            toast.success("บันทึกการประเมินสำเร็จ");
            setIsModalOpen(false);
            // Refresh student list
            const data = await TeacherApiService.getSectionStudentsForEvaluation(teacher_id, selectedAssignmentId!, year, semester);
            setStudents(data);
        } catch (err) {
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedAssignment = assignments.find(a => a.teaching_assignment_id === selectedAssignmentId);

    // Filter students based on search
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
            {/* Header section - orange style matching ScoreInputFeature */}
            <section className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center">
                    {/* Left: Title */}
                    <div className="shrink-0 group cursor-default">
                        <h1 className="text-xl font-bold flex items-center gap-2 whitespace-nowrap group-hover:text-orange-100 transition-colors">
                            <svg className="w-7 h-7 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            การประเมินรายวิชา
                        </h1>
                        <p className="text-orange-100/70 text-xs mt-1 ml-9 uppercase tracking-wider">Course and Student Evaluation</p>
                    </div>

                    {/* Right: Dropdowns - Expanded to fill space */}
                    <div className="flex-1 w-full lg:ml-8">
                        <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-3 shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-3 items-start">
                                {/* ส่วนเลือกรายวิชา - dropdown */}
                                <div className="space-y-1">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-orange-100/80 ml-1">รายวิชาที่ประเมิน</span>
                                    <select
                                        value={selectedAssignmentId ?? ""}
                                        onChange={(e) => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:text-slate-800"
                                    >
                                        <option value="">เลือกรายวิชา...</option>
                                        {assignments.map((a) => (
                                            <option key={a.teaching_assignment_id} value={a.teaching_assignment_id}>
                                                {a.subject_code} - {a.subject_name}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    {/* บรรทัดล่างเล็กๆ: ระดับชั้น และ ห้อง (รวมกันในกล่องเดียว) */}
                                    {selectedAssignmentId && (
                                        <div className="flex items-center gap-3 mt-1.5 ml-1 text-xs font-bold text-white/90">
                                            <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-lg border border-white/20 shadow-sm">
                                                <svg className="w-3.5 h-3.5 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <span>ชั้น{selectedAssignment?.class_level || ""}/{(selectedAssignment?.room || "").split('/').pop() || ""}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ภาคเรียน */}
                                <div className="space-y-1">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-orange-100/80 ml-1">ภาคเรียน</span>
                                    <select
                                        value={semester}
                                        onChange={(e) => setSemester(Number(e.target.value))}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:text-slate-800"
                                    >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                    </select>
                                </div>

                                {/* ปีการศึกษา */}
                                <div className="space-y-1">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-orange-100/80 ml-1">ปีการศึกษา</span>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:text-slate-800"
                                    >
                                        {getRecentAcademicYearsBE(5).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation Row - Integrated into header */}
                <div className="relative z-10 mt-6 flex justify-center">
                    <div className="flex p-1.5 bg-white/10 backdrop-blur-md rounded-2xl w-full max-w-sm border border-white/20 shadow-lg">
                        <button
                            onClick={() => setActiveTab('teacher_to_student')}
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'teacher_to_student'
                                ? 'bg-white text-orange-600 shadow-md scale-105'
                                : 'text-orange-50 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            ประเมินนักเรียน
                        </button>
                        <button
                            onClick={() => setActiveTab('student_to_teacher')}
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'student_to_teacher'
                                ? 'bg-white text-orange-600 shadow-md scale-105'
                                : 'text-orange-50 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            ผลการประเมิน
                        </button>
                    </div>
                </div>
            </section>


            {/* Tab Content */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-medium">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : !selectedAssignmentId ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="font-medium">เลือกรายวิชาที่ต้องการประเมินจากแถบด้านบน</p>
                    </div>
                ) : activeTab === 'teacher_to_student' ? (
                    <div>
                        {/* Student Table Header */}
                        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">รายชื่อนักเรียน</h2>
                                <p className="text-base text-slate-500">กดปุ่ม &quot;ประเมิน&quot; เพื่อเปิดรายการประเมินสำหรับนักเรียนแต่ละคน</p>
                            </div>
                            <div className="relative">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="ค้นหาชื่อหรือรหัส..."
                                    className="w-48 rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-base outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="divide-x divide-slate-100">
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider w-8">#</th>
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">รหัสนักเรียน</th>
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-center">สถานะ</th>
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-center">ประเมินล่าสุด</th>
                                    <th className="px-5 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map((s, idx) => (
                                        <>
                                            <tr key={s.id} className={`border-b border-slate-100 transition-colors ${targetStudent?.id === s.id && isModalOpen ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                                <td className="px-5 py-4 text-base text-slate-400">{idx + 1}</td>
                                                <td className="px-5 py-4 font-mono text-base text-slate-500">{s.student_code}</td>
                                                <td className="px-5 py-4 font-semibold text-lg text-slate-700">{s.name}</td>
                                                <td className="px-5 py-4 text-center">
                                                    {s.evaluated ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                            ประเมินแล้ว
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                                                            รอประเมิน
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-base text-slate-400 text-center">
                                                    {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('th-TH') : '-'}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {targetStudent?.id === s.id && isModalOpen ? (
                                                        <button
                                                            onClick={() => { setIsModalOpen(false); setTargetStudent(null); }}
                                                            className="p-1 rounded-full text-slate-400 hover:bg-slate-200 transition-colors"
                                                            title="ปิด"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleOpenEvalModal(s)}
                                                            className={`px-4 py-2 rounded-lg text-base font-semibold transition-all ${s.evaluated
                                                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                                }`}
                                                        >
                                                            {s.evaluated ? 'แก้ไข' : 'ประเมิน'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Inline evaluation form - expands below the selected student row */}
                                            {targetStudent?.id === s.id && isModalOpen && (
                                                <tr key={`eval-${s.id}`}>
                                                    <td colSpan={6} className="p-0">
                                                        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-6">
                                                            {/* Form header */}
                                                            <div className="mb-4">
                                                                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                                                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                    </svg>
                                                                    รายการประเมิน — {s.name}
                                                                </h3>
                                                                <p className="text-base font-medium text-indigo-500 mt-1">เกณฑ์การประเมิน — 5: ดีมาก, 4: ดี, 3: ปานกลาง, 2: พอใช้, 1: ปรับปรุง</p>
                                                            </div>

                                                            {evalTemplate ? (
                                                                <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
                                                                    {/* Score header row */}
                                                                    <div className="grid border-b border-slate-100 bg-slate-50" style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}>
                                                                        <div className="px-5 py-3 text-base font-bold text-slate-500 uppercase tracking-wider">หัวข้อประเมิน</div>
                                                                        {[5, 4, 3, 2, 1].map(v => (
                                                                            <div key={v} className="py-3 text-center">
                                                                                <div className="text-xl font-bold text-slate-700">{v}</div>
                                                                                <div className="text-xs font-semibold text-slate-400">{v === 5 ? 'ดีมาก' : v === 4 ? 'ดี' : v === 3 ? 'ปานกลาง' : v === 2 ? 'พอใช้' : 'ปรับปรุง'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Topic rows */}
                                                                    {evalTemplate.topics.map((t: any, topicIdx: number) => (
                                                                        <div key={topicIdx} className={`grid border-b border-slate-50 items-center ${topicIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`} style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}>
                                                                            <div className="px-5 py-4 text-lg text-slate-700 font-medium">
                                                                                <span className="text-slate-400 mr-2">{topicIdx + 1}.</span>{t.name}
                                                                            </div>
                                                                            {[5, 4, 3, 2, 1].map(val => (
                                                                                <div key={val} className="flex justify-center py-3">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`score-${s.id}-${t.name}`}
                                                                                        value={val}
                                                                                        checked={evalForm.scores[t.name] === val}
                                                                                        onChange={() => handleScoreChange(t.name, val)}
                                                                                        className="w-4 h-4 text-indigo-600 border-slate-300 cursor-pointer"
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center p-8 text-slate-400">
                                                                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                                    กำลังโหลดแบบประเมิน...
                                                                </div>
                                                            )}

                                                            {/* Feedback & Submit */}
                                                            {evalTemplate && (
                                                                <div className="mt-4 space-y-3">
                                                                    <label className="block text-base font-semibold text-slate-700">ข้อเสนอแนะ / หมายเหตุ (ถ้ามี)</label>
                                                                    <textarea
                                                                        value={evalForm.feedback}
                                                                        onChange={(e) => setEvalForm(p => ({ ...p, feedback: e.target.value }))}
                                                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-400 outline-none text-base resize-none"
                                                                        rows={3}
                                                                        placeholder="ข้อเสนอแนะเพิ่มเติม..."
                                                                    />
                                                                    <div className="flex justify-end gap-2 pt-1">
                                                                        <button
                                                                            onClick={() => { setIsModalOpen(false); setTargetStudent(null); }}
                                                                            className="px-4 py-2 text-sm text-slate-600 font-semibold hover:text-slate-800 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
                                                                        >
                                                                            ยกเลิก
                                                                        </button>
                                                                        <button
                                                                            onClick={handleSubmitEvaluation}
                                                                            disabled={isSubmitting}
                                                                            className="px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-60"
                                                                        >
                                                                            {isSubmitting ? (
                                                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                            ) : (
                                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M5 13l4 4L19 7" /></svg>
                                                                            )}
                                                                            บันทึกการประเมิน
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center text-slate-400 font-medium italic">
                                            ไม่พบรายชื่อในเงื่อนไขการค้นหา
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 space-y-10">
                        {/* Summary Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                    คะแนนเฉลี่ยแยกตามหัวข้อ
                                </h2>
                                <div className="space-y-4">
                                    {evaluationResults?.summary?.length > 0 ? evaluationResults.summary.map((item: any, idx: number) => (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex justify-between text-base font-semibold text-slate-600">
                                                <span>{item.topic}</span>
                                                <span className="text-indigo-600">{item.average} / 5</span>
                                            </div>
                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-700"
                                                    style={{ width: `${(item.average / 5) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 italic">
                                            ยังไม่มีข้อมูลการประเมิน
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 flex flex-col items-center justify-center text-center">
                                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">คะแนนรวมเฉลี่ย</div>
                                <div className="text-6xl font-black text-indigo-700 mb-3 tracking-tighter">
                                    {evaluationResults?.summary?.length > 0
                                        ? (evaluationResults.summary.reduce((a: any, b: any) => a + b.average, 0) / evaluationResults.summary.length).toFixed(2)
                                        : '0.00'}
                                </div>
                                <div className="flex gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <svg key={star} className="w-6 h-6 text-amber-400 fill-current" viewBox="0 0 24 24">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    ))}
                                </div>
                                <p className="text-slate-500 text-base">คะแนนเฉลี่ยจากการประเมินทั้งหมด</p>
                            </div>
                        </div>

                        {/* Comments */}
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-fuchsia-600 rounded-full"></div>
                                ข้อเสนอแนะ / หมายเหตุ
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {evaluationResults?.comments?.length > 0 ? evaluationResults.comments.map((c: any, idx: number) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <p className="text-slate-700 text-base leading-relaxed">&ldquo;{c.text}&rdquo;</p>
                                        <div className="mt-3 text-sm text-slate-400">เมื่อ {new Date(c.submitted_at).toLocaleDateString('th-TH')}</div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-10 text-center text-slate-400 italic">ยังไม่มีข้อเสนอแนะ</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
