"use client";

import { useState, useEffect, useMemo } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from "@/features/student/academic-term";

interface LearningResultsFeatureProps {
    session: any;
    initialTab?: "subject" | "advisor";
    hideResultTabs?: boolean;
}

function getScoreTextColor(avg: number): string {
    if (avg >= 4) return "text-emerald-600";
    if (avg >= 3) return "text-teal-600";
    if (avg >= 2) return "text-amber-600";
    return "text-rose-600";
}

export function LearningResultsFeature({
    session,
    initialTab = "subject",
    hideResultTabs = false,
}: LearningResultsFeatureProps) {
    const student = session;

    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => Number(y.year_name));

    // Select state
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());
    const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
    const [activeResultTab, setActiveResultTab] = useState<"subject" | "advisor">(initialTab);
    const [hasManualTermSelection, setHasManualTermSelection] = useState(false);
    const [didAutoFallback, setDidAutoFallback] = useState(false);

    // Advisor selection states
    const [selectedAdvisorUserId, setSelectedAdvisorUserId] = useState<number | null>(null);
    const [selectedFormName, setSelectedFormName] = useState<string>('แบบประเมินคุณลักษณะอันพึงประสงค์');

    const selectedYearLookup = yearOptionsData.find((y: any) => Number(y.year_name) === Number(year));
    const semesterOptions = selectedYearLookup?.semesters || [];

    // Sync year state if data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);
    const advisorOnlyMode = hideResultTabs && activeResultTab === "advisor";

    // Queries
    const enrollmentHistoryQuery = useQuery({
        queryKey: ["student", "grades", "all"],
        queryFn: () => StudentApiService.getGrades(),
    });
    const history = Array.isArray(enrollmentHistoryQuery.data) ? enrollmentHistoryQuery.data : [];

    const registeredQuery = useQuery({
        queryKey: ["student", "registered", year, semester],
        queryFn: () => StudentApiService.getRegistered(year, semester),
    });
    const registeredSubjects = Array.isArray(registeredQuery.data) ? registeredQuery.data : [];

    const queryAdvisor = useQuery({
        queryKey: ['advisor-evaluation', student?.id, year, semester],
        queryFn: () => StudentApiService.getAdvisorEvaluation(year, semester),
        enabled: !!student?.id && activeResultTab === "advisor"
    });
    const advisorEvalData = (queryAdvisor.data as any) || { advisors: [], evaluations: [] };
    const advisorList = advisorEvalData.advisors || [];
    const allAdvisorEvaluations = advisorEvalData.evaluations || [];

    // Auto-select first advisor if none selected
    useEffect(() => {
        if (advisorList.length > 0 && !selectedAdvisorUserId) {
            setSelectedAdvisorUserId(advisorList[0].user_id);
        }
    }, [advisorList, selectedAdvisorUserId]);

    // Current filtered advisor evaluation
    const currentAdvisorEval = allAdvisorEvaluations.find((ev: any) => {
        if (ev.evaluator_user_id !== selectedAdvisorUserId) return false;
        const formName = String(ev.form_name || "");
        if (selectedFormName === 'แบบประเมินคุณลักษณะอันพึงประสงค์') {
            return formName.includes('คุณลักษณะอันพึงประสงค์');
        } else {
            // For the other form (คุณลักษณะของนักเรียนขณะอยู่ที่โรงเรียน / อ่านคิดวิเคราะห์), 
            // match any form that is NOT the attributes form to support varying DB names
            return !formName.includes('คุณลักษณะอันพึงประสงค์');
        }
    }) || { topics: [], feedback: '', average_score: 0 };

    const advisorTopics = currentAdvisorEval.topics || [];
    const selectedSubjectData = registeredSubjects.find(s => s.section_id === selectedSectionId);

    const subjectEvaluationQuery = useQuery({
        queryKey: ["student", "evaluation", "subject", selectedSectionId, year, semester],
        queryFn: () => {
            if (!selectedSectionId || !selectedSubjectData) return [];
            return StudentApiService.getSubjectEvaluation(
                selectedSectionId as number,
                year,
                semester,
                selectedSubjectData.subject_id
            );
        },
        enabled: !!selectedSectionId && !!selectedSubjectData,
    });

    const subjectEvaluations = Array.isArray(subjectEvaluationQuery.data) ? subjectEvaluationQuery.data : [];


    const isLoadingInit = registeredQuery.isLoading;
    const isLoadingAdvisor = queryAdvisor.isLoading;
    const isLoadingSubject = subjectEvaluationQuery.isLoading;
    const fetchError = (registeredQuery.error as any)?.message || null;

    const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sectionId = parseInt(e.target.value);
        if (!sectionId) {
            setSelectedSectionId("");
            return;
        }
        setSelectedSectionId(sectionId);
    };



    const renderProgressBar = (score: number) => {
        const displayScore = Number.isFinite(score) ? (Number.isInteger(score) ? score : score.toFixed(2)) : "-";
        const percent = Number.isFinite(score) ? (score / 5) * 100 : 0;

        let color = "bg-teal-600";
        if (score <= 2) color = "bg-red-500";
        else if (score == 3) color = "bg-amber-500";

        return (
            <div>
                <div className="flex justify-between text-sm mb-1 text-slate-600">
                    <span>คะแนน:</span>
                    <strong className="text-slate-800">{displayScore}/5</strong>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full ${color}`}
                        style={{ width: `${percent}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    const dynamicYearOptions = useMemo(() => {
        const years = new Set<string>();
        if (history.length > 0) {
            history.forEach(h => {
                if (h.year) years.add(String(h.year));
            });
            return Array.from(years).sort((a, b) => Number(b) - Number(a));
        }
        return yearOptions.map(String);
    }, [history, yearOptions]);

    const dynamicSemesterOptions = useMemo(() => {
        const semesters = new Set<number>();
        if (history.length > 0) {
            history.forEach(h => {
                if (String(h.year) === String(year) && h.semester) {
                    semesters.add(Number(h.semester));
                }
            });
            if (semesters.size > 0) {
                return Array.from(semesters).sort((a, b) => a - b);
            }
        }
        return semesterOptions.length > 0
            ? semesterOptions.map((s: any) => s.semester_number)
            : [1, 2];
    }, [history, year, semesterOptions]);

    useEffect(() => {
        if (history.length > 0 && !hasManualTermSelection && !didAutoFallback) {
            const years = history.map(h => Number(h.year));
            const latestYear = Math.max(...years);
            const semsForLatest = history
                .filter(h => Number(h.year) === latestYear)
                .map(h => Number(h.semester));
            const latestSem = Math.max(...semsForLatest);

            const exists = history.some(h => Number(h.year) === year && Number(h.semester) === semester);
            if (!exists) {
                setYear(latestYear);
                setSemester(latestSem);
                setDidAutoFallback(true);
            }
        }
    }, [history, year, semester, hasManualTermSelection, didAutoFallback]);

    if (isLoadingInit || enrollmentHistoryQuery.isLoading) {
        return (
            <div className="space-y-6">
                <section className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="w-full md:w-1/2">
                        <Skeleton variant="rounded" className="h-4 w-20 mb-3 bg-white/20" />
                        <Skeleton variant="rounded" className="h-7 w-64 mb-1 bg-white/20" />
                        <Skeleton variant="rounded" className="h-4 w-80 bg-white/20" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[200px]">
                        <Skeleton variant="rounded" className="h-3 w-32 mb-1.5 bg-white/20" />
                        <Skeleton variant="rounded" className="h-6 w-24 bg-white/20" />
                    </div>
                </section>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <Skeleton variant="rounded" className="h-6 w-48 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton variant="rounded" className="h-12 w-full" />
                        <Skeleton variant="rounded" className="h-12 w-full" />
                        <Skeleton variant="rounded" className="h-12 w-full" />
                    </div>
                </div>
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
                            Learning Result
                        </div>
                        <h1 className="text-2xl font-bold mb-1">ผลประเมินสมรรถนะผู้เรียน</h1>
                        <p className="text-teal-100 text-sm">
                            สรุประดับสมรรถนะรายด้านและข้อเสนอแนะ
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[200px]">
                        <div className="text-teal-100 text-xs font-medium mb-1.5">สถานะ</div>
                        <div className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            พร้อมดูผล
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </section>

            {!hideResultTabs && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => setActiveResultTab("subject")}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${activeResultTab === "subject"
                            ? "bg-teal-600 text-white border-teal-600 shadow-lg scale-[1.02]"
                            : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50"
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeResultTab === "subject" ? "bg-white/20" : "bg-teal-50 text-teal-600"}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold">ผลประเมินรายวิชา</div>
                            <div className={`text-xs mt-0.5 ${activeResultTab === "subject" ? "text-teal-100" : "text-slate-400"}`}>จากครูผู้สอนรายวิชา</div>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveResultTab("advisor")}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-semibold transition-all duration-300 border-2 ${activeResultTab === "advisor"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-lg scale-[1.02]"
                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeResultTab === "advisor" ? "bg-white/20" : "bg-emerald-50 text-emerald-600"}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold">ผลประเมินครูที่ปรึกษา</div>
                            <div className={`text-xs mt-0.5 ${activeResultTab === "advisor" ? "text-emerald-100" : "text-slate-400"}`}>ประเมินโดยรวมจากที่ปรึกษา</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Selection Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">เลือกปีการศึกษาและภาคเรียน</h3>
                        <p className="text-slate-500 text-sm">กรองผลการประเมิน</p>
                    </div>
                </div>

                <div className={`grid grid-cols-1 ${advisorOnlyMode ? "md:grid-cols-2" : "md:grid-cols-3"} gap-6`}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ปีการศึกษา</label>
                        <select
                            value={year}
                            onChange={(e) => {
                                setYear(parseInt(e.target.value));
                                setHasManualTermSelection(true);
                            }}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
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
                            onChange={(e) => {
                                setSemester(parseInt(e.target.value));
                                setHasManualTermSelection(true);
                            }}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            {dynamicSemesterOptions.map((s: any) => (
                                <option key={s} value={String(s)}>{s}</option>
                            ))}
                        </select>
                    </div>
                    {activeResultTab === "subject" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">รายวิชา</label>
                            <select
                                value={selectedSectionId}
                                onChange={handleSubjectChange}
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                            >
                                {isLoadingInit ? (
                                    <option value="" disabled>กำลังโหลด...</option>
                                ) : fetchError ? (
                                    <option value="" disabled>มีข้อผิดพลาด ({fetchError})</option>
                                ) : registeredSubjects.length === 0 ? (
                                    <option value="" disabled>ยังไม่มีรายวิชาที่ลงทะเบียน</option>
                                ) : (
                                    <>
                                        <option value="" disabled>-- เลือกวิชา --</option>
                                        {registeredSubjects.map(sub => (
                                            <option key={sub.section_id} value={sub.section_id}>
                                                {sub.subject_code} - {sub.subject_name}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                    )}
                </div>
                <div className="mt-4 text-sm text-slate-500">ผลประเมินจะแสดงทันทีเมื่อเลือกปีและเทอม</div>
            </section>

            {/* Subject Evaluation Results */}
            {activeResultTab === "subject" && (
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">ผลประเมินรายวิชา</h3>
                            <p className="text-slate-500 text-sm">จากครูผู้สอน</p>
                        </div>
                    </div>

                    <div className="mb-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        ครูผู้สอน: <span className="font-semibold text-slate-800">{selectedSubjectData?.teacher_name || "-"}</span>
                    </div>

                    {isLoadingSubject ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-24 w-full" />
                            ))}
                        </div>
                    ) : !selectedSectionId ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                            กรุณาเลือกวิชา
                        </div>
                    ) : subjectEvaluations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                            ยังไม่มีผลประเมินรายวิชา
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {subjectEvaluations.map((evalData, idx) => (
                                <div key={idx} className="space-y-8 pb-8 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                                        <div className="lg:col-span-3 space-y-4">
                                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                                <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                                คะแนนประเมินรายหัวข้อ
                                            </h3>
                                            <div className="space-y-6">
                                                {(() => {
                                                    const sectionNames = Array.from(new Set((evalData.topics || []).map((t: any) => String(t.section_name || 'ไม่ระบุตอน')))) as string[];
                                                    const grouped = sectionNames.map(name => ({
                                                        name,
                                                        items: (evalData.topics || []).filter((t: any) => (t.section_name || 'ไม่ระบุตอน') === name)
                                                    }));

                                                    return grouped.map((section, sIdx) => (
                                                        <div key={sIdx} className="space-y-3">
                                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border-l-4 border-emerald-400">
                                                                <span className="text-sm md:text-base font-black text-emerald-600 uppercase tracking-wider">{section.name}</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {section.items.map((topic: any, tIdx: number) => {
                                                                    const score = Number(topic.score || 0);
                                                                    const displayTopic = topic.name.replace(/^[\d\.\s]+/, '');
                                                                    return (
                                                                        <div key={tIdx} className="flex justify-between items-baseline gap-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all px-2 rounded-lg">
                                                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                                <span className="text-sm md:text-base font-normal text-slate-700 leading-relaxed">{displayTopic}</span>
                                                                            </div>
                                                                            <span className={`flex-shrink-0 text-sm font-medium ${getScoreTextColor(score)}`}>
                                                                                {score.toFixed(2)} <span className="text-slate-300 font-normal">/ 5</span>
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 flex flex-col items-center justify-center text-center gap-4 shadow-sm h-fit">
                                                <div className="text-[14px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">คะแนนรวมเฉลี่ย</div>
                                                <div className={`text-6xl font-black tracking-normal ${evalData.average_score > 0 ? getScoreTextColor(evalData.average_score) : "text-slate-300"}`} style={{ letterSpacing: '0.05em' }}>
                                                    {evalData.average_score > 0 ? evalData.average_score.toFixed(2) : "—"}
                                                </div>
                                                <div className="flex gap-1 mt-2">
                                                    {[1, 2, 3, 4, 5].map((star) => {
                                                        const filled = evalData.average_score >= star;
                                                        const half = !filled && evalData.average_score >= star - 0.5;
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
                                            </div>
                                        </div>
                                    </div>

                                    {/* Feedback */}
                                    {evalData.feedback && (
                                        <div>
                                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
                                                <div className="w-1 h-5 bg-teal-500 rounded-full" />
                                                ข้อเสนอแนะจากผู้สอน
                                            </h3>
                                            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
                                                <svg className="w-8 h-8 text-teal-100 absolute top-4 right-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                                </svg>
                                                <p className="text-slate-700 leading-relaxed text-sm relative z-10">{evalData.feedback}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Advisor Evaluation Results */}
            {activeResultTab === "advisor" && (
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">ผลประเมินโดยรวม(ครูที่ปรึกษา)</h3>
                            <p className="text-slate-500 text-sm">ผลรายด้าน</p>
                        </div>
                    </div>

                    {/* Advisor Selection (if multiple) */}
                    {advisorList.length > 1 && (
                        <div className="flex flex-wrap gap-2 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="w-full text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">เลือกครูที่ปรึกษา</div>
                            {advisorList.map((adv: any) => (
                                <button
                                    key={adv.user_id}
                                    onClick={() => setSelectedAdvisorUserId(adv.user_id)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        selectedAdvisorUserId === adv.user_id
                                            ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                            : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                    }`}
                                >
                                    {adv.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Form Type Selection Tabs (Sub-tabs) */}
                    <div className="flex bg-slate-100/50 p-1.5 rounded-2xl mb-8 border border-slate-100">
                        <button
                            onClick={() => setSelectedFormName('แบบประเมินคุณลักษณะอันพึงประสงค์')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${
                                selectedFormName === 'แบบประเมินคุณลักษณะอันพึงประสงค์'
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-emerald-500"
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            คุณลักษณะอันพึงประสงค์
                        </button>
                        <button
                            onClick={() => setSelectedFormName('คุณลักษณะของนักเรียนขณะอยู่ที่โรงเรียน')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${
                                selectedFormName === 'คุณลักษณะของนักเรียนขณะอยู่ที่โรงเรียน'
                                    ? "bg-white text-teal-600 shadow-sm"
                                    : "text-slate-500 hover:text-teal-500"
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            คุณลักษณะของนักเรียน
                        </button>
                    </div>

                    {isLoadingAdvisor ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-24 w-full" />
                            ))}
                        </div>
                    ) : advisorTopics.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="font-bold text-lg">ยังไม่มีข้อมูลผลประเมิน</p>
                            <p className="text-sm">จาก: {advisorList.find((a: any) => a.user_id === selectedAdvisorUserId)?.name || "ครูที่ปรึกษา"}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                                <div className="lg:col-span-3 space-y-4">
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                        คะแนนประเมินรายหัวข้อ
                                    </h3>
                                    <div className="space-y-6">
                                        {(() => {
                                            const sectionNames = Array.from(new Set(advisorTopics.map((ev: any) => String(ev.section_name || 'ไม่ระบุตอน')))) as string[];
                                            const grouped = sectionNames.map(name => ({
                                                name,
                                                items: advisorTopics.filter((ev: any) => (ev.section_name || 'ไม่ระบุตอน') === name)
                                            }));

                                            return grouped.map((section, sIdx) => (
                                                <div key={sIdx} className="space-y-3">
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border-l-4 border-emerald-400">
                                                        <span className="text-sm md:text-base font-black text-emerald-600 uppercase tracking-wider">{section.name}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {section.items.map((ev: any, idx: number) => {
                                                            const score = Number(ev.score || 0);
                                                            const displayTopic = (ev.name || ev.topic).replace(/^[\d\.\s]+/, '');
                                                            return (
                                                                <div key={idx} className="flex justify-between items-baseline gap-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all px-2 rounded-lg">
                                                                    <span className="text-sm md:text-base font-normal text-slate-700 leading-relaxed flex-1 min-w-0">{displayTopic}</span>
                                                                    <span className={`flex-shrink-0 text-sm font-medium ${getScoreTextColor(score)}`}>
                                                                        {score.toFixed(2)} <span className="text-slate-300 font-normal">/ 5</span>
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                <div className="lg:col-span-2">
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 flex flex-col items-center justify-center text-center gap-4 shadow-sm h-fit">
                                        <div className="text-[14px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">คะแนนรวมเฉลี่ย</div>
                                        <div className={`text-6xl font-black tracking-tight ${currentAdvisorEval.average_score > 0 ? getScoreTextColor(currentAdvisorEval.average_score) : "text-slate-300"}`}>
                                            {currentAdvisorEval.average_score > 0 ? currentAdvisorEval.average_score.toFixed(2) : "—"}
                                        </div>
                                        <div className="flex gap-1 mt-2">
                                            {[1, 2, 3, 4, 5].map((star) => {
                                                const filled = currentAdvisorEval.average_score >= star;
                                                const half = !filled && currentAdvisorEval.average_score >= star - 0.5;
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
                                    </div>
                                </div>
                            </div>

                            {/* Feedback */}
                            {currentAdvisorEval.feedback && (
                                <div className="mt-8 pt-8 border-t border-slate-100">
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
                                        <div className="w-1 h-5 bg-teal-500 rounded-full" />
                                        ข้อเสนอแนะจากครูที่ปรึกษา
                                    </h3>
                                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
                                        <svg className="w-8 h-8 text-teal-100 absolute top-4 right-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                        </svg>
                                        <p className="text-slate-700 leading-relaxed text-sm relative z-10">{currentAdvisorEval.feedback}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
