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

    const advisorEvaluationQuery = useQuery({
        queryKey: ["student", "evaluation", "advisor", year, semester],
        queryFn: () => StudentApiService.getAdvisorEvaluation(year, semester),
    });

    const registeredSubjects = Array.isArray(registeredQuery.data) ? registeredQuery.data : [];
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

    const advisorEvaluations = Array.isArray(advisorEvaluationQuery.data) ? advisorEvaluationQuery.data : [];
    const subjectEvaluations = Array.isArray(subjectEvaluationQuery.data) ? subjectEvaluationQuery.data : [];


    const isLoadingInit = registeredQuery.isLoading;
    const isLoadingAdvisor = advisorEvaluationQuery.isLoading;
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
                <section className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
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
            <section className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                            Learning Result
                        </div>
                        <h1 className="text-2xl font-bold mb-1">ผลประเมินสมรรถนะผู้เรียน</h1>
                        <p className="text-indigo-100 text-sm">
                            สรุประดับสมรรถนะรายด้านและข้อเสนอแนะ
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[200px]">
                        <div className="text-indigo-100 text-xs font-medium mb-1.5">สถานะ</div>
                        <div className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            พร้อมดูผล
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </section>

            {!hideResultTabs && (
                <section className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                    <div className="inline-flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveResultTab("subject")}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeResultTab === "subject"
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                        >
                            ผลประเมินรายวิชา
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveResultTab("advisor")}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeResultTab === "advisor"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                        >
                            ผลประเมินโดยรวม (ครูที่ปรึกษา)
                        </button>
                    </div>
                </section>
            )}

            {/* Selection Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
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
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 appearance-none"
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
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            {dynamicSemesterOptions.map((s: any) => (
                                <option key={s} value={String(s)}>{s}</option>
                            ))}
                        </select>
                    </div>
                    {!advisorOnlyMode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">รายวิชา</label>
                            <select
                                value={selectedSectionId}
                                onChange={handleSubjectChange}
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 appearance-none"
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
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
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
                        <div className="space-y-4">
                            {subjectEvaluations.map((ev, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white">
                                    <div className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        {ev.topic || ev.name}
                                    </div>
                                    {renderProgressBar(ev.score)}
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

                    {isLoadingAdvisor ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-24 w-full" />
                            ))}
                        </div>
                    ) : advisorEvaluations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                            ยังไม่มีข้อมูลผลประเมิน
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {advisorEvaluations.map((ev, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white">
                                    <div className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        {ev.name || ev.topic}
                                    </div>
                                    {renderProgressBar(ev.score)}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
