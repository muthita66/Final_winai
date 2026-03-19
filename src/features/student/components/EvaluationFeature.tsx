"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from "@/features/student/academic-term";
import { useMemo } from "react";

interface EvaluationFeatureProps {
    session: any;
}

export function EvaluationFeature({ session }: EvaluationFeatureProps) {
    const student = session;

    // View state
    const [mode, setMode] = useState<'evaluate' | 'evaluate_advisor' | 'evaluate_sdq'>('evaluate');

    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => Number(y.year_name));

    // Select state
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());

    const selectedYearLookup = yearOptionsData.find((y: any) => Number(y.year_name) === Number(year));
    const semesterOptions = selectedYearLookup?.semesters || [];

    // Sync year state if data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);

    // Data state
    const [registeredSubjects, setRegisteredSubjects] = useState<any[]>([]);
    const [totalRegistered, setTotalRegistered] = useState<number>(0);
    const [evaluatedCount, setEvaluatedCount] = useState<number>(0);
    const [selectedSection, setSelectedSection] = useState<any | null>(null);
    const [topics, setTopics] = useState<any[]>([]); // Full topic objects from DB with section info
    const [evaluatedSectionIds, setEvaluatedSectionIds] = useState<number[]>([]);
    const [history, setHistory] = useState<any[]>([]); // Student enrollment history for dynamic terms

    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data state - Advisor Evaluation
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [selectedAdvisor, setSelectedAdvisor] = useState<any | null>(null);
    const [advisorEvalTemplate, setAdvisorEvalTemplate] = useState<any | null>(null);
    const [isLoadingAdvisorData, setIsLoadingAdvisorData] = useState(false);

    // Form state (Subjects)
    const [scores, setScores] = useState<Record<string, number | string>>({});
    const [feedback, setFeedback] = useState("");

    // Form state (Advisor)
    const [advisorScores, setAdvisorScores] = useState<Record<string, number>>({});
    const [advisorFeedback, setAdvisorFeedback] = useState("");
    const [isSubmittingAdvisor, setIsSubmittingAdvisor] = useState(false);

    // Derived: have all registered subjects been evaluated?
    const allEvaluated = totalRegistered > 0 && evaluatedCount >= totalRegistered;

    // Dynamic Options from History
    const dynamicYearOptions = useMemo(() => {
        const years = new Set<number>();
        if (history.length > 0) {
            history.forEach(h => {
                if (h.year) years.add(Number(h.year));
            });
        }
        if (years.size === 0) return yearOptions;
        return Array.from(years).sort((a, b) => b - a);
    }, [history, yearOptions]);

    const dynamicSemesterOptions = useMemo(() => {
        const semesters = new Set<number>();
        if (history.length > 0) {
            history.forEach(h => {
                if (Number(h.year) === year && h.semester) {
                    semesters.add(Number(h.semester));
                }
            });
        }
        if (semesters.size === 0) {
            return semesterOptions.length > 0
                ? semesterOptions.map((s: any) => s.semester_number)
                : [1, 2];
        }
        return Array.from(semesters).sort((a, b) => a - b);
    }, [history, year, semesterOptions]);


    const initData = async () => {
        setIsLoadingInit(true);
        try {
            // First time: Fetch enrollment history to populate year/semester dropdowns
            if (history.length === 0) {
                const allGrades = await StudentApiService.getGrades();
                if (Array.isArray(allGrades) && allGrades.length > 0) {
                    setHistory(allGrades);

                    // If current year/semester is not in history, fallback to latest from history
                    const years = allGrades.map(g => Number(g.year));
                    const latestYear = Math.max(...years);
                    const semsForLatest = allGrades
                        .filter(g => Number(g.year) === latestYear)
                        .map(g => Number(g.semester));
                    const latestSem = Math.max(...semsForLatest);

                    // Only update if current year/semester is not present in history
                    const exists = allGrades.some(g => Number(g.year) === year && Number(g.semester) === semester);
                    if (!exists) {
                        setYear(latestYear);
                        setSemester(latestSem);
                        // The effect will trigger initData again with updated year/semester
                        return;
                    }
                }
            }

            // Fetch registered subjects for dropdown
            const regs = await StudentApiService.getRegistered(year, semester);

            // Fetch evaluated sections to filter out
            const evIds = await StudentApiService.getEvaluatedSections(year, semester);
            setEvaluatedSectionIds(evIds);

            // Count total unique registered subjects
            const uniqueAll: any[] = [];
            const seenAll = new Set();
            if (regs && Array.isArray(regs)) {
                regs.forEach(r => {
                    if (r.subject_code && !seenAll.has(r.subject_code)) {
                        seenAll.add(r.subject_code);
                        uniqueAll.push(r);
                    }
                });
            }
            setTotalRegistered(uniqueAll.length);
            setEvaluatedCount(evIds.length);

            // Keep all unique registered subjects
            setRegisteredSubjects(uniqueAll);

            // Fetch evaluation topics
            await fetchTopics(mode === 'evaluate_sdq' ? 'sdq' : 'teaching');
            setFetchError(null);
        } catch (err: any) {
            console.error("Failed to load initial evaluation data", err);
            setFetchError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลแบบประเมิน");
            setRegisteredSubjects([]);
        } finally {
            setIsLoadingInit(false);
        }
    };

    // Initialize
    useEffect(() => {
        initData();
    }, [year, semester]);
    const fetchTopics = async (type: 'teaching' | 'sdq' = 'teaching') => {
        setIsLoadingTopics(true);
        try {
            const result = await StudentApiService.getEvaluationTopics(year, semester, type);
            if (result && Array.isArray(result)) {
                const validTopics = result.filter((t: any) => t.name && t.name.trim().length > 0);
                setTopics(validTopics);

                // Initialize score state keyed by topic name
                const initScores: Record<string, number | string> = {};
                validTopics.forEach((t: any) => {
                    const isTextTopic = t.type === 'text' ||
                        t.type === 'textarea' ||
                        t.section_name?.includes("ตอนที่ 3") ||
                        t.name?.includes("แสดงความคิดเห็น");
                    initScores[t.name] = isTextTopic ? "" : -1;
                });
                setScores(initScores);
            }
        } catch (error) {
            console.error("Failed to load topics", error);
        } finally {
            setIsLoadingTopics(false);
        }
    };

    const handleSubjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sectionId = parseInt(e.target.value);
        if (!sectionId) {
            setSelectedSection(null);
            return;
        }

        const subject = registeredSubjects.find(s => s.section_id === sectionId);
        setSelectedSection(subject || null);

        // Reset scores keyed by topic name
        const initScores: Record<string, number | string> = {};
        topics.forEach((t: any) => {
            const isTextTopic = t.type === 'text' ||
                t.type === 'textarea' ||
                t.section_name?.includes("ตอนที่ 3") ||
                t.name?.includes("แสดงความคิดเห็น");
            initScores[t.name] = isTextTopic ? "" : -1;
        });
        setScores(initScores);
        setFeedback("");
    };

    const handleScoreChange = (topicName: string, value: number | string) => {
        setScores(prev => ({
            ...prev,
            [topicName]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSection) {
            toast.error("กรุณาเลือกวิชาก่อนส่งประเมิน");
            return;
        }

        if (topics.length === 0) {
            toast.error("ไม่พบข้อคำถามในการประเมิน");
            return;
        }

        // Validate all questions answered
        const unanswered = topics.filter((t: any) => {
            const val = scores[t.name];
            if (t.type === 'text' || t.type === 'textarea') {
                return val === undefined || val === null; // Empty string is fine for text
            }
            return val === undefined || val === null || val === -1;
        });
        if (unanswered.length > 0) {
            toast.error("กรุณาตอบแบบประเมินให้ครบทุกข้อ");
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToSubmit = topics.map((t: any) => ({
                name: t.name,
                value: scores[t.name]
            }));

            await StudentApiService.submitEvaluation(
                dataToSubmit,
                year,
                semester,
                selectedSection.section_id,
                feedback
            );

            toast.success("ส่งแบบประเมินสำเร็จ ขอบคุณสำหรับความร่วมมือ");

            // Refresh the list to remove the evaluated subject
            await initData();
            setSelectedSection(null);
            setFeedback("");

            // Reset scores keyed by topic name
            const initScores: Record<string, number | string> = {};
            topics.forEach((t: any) => {
                const isTextTopic = t.type === 'text' ||
                    t.type === 'textarea' ||
                    t.section_name?.includes("ตอนที่ 3") ||
                    t.name?.includes("แสดงความคิดเห็น");
                initScores[t.name] = isTextTopic ? "" : -1;
            });
            setScores(initScores);

        } catch (error: any) {
            console.error("Failed to submit evaluation", error);
            toast.error(error?.message || "เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่");
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchAdvisors = async () => {
        setIsLoadingAdvisorData(true);
        try {
            const result = await StudentApiService.getAdvisor(year, semester);
            if (result && result.advisors) {
                setAdvisors(result.advisors);
            } else {
                setAdvisors([]);
            }
            setSelectedAdvisor(null);
            setAdvisorEvalTemplate(null);
        } catch (err: any) {
            console.error("Failed to fetch advisors", err);
        } finally {
            setIsLoadingAdvisorData(false);
        }
    };

    useEffect(() => {
        if (mode === 'evaluate_advisor') {
            fetchAdvisors();
        } else if (mode === 'evaluate_sdq') {
            fetchTopics('sdq');
        } else {
            fetchTopics('teaching');
        }
    }, [mode, year, semester]);

    const handleSelectAdvisor = async (advisorId: number) => {
        const advisor = advisors.find((a: any) => a.teacher_id === advisorId);
        setSelectedAdvisor(advisor || null);

        if (!advisorId) {
            setAdvisorEvalTemplate(null);
            return;
        }

        setIsLoadingAdvisorData(true);
        try {
            const template = await StudentApiService.getAdvisorTeacherEvaluationTemplate(advisorId, year, semester);
            setAdvisorEvalTemplate(template);

            // Initialize advisor scores
            const initScores: Record<string, number> = {};
            if (template.topics) {
                template.topics.forEach((t: any) => {
                    const existing = template.current?.find((c: any) => c.name === t.name);
                    initScores[t.name] = existing ? existing.score : 0;
                });
            }
            setAdvisorScores(initScores);
            setAdvisorFeedback(template.feedback || "");
        } catch (err: any) {
            console.error("Failed to fetch advisor template", err);
            toast.error(err.message || "ไม่สามารถดึงข้อมูลแบบประเมินที่ปรึกษาได้");
        } finally {
            setIsLoadingAdvisorData(false);
        }
    };

    const handleAdvisorScoreChange = (topicName: string, value: number) => {
        setAdvisorScores(prev => ({ ...prev, [topicName]: value }));
    };

    const handleSubmitAdvisorEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedAdvisor || !advisorEvalTemplate) {
            toast.error("ข้อมูลแบบประเมินไม่สมบูรณ์");
            return;
        }

        const topics = advisorEvalTemplate.topics?.map((t: any) => t.name) || [];
        const unanswered = topics.filter((t: string) => !advisorScores[t] || advisorScores[t] === 0);

        if (unanswered.length > 0) {
            toast.error("กรุณาตอบแบบประเมินให้ครบทุกข้อ");
            return;
        }

        setIsSubmittingAdvisor(true);
        try {
            const dataToSubmit = topics.map((t: string) => ({
                name: t,
                score: advisorScores[t]
            }));

            await StudentApiService.submitAdvisorTeacherEvaluation(
                selectedAdvisor.teacher_id,
                dataToSubmit,
                year,
                semester,
                advisorFeedback
            );

            toast.success("ส่งแบบประเมินที่ปรึกษาสำเร็จ");

            // Refresh to get updated submission status
            await handleSelectAdvisor(selectedAdvisor.teacher_id);

        } catch (err: any) {
            console.error("Failed to submit advisor evaluation", err);
            toast.error(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSubmittingAdvisor(false);
        }
    };

    if (isLoadingInit) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                <svg className="w-8 h-8 animate-spin text-teal-600 mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>กำลังเตรียมข้อมูลประเมิน...</p>
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
            <section className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                            {mode === 'evaluate' ? 'Evaluation' : (mode === 'evaluate_sdq' ? 'SDQ Evaluation' : 'Advisor Evaluation')}
                        </div>
                        <h1 className="text-2xl font-bold mb-1">
                            {mode === 'evaluate' ? 'แบบประเมินประสิทธิภาพการสอน' : (mode === 'evaluate_sdq' ? 'แบบประเมิน SDQ' : 'ประเมินครูที่ปรึกษา')}
                        </h1>
                        <p className="text-teal-100 text-sm mt-1">
                            {mode === 'evaluate'
                                ? 'ช่วยกันพัฒนาคุณภาพการเรียนการสอนด้วยคะแนนประเมิน'
                                : (mode === 'evaluate_sdq' ? 'ประเมินพฤติกรรมและอารมณ์ของนักเรียน' : 'ประเมินครูที่ปรึกษาของคุณ')}
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[200px]">
                        <div className="text-teal-100 text-xs font-medium mb-2">{mode === 'evaluate' ? 'สถานะ' : 'สถานะล่าสุด'}</div>
                        {mode === 'evaluate' || mode === 'evaluate_sdq' ? (
                            allEvaluated && mode === 'evaluate' ? (
                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ประเมินครบแล้ว
                                </div>
                            ) : (
                                <>
                                    {selectedSection ? (
                                        evaluatedSectionIds.includes(selectedSection.section_id) ? (
                                            <div className="text-lg font-bold text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                ประเมินแล้ว
                                            </div>
                                        ) : (
                                            <div className="text-lg font-bold text-yellow-300 flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                รอการประเมิน
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-lg font-bold text-white flex items-center gap-2">
                                            <svg className="w-5 h-5 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {mode === 'evaluate_sdq' ? 'พร้อมประเมิน' : 'กรุณาเลือกวิชา'}
                                        </div>
                                    )}
                                    {mode === 'evaluate' && totalRegistered > 0 && (
                                        <div className="text-teal-200 text-[10px] mt-1">
                                            ประเมินแล้ว {evaluatedCount}/{totalRegistered} วิชา
                                        </div>
                                    )}
                                </>
                            )
                        ) : (
                            // Advisor Status
                            <>
                                <div className="text-xl font-bold text-white mb-0.5">
                                    {selectedAdvisor
                                        ? (isLoadingAdvisorData
                                            ? 'กำลังโหลด...'
                                            : (advisorEvalTemplate?.submitted_at
                                                ? 'ประเมินแล้ว'
                                                : (advisorEvalTemplate ? 'รอการประเมิน' : 'ไม่สามารถโหลดฟอร์มได้')))
                                        : '-'}
                                </div>
                                {selectedAdvisor && (
                                    <div className="text-teal-100 text-[10px]">
                                        {selectedAdvisor.first_name} {selectedAdvisor.last_name}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </section>

            {/* Tab Navigation Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => { setMode('evaluate'); setSelectedAdvisor(null); }}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${mode === 'evaluate'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'evaluate' ? 'bg-white/20' : 'bg-teal-50 text-teal-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold">ประเมินการสอน</div>
                        <div className={`text-xs mt-0.5 ${mode === 'evaluate' ? 'text-teal-100' : 'text-slate-400'}`}>ประเมินครูผู้สอนรายวิชา</div>
                    </div>
                </button>
                <button
                    onClick={() => setMode('evaluate_advisor')}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${mode === 'evaluate_advisor'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'evaluate_advisor' ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold">ประเมินครูที่ปรึกษา</div>
                        <div className={`text-xs mt-0.5 ${mode === 'evaluate_advisor' ? 'text-teal-100' : 'text-slate-400'}`}>ประเมินอาจารย์ที่ปรึกษาห้อง</div>
                    </div>
                </button>
                <button
                    onClick={() => { setMode('evaluate_sdq'); setSelectedAdvisor(null); setSelectedSection(null); }}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${mode === 'evaluate_sdq'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode === 'evaluate_sdq' ? 'bg-white/20' : 'bg-orange-50 text-orange-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold">ประเมิน SDQ</div>
                        <div className={`text-xs mt-0.5 ${mode === 'evaluate_sdq' ? 'text-teal-100' : 'text-slate-400'}`}>แบบประเมินพฤติกรรม (SDQ)</div>
                    </div>
                </button>
            </div>

            {/* Global Selection Section (Year, Semester, Subject) */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {mode === 'evaluate' ? 'เลือกปี/เทอม และรายวิชา' : (mode === 'evaluate_sdq' ? 'เลือกปีการศึกษา และภาคเรียน' : 'เลือกปีการศึกษา และภาคเรียน')}
                        </h3>
                        <p className="text-slate-500 text-sm">กำหนดช่วงเวลาและข้อมูลที่ต้องการประเมิน</p>
                    </div>
                </div>

                <div className={`grid grid-cols-1 ${mode === 'evaluate' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ปีการศึกษา</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-100 appearance-none text-slate-700 shadow-sm"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            {dynamicYearOptions.map((y: any) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ภาคเรียน</label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(parseInt(e.target.value))}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-100 appearance-none text-slate-700 shadow-sm"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            {dynamicSemesterOptions.map((s: any) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    {mode === 'evaluate' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">วิชาที่ลงทะเบียนเรียน</label>
                            <select
                                value={selectedSection?.section_id || ""}
                                onChange={handleSubjectChange}
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-100 appearance-none text-slate-700 shadow-sm"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                            >
                                <option value="" disabled>-- กรุณาเลือกวิชา --</option>
                                {registeredSubjects.map(sub => {
                                    const isEvaluated = evaluatedSectionIds.includes(sub.section_id);
                                    return (
                                        <option key={sub.section_id} value={sub.section_id}>
                                            {sub.subject_code} - {sub.subject_name} {isEvaluated ? "(ประเมินแล้ว)" : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}
                </div>
            </section>

            {mode === 'evaluate' || mode === 'evaluate_sdq' ? (
                <>
                    {/* Teacher Info */}
                    {mode === 'evaluate' && selectedSection && (
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">ข้อมูลผู้สอน</h3>
                                    <p className="text-slate-500 text-sm">รายละเอียดรายวิชา</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 text-sm font-medium">อาจารย์ผู้สอน</div>
                                        <div className="text-lg font-bold text-slate-800">{selectedSection?.teacher_name || "กรุณาเลือกวิชา"}</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 text-sm font-medium">รายวิชา</div>
                                        <div className="text-lg font-bold text-slate-800">{selectedSection?.subject_name || "-"}</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Evaluation Form / Status */}
                    {(mode === 'evaluate_sdq' || selectedSection) && (
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            {mode === 'evaluate' && selectedSection && evaluatedSectionIds.includes(selectedSection.section_id) ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <h4 className="text-2xl font-bold text-slate-800 mb-2">ประเมินแล้ว</h4>
                                    <p className="text-slate-500 max-w-md">
                                        คุณได้ทำการประเมินวิชา <span className="font-bold text-teal-600">{selectedSection.subject_name}</span> เรียบร้อยแล้ว ขอบคุณสำหรับข้อมูล
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">รายการประเมิน</h3>
                                            <p className="text-slate-500 text-sm">ตอบแบบประเมิน 5: มากที่สุด 4: มาก 3: ปานกลาง 2: น้อย 1: น้อยที่สุด 0: ไม่แน่ใจ</p>
                                        </div>
                                    </div>

                                    {isLoadingTopics ? (
                                        <div className="text-center py-12 text-slate-500">
                                            <svg className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            กำลังโหลดหัวข้อประเมิน...
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit}>
                                            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-6 py-4 font-bold w-1/2 min-w-[300px]">หัวข้อประเมิน</th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">มากที่สุด</span></th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">มาก</span></th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">ปานกลาง</span></th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">น้อย</span></th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">น้อยที่สุด</span></th>
                                                            <th className="px-3 py-4 font-medium text-center"><br /><span className="text-[12px] text-slate-600">ไม่แน่ใจ</span></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {topics.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                                                    ยังไม่มีหัวข้อ{mode === 'evaluate_sdq' ? 'ประเมิน SDQ' : 'ประเมินการสอน'}
                                                                </td>
                                                            </tr>
                                                        ) : (() => {
                                                            const rows: React.ReactNode[] = [];
                                                            let lastSectionId: number | null = null;
                                                            topics.forEach((topic: any, idx: number) => {
                                                                const sid = topic.section_id ?? null;
                                                                if (sid !== lastSectionId) {
                                                                    lastSectionId = sid;
                                                                    if (topic.section_name) {
                                                                        rows.push(
                                                                            <tr key={`sec-${sid}`} className="bg-teal-50 border-y border-teal-200">
                                                                                <td colSpan={7} className="px-6 py-3 font-bold text-teal-800 text-sm">
                                                                                    {topic.section_name}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                }

                                                                const isText = topic.type === 'text' ||
                                                                    topic.type === 'textarea' ||
                                                                    topic.section_name?.includes("ตอนที่ 3") ||
                                                                    topic.name?.includes("แสดงความคิดเห็น");

                                                                rows.push(
                                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                        {isText ? (
                                                                            <td colSpan={7} className="px-6 py-4">
                                                                                <div className="font-medium text-slate-700 mb-3">{topic.name.replace(/^[\d.]+\s*/, '')}</div>
                                                                                <textarea
                                                                                    value={scores[topic.name] || ''}
                                                                                    onChange={(e) => handleScoreChange(topic.name, e.target.value)}
                                                                                    placeholder="พิมพ์ข้อเสนอแนะของคุณ..."
                                                                                    className="w-full h-24 p-4 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 transition-all resize-none"
                                                                                ></textarea>
                                                                            </td>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                                                    {topic.name.replace(/^[\d.]+\s*/, '')}
                                                                                </td>
                                                                                {[5, 4, 3, 2, 1, 0].map(val => (
                                                                                    <td key={val} className="px-3 py-4 text-center">
                                                                                        <label className="flex justify-center items-center w-full h-full cursor-pointer group">
                                                                                            <input
                                                                                                type="radio"
                                                                                                name={`topic-${idx}`}
                                                                                                value={val}
                                                                                                checked={scores[topic.name] === val}
                                                                                                onChange={() => handleScoreChange(topic.name, val)}
                                                                                                className="w-5 h-5 text-teal-600 bg-slate-100 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                                                                required
                                                                                            />
                                                                                        </label>
                                                                                    </td>
                                                                                ))}
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            });
                                                            return rows;
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex justify-end pt-4">
                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting || (mode === 'evaluate' && !selectedSection) || topics.length === 0}
                                                    className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2
                                                ${(isSubmitting || (mode === 'evaluate' && !selectedSection) || topics.length === 0)
                                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                            : "bg-teal-600 text-white hover:bg-teal-700"}`}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            กำลังบันทึก...
                                                        </>
                                                    ) : "ส่งแบบประเมิน"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </section>
                    )}
                </>
            ) : (
                <section className="space-y-6">
                    {isLoadingAdvisorData && !advisors.length ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl shadow-sm border border-slate-200">
                            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p>กำลังโหลดข้อมูลที่ปรึกษา...</p>
                        </div>
                    ) : advisors.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h4 className="text-slate-600 font-bold text-lg mb-1">ไม่พบข้อมูลที่ปรึกษา</h4>
                            <p className="text-slate-400">ยังไม่มีข้อมูลครูที่ปรึกษาในระบบ</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Advisor Selection Box */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">เลือกครูที่ปรึกษา</h3>
                                        <p className="text-slate-500 text-sm">ครูที่ปรึกษาในห้องเรียนของคุณ สำหรับปี/เทอมที่เลือก ({advisors.length} ท่าน)</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {advisors.map((ad: any, idx: number) => {
                                        const isSelected = selectedAdvisor?.teacher_id === ad.teacher_id;
                                        return (
                                            <button
                                                key={ad.id}
                                                onClick={() => handleSelectAdvisor(ad.teacher_id)}
                                                className={`text-left p-6 rounded-2xl border-2 transition-all block w-full ${isSelected
                                                    ? 'border-teal-500 bg-teal-50 shadow-md'
                                                    : 'border-slate-200 hover:border-teal-300 bg-white shadow-sm'
                                                    }`}
                                            >
                                                <div className={`text-xs font-bold mb-2 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`}>
                                                    ครูที่ปรึกษาคนที่ {idx + 1}
                                                </div>
                                                <div className="font-bold text-slate-800 text-lg mb-1">
                                                    {ad.prefix}{ad.first_name} {ad.last_name}
                                                </div>
                                                <div className="text-slate-500 text-sm">
                                                    {ad.teacher_code || "-"}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Advisor Form */}
                            {isLoadingAdvisorData && selectedAdvisor ? (
                                <div className="flex justify-center py-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                                    <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            ) : advisorEvalTemplate && selectedAdvisor ? (
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">
                                                ฟอร์มประเมิน {selectedAdvisor.prefix}{selectedAdvisor.first_name} {selectedAdvisor.last_name}
                                            </h3>
                                            <p className="text-slate-500">กรุณาให้คะแนนตามความเป็นจริง</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmitAdvisorEvaluation}>
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-6 py-4 font-medium w-1/2 min-w-[300px]">หัวข้อประเมิน (ที่ปรึกษา)</th>
                                                        <th className="px-3 py-4 font-medium text-center">5<br /><span className="text-[10px] text-slate-400">ดีมาก</span></th>
                                                        <th className="px-3 py-4 font-medium text-center">4<br /><span className="text-[10px] text-slate-400">ดี</span></th>
                                                        <th className="px-3 py-4 font-medium text-center">3<br /><span className="text-[10px] text-slate-400">ปานกลาง</span></th>
                                                        <th className="px-3 py-4 font-medium text-center">2<br /><span className="text-[10px] text-slate-400">พอใช้</span></th>
                                                        <th className="px-3 py-4 font-medium text-center">1<br /><span className="text-[10px] text-slate-400">ปรับปรุง</span></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {!advisorEvalTemplate?.topics || advisorEvalTemplate.topics.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                                ยังไม่มีหัวข้อประเมินครูที่ปรึกษา
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        advisorEvalTemplate.topics.map((topic: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                                    1.{idx + 1} {topic.name.replace(/^[\d.]+\s*/, '')}
                                                                </td>
                                                                {[5, 4, 3, 2, 1].map(val => (
                                                                    <td key={val} className="px-3 py-4 text-center">
                                                                        <label className="flex justify-center items-center w-full h-full cursor-pointer group">
                                                                            <input
                                                                                type="radio"
                                                                                name={`adv-topic-${idx}`}
                                                                                value={val}
                                                                                checked={advisorScores[topic.name] === val}
                                                                                onChange={() => handleAdvisorScoreChange(topic.name, val)}
                                                                                className="w-5 h-5 text-teal-600 bg-slate-100 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                                                required
                                                                            />
                                                                        </label>
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
                                            <textarea
                                                value={advisorFeedback}
                                                onChange={(e) => setAdvisorFeedback(e.target.value)}
                                                rows={4}
                                                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
                                                placeholder="พิมพ์ข้อเสนอแนะของคุณต่อครูที่ปรึกษา..."
                                            ></textarea>
                                        </div>
                                        <div className="flex justify-end pt-4 border-t border-slate-100">
                                            <button
                                                type="submit"
                                                disabled={isSubmittingAdvisor || !advisorEvalTemplate?.topics}
                                                className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2
                                            ${(isSubmittingAdvisor || !advisorEvalTemplate?.topics)
                                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        : "bg-teal-600 text-white hover:bg-teal-700"}`}
                                            >
                                                {isSubmittingAdvisor ? (
                                                    <>
                                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        กำลังบันทึก...
                                                    </>
                                                ) : "ส่งแบบประเมิน"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : null}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

