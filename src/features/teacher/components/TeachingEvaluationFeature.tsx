"use client";

import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import toast from "react-hot-toast";
import { getCurrentAcademicYearBE, getRecentAcademicYearsBE, getAcademicSemesterDefault } from "@/features/student/academic-term";

interface TeachingEvaluationFeatureProps {
    session: any;
}

type EvaluationMode = 'subject' | 'advisor' | 'sdq';
type AdvisorSubMode = 'attributes' | 'reading_thinking';

export function TeachingEvaluationFeature({ session }: TeachingEvaluationFeatureProps) {
    const teacher_id = session.id;
    const [evalMode, setEvalMode] = useState<EvaluationMode>('subject');
    const [advisorSubMode, setAdvisorSubMode] = useState<AdvisorSubMode>('attributes');
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
    const [advisoryStudents, setAdvisoryStudents] = useState<any[]>([]);
    const [advisoryLoading, setAdvisoryLoading] = useState(false);
    const [advisorySearch, setAdvisorySearch] = useState("");

    // Inline advisor attributes evaluation
    const [expandedAdvisorStudentId, setExpandedAdvisorStudentId] = useState<number | null>(null);
    const [advisorEvalTemplate, setAdvisorEvalTemplate] = useState<any>(null);
    const [advisorEvalForm, setAdvisorEvalForm] = useState<{ scores: Record<string, number>; feedback: string }>({ scores: {}, feedback: "" });
    const [advisorEvalSubmitting, setAdvisorEvalSubmitting] = useState(false);
    const [advisorEvalLoadingTemplate, setAdvisorEvalLoadingTemplate] = useState(false);

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

    // Fetch advisory students when in advisor mode
    useEffect(() => {
        if (evalMode !== 'advisor') return;
        const fetchAdvisoryStudents = async () => {
            setAdvisoryLoading(true);
            try {
                const data = await TeacherApiService.getAdvisoryStudents(teacher_id, year, semester);
                setAdvisoryStudents(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch advisory students", err);
                setAdvisoryStudents([]);
            } finally {
                setAdvisoryLoading(false);
            }
        };
        fetchAdvisoryStudents();
    }, [evalMode, teacher_id, year, semester]);

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

    // --- Advisor Attributes Inline Evaluation ---
    const handleToggleAdvisorEval = async (studentId: number) => {
        if (expandedAdvisorStudentId === studentId) {
            setExpandedAdvisorStudentId(null);
            setAdvisorEvalTemplate(null);
            return;
        }
        setAdvisorEvalLoadingTemplate(true);
        try {
            const template = await TeacherApiService.getStudentAdvisorEvaluationTemplate(studentId, teacher_id, year, semester, advisorSubMode);
            setAdvisorEvalTemplate(template);
            const initialScores: Record<string, number> = {};
            (template.topics || []).forEach((t: any) => {
                const existing = (template.current || []).find((c: any) => c.name === t.name);
                initialScores[t.name] = existing ? existing.score : 0;
            });
            setAdvisorEvalForm({ scores: initialScores, feedback: template.feedback || "" });
            setExpandedAdvisorStudentId(studentId);
        } catch (err) {
            toast.error("ไม่สามารถโหลดแบบประเมินได้");
        } finally {
            setAdvisorEvalLoadingTemplate(false);
        }
    };

    const handleSubmitAdvisorEval = async () => {
        if (!expandedAdvisorStudentId || !advisorEvalTemplate?.sections) return;
        
        let allFilled = true;
        for (const section of advisorEvalTemplate.sections) {
            for (const topic of section.topics || []) {
                if (!advisorEvalForm.scores[topic.name] || advisorEvalForm.scores[topic.name] === 0) {
                    allFilled = false;
                    break;
                }
            }
        }
        
        if (!allFilled) { 
            toast.error("กรุณาประเมินให้ครบทุกหัวข้อก่อนบันทึก"); 
            return; 
        }
        
        setAdvisorEvalSubmitting(true);
        try {
            await TeacherApiService.saveStudentAdvisorEvaluation({
                student_id: expandedAdvisorStudentId,
                teacher_id,
                year,
                semester,
                data: Object.entries(advisorEvalForm.scores).map(([name, score]) => ({ name, score })),
                feedback: advisorEvalForm.feedback,
                sub_mode: advisorSubMode,
            });
            toast.success("บันทึกการประเมินเรียบร้อยแล้ว");
            setExpandedAdvisorStudentId(null);
            setAdvisorEvalTemplate(null);
            // refresh list to update evaluated flag
            const data = await TeacherApiService.getAdvisoryStudents(teacher_id, year, semester);
            setAdvisoryStudents(Array.isArray(data) ? data : []);
        } catch {
            toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
        } finally {
            setAdvisorEvalSubmitting(false);
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

    // Filter advisory students based on search
    const filteredAdvisoryStudents = advisoryStudents.filter(s => {
        if (!advisorySearch.trim()) return true;
        const q = advisorySearch.toLowerCase().trim();
        return (
            String(s.first_name || "").toLowerCase().includes(q) ||
            String(s.last_name || "").toLowerCase().includes(q) ||
            String(s.student_code || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header section - orange style matching student page but orange */}
            <section className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-white shadow-xl relative overflow-hidden mb-6">
                <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
                            Evaluation
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">แบบประเมินและรายงานผล</h1>
                        <p className="text-orange-100 font-medium">จัดการการประเมินนักเรียนและดูรายงานผลการประเมินในบทบาทครู</p>
                    </div>
                </div>
            </section>

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* 1. ประเมินรายวิชา */}
                <button
                    onClick={() => setEvalMode('subject')}
                    className={`group relative overflow-hidden rounded-3xl p-4 transition-all duration-300 border-2 text-left ${evalMode === 'subject'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200 scale-[1.02]'
                        : 'bg-white border-slate-100 hover:border-amber-200 text-slate-600 hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${evalMode === 'subject' ? 'bg-white/20' : 'bg-amber-50'
                            }`}>
                            <svg className={`w-5 h-5 ${evalMode === 'subject' ? 'text-white' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-lg leading-tight">ประเมินรายวิชา</h3>
                    </div>
                    <p className={`text-sm mt-2 ${evalMode === 'subject' ? 'text-white/80' : 'text-slate-400'}`}>ประเมินนักเรียนและพฤติกรรมในวิชาที่สอน</p>
                </button>

                {/* 2. ประเมินนักเรียนในที่ปรึกษา (Combining Attributes and Reading/Thinking) */}
                <button
                    onClick={() => setEvalMode('advisor')}
                    className={`group relative overflow-hidden rounded-3xl p-4 transition-all duration-300 border-2 text-left ${evalMode === 'advisor'
                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200 scale-[1.02]'
                        : 'bg-white border-slate-100 hover:border-orange-200 text-slate-600 hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${evalMode === 'advisor' ? 'bg-white/20' : 'bg-orange-50'
                            }`}>
                            <svg className={`w-5 h-5 ${evalMode === 'advisor' ? 'text-white' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-lg leading-tight">ประเมินนักเรียนในที่ปรึกษา</h3>
                    </div>
                    <p className={`text-sm mt-2 ${evalMode === 'advisor' ? 'text-white/80' : 'text-slate-400'}`}>คุณลักษณะอันพึงประสงค์, การอ่าน คิดวิเคราะห์ และเขียน</p>
                </button>

            </div>

            {/* Content Area Filters for Subject Evaluation (Only show for 'subject' mode) */}
            {evalMode === 'subject' && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest mb-1.5 ml-0.5">เลือกรายวิชา</label>
                            <select
                                value={selectedAssignmentId ?? ""}
                                onChange={(e) => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                            >
                                <option value="">กรุณาเลือกวิชา</option>
                                {assignments.map((a) => (
                                    <option key={a.teaching_assignment_id} value={a.teaching_assignment_id}>
                                        {a.subject_code} - {a.subject_name} ({a.class_level}/{a.room?.split('/').pop()})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest mb-1.5 ml-1">ปีการศึกษา</label>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                                >
                                    {getRecentAcademicYearsBE(5).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest mb-1.5 ml-1">ภาคเรียน</label>
                                <select
                                    value={semester}
                                    onChange={(e) => setSemester(Number(e.target.value))}
                                    className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Tab Content */}
            <div className={`bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[400px] ${evalMode !== 'subject' ? 'p-8' : ''}`}>
                {evalMode === 'subject' ? (
                    isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="font-medium">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : !selectedAssignmentId ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="font-medium text-lg">กรุณาเลือกรายวิชาที่ต้องการประเมินจากแถบด้านบน</p>
                        </div>
                    ) : activeTab === 'teacher_to_student' ? (
                        <div>
                            {/* Student Table Header */}
                            <div className="border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">รายชื่อนักเรียน</h2>
                                    <p className="text-sm text-slate-500">กดปุ่ม "ประเมิน" เพื่อบันทึกผลการเรียนรายบุคคล</p>
                                </div>
                                <div className="relative w-full sm:w-auto">
                                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="ค้นหาโฮสต์..."
                                        className="w-full sm:w-64 rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-16">เลขที่</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">รหัสประจำตัว</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">สถานะ</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">ดำเนินการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map((s, idx) => (
                                                <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 text-sm text-slate-400 font-medium">{idx + 1}</td>
                                                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{s.student_code}</td>
                                                    <td className="px-6 py-4 text-base font-bold text-slate-700">{s.name}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {s.evaluated ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 italic">
                                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                                ประเมินแล้ว
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-100 italic">
                                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                                                รอประเมิน
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleOpenEvalModal(s)}
                                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${s.evaluated
                                                                ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                                                                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-md shadow-amber-200'
                                                                }`}
                                                        >
                                                            {s.evaluated ? 'ประเมินแล้ว' : 'ลงบันทึกผล'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <p className="text-slate-400 font-medium italic">ไม่พบข้อมูลนักเรียน</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 space-y-10">
                            {/* Summary Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                                        คะแนนเฉลี่ยแยกตามหัวข้อ
                                    </h2>
                                    <div className="space-y-4">
                                        {evaluationResults?.summary?.length > 0 ? evaluationResults.summary.map((item: any, idx: number) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between text-base font-semibold text-slate-600">
                                                    <span>{item.topic}</span>
                                                    <span className="text-amber-600">{item.average} / 5</span>
                                                </div>
                                                <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
                                                        style={{ width: `${(item.average / 5) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 italic">
                                                ยังไม่มีข้อมูลการประเมิน
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex flex-col items-center justify-center text-center shadow-inner">
                                    <div className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3">คะแนนรวมเฉลี่ย</div>
                                    <div className="text-7xl font-black text-amber-700 mb-4 tracking-tighter">
                                        {evaluationResults?.summary?.length > 0
                                            ? (evaluationResults.summary.reduce((a: any, b: any) => a + b.average, 0) / evaluationResults.summary.length).toFixed(2)
                                            : '0.00'}
                                    </div>
                                    <div className="flex gap-1.5 mb-5">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <svg key={star} className="w-7 h-7 text-amber-400 fill-current drop-shadow-sm" viewBox="0 0 24 24">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                            </svg>
                                        ))}
                                    </div>
                                    <p className="text-slate-500 font-medium">คะแนนเฉลี่ยจากการประเมินของนักเรียนทุกคน</p>
                                </div>
                            </div>

                            {/* Comments */}
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                    ข้อเสนอแนะเพิ่มเติม
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {evaluationResults?.comments?.length > 0 ? evaluationResults.comments.map((c: any, idx: number) => (
                                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                            <p className="text-slate-700 text-base leading-relaxed italic font-medium">&ldquo;{c.text}&rdquo;</p>
                                            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                                เมื่อ {new Date(c.submitted_at).toLocaleDateString('th-TH')}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-10 text-center text-slate-400 italic font-medium">
                                            ยังไม่มีข้อเสนอแนะในขณะนี้
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    /* Combined Advisor Evaluation Context */
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">
                                    ประเมินนักเรียนในที่ปรึกษา
                                </h2>
                                <p className="text-slate-500 font-medium mt-1">จัดการประเมินคุณลักษณะและทักษะการอ่านคิดวิเคราะห์</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="min-w-[140px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 ml-1">ปีการศึกษา</label>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="w-full bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 text-amber-700 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 appearance-none cursor-pointer"
                                    >
                                        {getRecentAcademicYearsBE(5).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="min-w-[120px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 ml-1">ภาคเรียน</label>
                                    <select
                                        value={semester}
                                        onChange={(e) => setSemester(Number(e.target.value))}
                                        className="w-full bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 text-orange-700 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-400 appearance-none cursor-pointer"
                                    >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Sub-mode selection tabs within Advisor mode */}
                        <div className="flex p-1 bg-slate-100 rounded-2xl w-full max-w-xl border border-slate-200/50">
                            <button
                                onClick={() => setAdvisorSubMode('attributes')}
                                className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${advisorSubMode === 'attributes'
                                    ? 'bg-white text-orange-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                คุณลักษณะอันพึงประสงค์
                            </button>
                            <button
                                onClick={() => setAdvisorSubMode('reading_thinking')}
                                className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${advisorSubMode === 'reading_thinking'
                                    ? 'bg-white text-red-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                การอ่าน คิดวิเคราะห์ และเขียน
                            </button>
                        </div>

                        {/* Search and Filter for Advisor Modes */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={advisorySearch}
                                    onChange={(e) => setAdvisorySearch(e.target.value)}
                                    placeholder="ค้นหานักเรียนในที่ปรึกษา..."
                                    className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all font-medium"
                                />
                            </div>
                            <button className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-colors shrink-0">
                                พิมพ์รายงานรวม
                            </button>
                        </div>

                        {/* Real Student Table for Advisor Modes */}
                        {advisoryLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-medium">กำลังโหลดข้อมูลนักเรียน...</p>
                            </div>
                        ) : advisoryStudents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="font-medium text-lg">ไม่พบนักเรียนในที่ปรึกษา</p>
                                <p className="text-sm mt-1">ลองเปลี่ยนปีการศึกษาหรือภาคเรียนดูนะ</p>
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest w-16">เลขที่</th>
                                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">รหัสประจำตัว</th>
                                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">สถานะประเมิน</th>
                                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">การจัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredAdvisoryStudents.length > 0 ? (
                                            filteredAdvisoryStudents.map((s, idx) => (
                                                <tr key={s.id} className="hover:bg-white transition-colors group">
                                                    <td className="px-6 py-5 text-sm text-slate-400 font-bold">{idx + 1}</td>
                                                    <td className="px-6 py-5 text-sm font-black text-slate-600 group-hover:text-amber-600 transition-colors uppercase">{s.student_code}</td>
                                                    <td className="px-6 py-5 font-black text-lg text-slate-700">
                                                        {s.prefix && <span className="mr-1">{s.prefix}</span>}
                                                        {s.first_name} {s.last_name}
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        {s.evaluated ? (
                                                            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black uppercase tracking-wider">
                                                                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                                Completed
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 text-slate-400 rounded-full text-xs font-black uppercase tracking-wider">
                                                                <div className="w-2 h-2 bg-slate-300 rounded-full" />
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button
                                                            onClick={() => handleToggleAdvisorEval(s.id)}
                                                            disabled={advisorEvalLoadingTemplate}
                                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 shadow-sm shadow-orange-200 active:scale-95 transition-all disabled:opacity-60"
                                                        >
                                                            {advisorEvalLoadingTemplate ? (
                                                                <div className="w-4 h-4 border-2 border-orange-200 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <>{s.evaluated ? 'แก้ไข' : 'ประเมิน'}</>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))

                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <p className="text-slate-400 font-medium italic">ไม่พบนักเรียนตามเงื่อนไขการค้นหา</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* === Modal Popup: Advisor Attributes Evaluation === */}
            {expandedAdvisorStudentId !== null && advisorEvalTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => { setExpandedAdvisorStudentId(null); setAdvisorEvalTemplate(null); }}
                    />
                    {/* Modal box */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal header */}
                        <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-slate-100 shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${advisorSubMode === 'attributes' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                        {advisorSubMode === 'attributes' ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800">
                                            {advisorSubMode === 'attributes' ? 'คุณลักษณะอันพึงประสงค์' : 'การอ่าน คิดวิเคราะห์ และเขียน'}
                                        </h2>
                                        <p className={`text-sm font-semibold mt-0.5 ${advisorSubMode === 'attributes' ? 'text-orange-500' : 'text-red-500'}`}>
                                            {(() => {
                                                const st = advisoryStudents.find(s => s.id === expandedAdvisorStudentId);
                                                return st ? `${st.prefix || ''}${st.first_name} ${st.last_name}` : '';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 font-medium">เกณฑ์: 5 = ดีมาก &nbsp;·&nbsp; 4 = ดี &nbsp;·&nbsp; 3 = ปานกลาง &nbsp;·&nbsp; 2 = พอใช้ &nbsp;·&nbsp; 1 = ปรับปรุง</p>
                            </div>
                            <button
                                onClick={() => { setExpandedAdvisorStudentId(null); setAdvisorEvalTemplate(null); }}
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
                            >
                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable content */}
                        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-4">
                            {/* Score grid */}
                            <div className="rounded-2xl overflow-hidden border border-slate-100">
                                {/* Header row */}
                                <div className="grid bg-slate-50" style={{ gridTemplateColumns: '1fr 72px 72px 72px 72px 72px' }}>
                                    <div className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider">หัวข้อประเมิน</div>
                                    {[5, 4, 3, 2, 1].map(v => (
                                        <div key={v} className="py-3 text-center border-l border-slate-100">
                                            <div className="text-sm font-black text-slate-700">{v}</div>
                                            <div className="text-xs text-slate-400">{v === 5 ? 'ดีมาก' : v === 4 ? 'ดี' : v === 3 ? 'ปานกลาง' : v === 2 ? 'พอใช้' : 'ปรับปรุง'}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Sections */}
                                <div className="flex flex-col">
                                    {(advisorEvalTemplate.sections || []).map((section: any, sidx: number) => (
                                        <div key={section.id || sidx} className="flex flex-col">
                                            {/* Section Header */}
                                            <div className="bg-slate-100/80 px-5 py-2.5 border-t border-b border-slate-200 flex items-center gap-2 relative z-10">
                                                <div className="w-1.5 h-4 bg-orange-400 rounded-full"></div>
                                                <h3 className="text-sm font-bold text-slate-800">{section.name}</h3>
                                            </div>
                                            {/* Topic rows for this section */}
                                            {(section.topics || []).map((t: any, tidx: number) => (
                                                <div key={t.id || tidx} className={`grid border-b border-slate-100 ${tidx % 2 !== 0 ? 'bg-slate-50/50' : 'bg-white'}`} style={{ gridTemplateColumns: '1fr 72px 72px 72px 72px 72px' }}>
                                                    <div className="px-5 py-4 text-sm font-medium text-slate-700 flex items-center">
                                                        {t.name}
                                                    </div>
                                                    {[5, 4, 3, 2, 1].map(v => (
                                                        <div key={v} className="flex justify-center items-center border-l border-slate-100 hover:bg-slate-50">
                                                            <div
                                                                onClick={() => setAdvisorEvalForm(prev => ({ ...prev, scores: { ...prev.scores, [t.name]: prev.scores[t.name] === v ? 0 : v } }))}
                                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${advisorEvalForm.scores[t.name] === v
                                                                    ? 'border-orange-500 bg-orange-50'
                                                                    : 'border-slate-300 hover:border-orange-400 hover:bg-orange-50'
                                                                }`}
                                                            >
                                                                {advisorEvalForm.scores[t.name] === v && (
                                                                    <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Feedback */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">ข้อเสนอแนะ / หมายเหตุ <span className="text-slate-400 font-medium">(ถ้ามี)</span></label>
                                <textarea
                                    value={advisorEvalForm.feedback}
                                    onChange={(e) => setAdvisorEvalForm(prev => ({ ...prev, feedback: e.target.value }))}
                                    placeholder="ข้อเสนอแนะเพิ่มเติม..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none transition-all min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="shrink-0 flex gap-3 px-8 py-6 border-t border-slate-100 bg-white">
                            <button
                                onClick={() => {
                                    if (window.confirm('คุณต้องการล้างข้อมูลฟอร์มการประเมินนี้ใช่หรือไม่?')) {
                                        setAdvisorEvalForm(prev => {
                                            const clearedScores: Record<string, number> = {};
                                            Object.keys(prev.scores).forEach(k => clearedScores[k] = 0);
                                            return { ...prev, scores: clearedScores, feedback: '' };
                                        });
                                    }
                                }}
                                className="px-6 py-2.5 text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all mr-auto"
                            >
                                ล้างข้อมูลฟอร์ม
                            </button>
                            <button
                                onClick={() => { setExpandedAdvisorStudentId(null); setAdvisorEvalTemplate(null); }}
                                className="px-6 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:text-slate-800 transition-all"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSubmitAdvisorEval}
                                disabled={advisorEvalSubmitting}
                                className="px-8 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
                            >
                                {advisorEvalSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>กำลังบันทึก...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>บันทึกการประเมิน</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
