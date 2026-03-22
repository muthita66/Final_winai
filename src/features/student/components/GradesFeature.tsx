"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";
import { PrintButton } from "@/components/PrintButton";
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from "@/features/student/academic-term";

const GRADE_POINT_MAP: Record<string, number> = {
    A: 4,
    "B+": 3.5,
    B: 3,
    "C+": 2.5,
    C: 2,
    "D+": 1.5,
    D: 1,
    F: 0,
};

const NUMERIC_GRADE_TO_LETTER_MAP: Record<string, string> = {
    "4": "A",
    "3.5": "B+",
    "3": "B",
    "2.5": "C+",
    "2": "C",
    "1.5": "D+",
    "1": "D",
    "0": "F",
};

function normalizeGradeLabel(rawGrade: unknown): string | null {
    const raw = String(rawGrade ?? "").trim().toUpperCase();
    if (!raw) return null;
    if (raw in NUMERIC_GRADE_TO_LETTER_MAP) return NUMERIC_GRADE_TO_LETTER_MAP[raw];
    if (raw in GRADE_POINT_MAP) return raw;
    return null;
}

function getGradePointValue(row: any): number | null {
    const gp = Number(row?.grade_point);
    if (row?.grade_point != null && row?.grade_point !== "" && Number.isFinite(gp)) return gp;

    const label = normalizeGradeLabel(row?.grade);
    return label ? (GRADE_POINT_MAP[label] ?? null) : null;
}

function getCreditValue(row: any): number {
    const credit = Number(row?.credit);
    return Number.isFinite(credit) && credit > 0 ? credit : 0;
}

function isPassedGrade(row: any): boolean {
    const label = normalizeGradeLabel(row?.grade);
    return label !== null && label !== "F";
}

interface GradesFeatureProps {
    session: any;
}

export function GradesFeature({ session }: GradesFeatureProps) {
    const student = session;

    const contentRef = useRef<HTMLDivElement>(null);
    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => y.year_name);

    const [year, setYear] = useState(String(getCurrentAcademicYearBE()));
    const [semester, setSemester] = useState(String(getAcademicSemesterDefault()));
    const [hasManualTermSelection, setHasManualTermSelection] = useState(false);
    const [didAutoFallback, setDidAutoFallback] = useState(false);

    const selectedYearLookup = yearOptionsData.find((y: any) => String(y.year_name) === String(year));
    const semesterOptions = selectedYearLookup?.semesters || [];

    // Sync year state if data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);

    const yearNum = Number.parseInt(year, 10);
    const semesterNum = Number.parseInt(semester, 10);
    const hasValidTerm = Number.isFinite(yearNum) && yearNum > 0 && Number.isFinite(semesterNum) && semesterNum > 0;

    // Queries
    const allGradesQuery = useQuery({
        queryKey: ["student", "grades", "all"],
        queryFn: () => StudentApiService.getGrades(),
    });

    const termGradesQuery = useQuery({
        queryKey: ["student", "grades", "term", year, semester],
        queryFn: () => StudentApiService.getGrades(yearNum, semesterNum),
        enabled: hasValidTerm,
    });

    const advisorLatestQuery = useQuery({
        queryKey: ["student", "advisor", "latest"],
        queryFn: () => StudentApiService.getAdvisor(),
    });

    const isLoading = termGradesQuery.isLoading || allGradesQuery.isLoading || advisorLatestQuery.isLoading;
    const fetchError = (termGradesQuery.error as any)?.message || null;
    const grades = termGradesQuery.data || [];
    const allGrades = allGradesQuery.data || [];
    const latestAdviceData = advisorLatestQuery.data as any;
    const latestAdvisors = latestAdviceData?.advisors || (latestAdviceData?.advisor ? [latestAdviceData.advisor] : []);

    // Dynamic Options from DB
    const dynamicYearOptions = useMemo(() => {
        const years = new Set<string>();
        if (Array.isArray(allGrades)) {
            allGrades.forEach(g => {
                if (g.year) years.add(String(g.year));
            });
        }
        // Fallback to yearOptions if no data yet
        if (years.size === 0) return yearOptions.map(String);
        return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }, [allGrades, yearOptions]);

    const dynamicSemesterOptions = useMemo(() => {
        const semesters = new Set<number>();
        if (Array.isArray(allGrades)) {
            allGrades.forEach(g => {
                if (String(g.year) === year && g.semester) {
                    semesters.add(Number(g.semester));
                }
            });
        }
        // Fallback to lookup table if no grade data yet
        if (semesters.size === 0) {
            return semesterOptions.length > 0
                ? semesterOptions.map((s: any) => s.semester_number)
                : [1, 2];
        }
        return Array.from(semesters).sort((a, b) => a - b);
    }, [allGrades, year, semesterOptions]);

    // Derived State (Calculations)
    const { termCredit, gpa } = useMemo(() => {
        let termCredits = 0;
        let gpaCredits = 0;
        let points = 0;
        if (Array.isArray(grades)) {
            grades.forEach(r => {
                const credit = getCreditValue(r);
                termCredits += credit;
                const gp = getGradePointValue(r);
                if (gp !== null && credit > 0) {
                    gpaCredits += credit;
                    points += gp * credit;
                }
            });
        }
        return { termCredit: termCredits, gpa: gpaCredits > 0 ? (points / gpaCredits) : 0 };
    }, [grades]);

    const { totalCreditsAll, totalGpa } = useMemo(() => {
        let earnedCredits = 0;
        let gpaCredits = 0;
        let points = 0;
        if (Array.isArray(allGrades)) {
            allGrades.forEach(r => {
                const credit = getCreditValue(r);
                if (isPassedGrade(r)) {
                    earnedCredits += credit;
                }
                const gp = getGradePointValue(r);
                if (gp !== null && credit > 0) {
                    gpaCredits += credit;
                    points += gp * credit;
                }
            });
        }
        return { totalCreditsAll: earnedCredits, totalGpa: gpaCredits > 0 ? (points / gpaCredits) : 0 };
    }, [allGrades]);

    // Automatic Fallback Effect
    useEffect(() => {
        if (didAutoFallback || hasManualTermSelection) return;
        if (allGradesQuery.isLoading) return;

        // Primary source: actual enrollment history
        if (Array.isArray(allGrades) && allGrades.length > 0) {
            const years = allGrades.map(g => Number(g.year)).filter(Boolean);
            if (years.length > 0) {
                const latestYear = Math.max(...years);
                const semsForLatest = allGrades
                    .filter(g => Number(g.year) === latestYear)
                    .map(g => Number(g.semester))
                    .filter(Boolean);
                const latestSem = semsForLatest.length > 0 ? Math.max(...semsForLatest) : 1;

                const exists = allGrades.some(g => Number(g.year) === yearNum && Number(g.semester) === semesterNum);
                if (!exists) {
                    setDidAutoFallback(true);
                    setYear(String(latestYear));
                    setSemester(String(latestSem));
                    return;
                }
            }
        }

        // Secondary source: advisor data
        if (advisorLatestQuery.isLoading) return;
        if (grades.length === 0) {
            const latest = latestAdvisors[0];
            if (!latest?.year || !latest?.semester) return;

            const nextYear = String(latest.year);
            const nextSemester = String(latest.semester);

            if (nextYear === year && nextSemester === semester) return;

            setDidAutoFallback(true);
            setYear(nextYear);
            setSemester(nextSemester);
        }
    }, [
        didAutoFallback,
        hasManualTermSelection,
        allGradesQuery.isLoading,
        advisorLatestQuery.isLoading,
        allGrades,
        grades.length,
        latestAdvisors,
        year,
        semester,
        yearNum,
        semesterNum
    ]);

    const formatThaiDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", {
            year: "numeric", month: "long", day: "numeric"
        });
    };

    const getLevelRoomDisplay = (p: any) => {
        const classLevel = String(p?.class_level || "").trim();
        const room = String(p?.room || "").trim();

        let display = "-";
        if (!classLevel && !room) display = "-";
        else if (!room) display = classLevel || "-";
        else if (!classLevel) display = room;
        else if (room === classLevel || room.startsWith(`${classLevel}/`)) display = room;
        else display = `${classLevel}/${room}`;

        if (display === "-") return "-";
        return display.startsWith("ชั้น") ? display : `ชั้น${display}`;
    };

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Hero Section */}
            <section className="bg-gradient-to-r from-teal-700 to-emerald-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden print:bg-none print:text-black print:p-0 print:shadow-none print:border-b print:border-black print:rounded-none">
                <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20 print:hidden">
                            Transcript
                        </div>
                        <h1 className="text-2xl font-bold mb-1 print:text-2xl">ผลการเรียนสะสม</h1>
                        <p className="text-teal-100 text-sm max-w-xl print:hidden">
                            สรุปผลการเรียนรายวิชาและเกรดเฉลี่ยในแต่ละภาคเรียน
                        </p>
                    </div>

                    <PrintButton
                        contentRef={contentRef}
                        documentTitle={`Grades_${year}_${semester}`}
                        className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/30 px-5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 print:hidden"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5 relative z-10 max-w-xl print:grid-cols-2 print:mt-4 print:gap-2">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 print:border-none print:p-0 print:bg-transparent">
                        <div className="text-teal-200 text-xs mb-1 print:text-gray-500">ชื่อ - นามสกุล</div>
                        <div className="text-base font-bold truncate print:text-black">{student.name || "-"}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 print:border-none print:p-0 print:bg-transparent">
                        <div className="text-teal-200 text-xs mb-1 print:text-gray-500">เลขประจำตัว</div>
                        <div className="text-base font-bold print:text-black tracking-tight">{student.code || "-"}</div>
                    </div>

                    {/* Print-only visible details */}
                    <div className="hidden print:block print:border-none print:p-0">
                        <div className="text-gray-500 text-sm mb-1">ปีการศึกษา/ภาคเรียน</div>
                        <div className="text-lg font-bold text-black">{year}/{semester}</div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform skew-x-12 translate-x-20 print:hidden"></div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-teal-500 rounded-full blur-2xl opacity-50 print:hidden"></div>
            </section>

            {/* Filter Bar */}
            <section className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 md:items-center print:hidden">
                <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-medium text-sm">ปีการศึกษา</span>
                    <div className="relative flex-1 md:w-36">
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-full appearance-none cursor-pointer pr-8"
                            value={year} onChange={e => {
                                setHasManualTermSelection(true);
                                setYear(e.target.value);
                            }}
                        >
                            {yearOptions.map((y: any) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-medium text-sm">ภาคเรียน</span>
                    <div className="relative flex-1 md:w-28">
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-full appearance-none cursor-pointer pr-8"
                            value={semester} onChange={e => {
                                setHasManualTermSelection(true);
                                setSemester(e.target.value);
                            }}
                        >
                            {(semesterOptions.length > 0 ? semesterOptions : [{semester_number: 1}, {semester_number: 2}]).map((s: any) => (
                                <option key={s.semester_number} value={String(s.semester_number)}>{s.semester_number}</option>
                            ))}
                        </select>
                        <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </section>

            {/* Grades Table */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 print:mt-6">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">ตารางผลการเรียน</h3>
                    </div>
                </div>

                <div ref={contentRef} className="print:p-4">
                    <div className="hidden print:block mb-4 border-b-2 border-slate-800 pb-4">
                        <h1 className="text-xl font-bold text-center mb-4">ใบรายงานผลการเรียน</h1>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">นักเรียน:</span>
                                <span>{student.name || "-"}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">เลขประจำตัว:</span>
                                <span>{student.code || "-"}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">ระดับชั้น/ห้อง:</span>
                                <span>{getLevelRoomDisplay(student)}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">ปีการศึกษา:</span>
                                <span>{year}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">ครูที่ปรึกษา:</span>
                                <span>
                                    {latestAdvisors.length > 0
                                        ? latestAdvisors.map((a: any) => `${a.teacher_code || ""} ${a.first_name || ""} ${a.last_name || ""}`.trim()).join(", ")
                                        : "-"}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold shrink-0">ภาคเรียน:</span>
                                <span>{semester}</span>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 print:border-black">
                        <table className="w-full text-sm text-left print:text-black">
                            <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200 uppercase print:bg-gray-100 print:border-black">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-600 print:text-black">รหัสวิชา</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 print:text-black">ชื่อวิชา</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-center print:text-black">หน่วยกิต</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-center print:text-black">คะแนนรวม</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-center print:text-black">เกรด</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-center print:text-black">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                                {grades.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            ไม่พบข้อมูลผลการเรียนในภาคเรียนนี้
                                        </td>
                                    </tr>
                                ) : (
                                    grades.map((r: any, idx: number) => {
                                        const displayGrade = normalizeGradeLabel(r.grade);
                                        const hasGrade = displayGrade !== null;
                                        const isFailed = displayGrade === "F";
                                        const statusLabel = !hasGrade
                                            ? "รอผล"
                                            : (isFailed ? "ไม่ผ่าน" : "ผ่าน");
                                        const statusClass = !hasGrade
                                            ? "bg-amber-100 text-amber-700 print:bg-transparent print:text-black"
                                            : (isFailed
                                                ? "bg-red-100 text-red-700 print:bg-transparent print:text-black"
                                                : "bg-green-100 text-green-700 print:bg-transparent print:text-black");

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                                                <td className="px-6 py-3 print:px-4 print:py-2 font-medium text-slate-900">{r.subject_code || "-"}</td>
                                                <td className="px-6 py-3 print:px-4 print:py-2">{r.subject || "-"}</td>
                                                <td className="px-6 py-3 print:px-4 print:py-2 text-center">{r.credit || "-"}</td>
                                                <td className="px-6 py-3 print:px-4 print:py-2 text-center">{r.total ?? "-"}</td>
                                                <td className="px-6 py-3 print:px-4 print:py-2 text-center font-bold text-slate-800">{displayGrade ?? "-"}</td>
                                                <td className="px-6 py-3 print:px-4 print:py-2 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                                                        {statusLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden print:block mt-6 border-t-2 border-slate-800 pt-4">
                        <div className="flex justify-between items-center text-base font-bold text-slate-900 px-4">
                            <div className="flex gap-8">
                                <div>หน่วยกิตเทอมนี้: {termCredit.toFixed(1)}</div>
                                <div>หน่วยกิตสะสม: {totalCreditsAll.toFixed(1)}</div>
                            </div>
                            <div className="flex gap-8">
                                <div>GPA: {gpa.toFixed(2)}</div>
                                <div>GPAX: {totalGpa.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden print:grid grid-cols-2 mt-12 text-sm gap-12">
                        <div className="text-center">
                            <div className="mb-6">ลงชื่อ................................................</div>
                            <div className="font-bold">(ครูประจำชั้น)</div>
                        </div>
                        <div className="text-center">
                            <div className="mb-6">ลงชื่อ................................................</div>
                            <div className="font-bold">(ผู้ปกครอง)</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* GPA Summary Grid */}
            <section className="mt-6 print:mt-6">
                <div className="flex flex-col gap-1.5 mb-6 print:hidden">
                    <h3 className="text-lg font-bold text-slate-800">สรุปผลการศึกษา</h3>
                    <span className="w-fit px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">ภาพรวม</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border-t-4 border-teal-500 print:shadow-none print:border print:border-gray-300">
                        <div className="text-slate-500 text-xs font-medium mb-1">หน่วยกิตเทอมนี้</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-800">{termCredit.toFixed(1)}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border-t-4 border-teal-500 print:shadow-none print:border print:border-gray-300">
                        <div className="text-slate-500 text-xs font-medium mb-1">หน่วยกิตสะสม</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-800">{totalCreditsAll.toFixed(1)}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border-t-4 border-emerald-500 print:shadow-none print:border print:border-gray-300">
                        <div className="text-slate-500 text-xs font-medium mb-1">เกรดเฉลี่ย (GPA)</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-800">{gpa.toFixed(2)}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border-t-4 border-amber-500 print:shadow-none print:border print:border-gray-300">
                        <div className="text-slate-500 text-xs font-medium mb-1">สะสม (GPAX)</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-800">{totalGpa.toFixed(2)}</div>
                    </div>
                </div>
            </section>
        </div>
    );
}
