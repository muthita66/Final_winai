"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { StudentApiService } from "@/services/student-api.service";
import {
    getAcademicSemesterDefault,
    getAcademicYearOptionsForStudent,
    getCurrentAcademicYearBE,
} from "@/features/student/academic-term";

type TopicRow = { type: 'section'; label: string } | { type: 'question'; name: string; idx: number };


interface AdvisorTeacherEvaluationFeatureProps {
    session: {
        class_level?: string | null;
        [key: string]: unknown;
    };
}

type AdvisorTeacher = {
    teacher_id: number;
    teacher_code?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    prefix?: string;
    year?: number | null;
    semester?: number | null;
};

type TemplateData = {
    teacher_id: number;
    topics: { id?: number; name: string }[];
    current: { name: string; score: number }[];
    feedback?: string;
    submitted_at?: string | null;
};

function ratingLabel(value: number) {
    if (value === 5) return "ดีมาก";
    if (value === 4) return "ดี";
    if (value === 3) return "ปานกลาง";
    if (value === 2) return "พอใช้";
    if (value === 1) return "ปรับปรุง";
    return "-";
}

export function AdvisorTeacherEvaluationFeature({ session }: AdvisorTeacherEvaluationFeatureProps) {
    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => Number(y.year_name));

    const selectedYearLookup = yearOptionsData.find((y: any) => Number(y.year_name) === Number(year));
    const semesterOptions = selectedYearLookup?.semesters || [];

    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());

    // Sync year state if data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);

    const [advisors, setAdvisors] = useState<AdvisorTeacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

    const [topics, setTopics] = useState<string[]>([]);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState("");
    const [submittedAt, setSubmittedAt] = useState<string | null>(null);

    const [isLoadingAdvisors, setIsLoadingAdvisors] = useState(true);
    const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectedAdvisor = useMemo(
        () => advisors.find((a) => Number(a.teacher_id) === Number(selectedTeacherId)) || null,
        [advisors, selectedTeacherId]
    );

    const loadAdvisors = async () => {
        setIsLoadingAdvisors(true);
        setErrorMessage(null);
        try {
            const result = await StudentApiService.getAdvisor(year, semester);
            const rows = Array.isArray(result?.advisors) ? result.advisors : [];
            setAdvisors(rows);

            const stillExists = rows.some((a: AdvisorTeacher) => Number(a.teacher_id) === Number(selectedTeacherId));
            if (!stillExists) {
                setSelectedTeacherId(rows.length ? Number(rows[0].teacher_id) : null);
            }
            if (rows.length === 0) {
                setSelectedTeacherId(null);
            }
        } catch (error: unknown) {
            console.error("Failed to load advisors", error);
            setAdvisors([]);
            setSelectedTeacherId(null);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดครูที่ปรึกษาได้");
        } finally {
            setIsLoadingAdvisors(false);
        }
    };

    const applyTemplate = (template: TemplateData | null) => {
        const topicNames = (template?.topics || [])
            .map((t) => String(t?.name || "").trim())
            .filter(Boolean);
        setTopics(topicNames);

        const currentMap = new Map<string, number>();
        (template?.current || []).forEach((item) => {
            const key = String(item?.name || "").trim();
            const value = Number(item?.score || 0);
            if (key && Number.isFinite(value) && value > 0) currentMap.set(key, value);
        });

        const initialScores: Record<string, number> = {};
        topicNames.forEach((name) => {
            initialScores[name] = currentMap.get(name) || 0;
        });
        setScores(initialScores);
        setFeedback(String(template?.feedback || ""));
        setSubmittedAt(template?.submitted_at || null);
    };

    const loadTemplate = async () => {
        if (!selectedTeacherId) {
            applyTemplate(null);
            return;
        }

        setIsLoadingTemplate(true);
        setErrorMessage(null);
        try {
            const template = await StudentApiService.getAdvisorTeacherEvaluationTemplate(
                selectedTeacherId,
                year,
                semester
            );
            applyTemplate(template);
        } catch (error: unknown) {
            console.error("Failed to load advisor teacher evaluation template", error);
            applyTemplate(null);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดแบบประเมินครูที่ปรึกษาได้");
        } finally {
            setIsLoadingTemplate(false);
        }
    };

    useEffect(() => {
        loadAdvisors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, semester]);

    useEffect(() => {
        loadTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeacherId, year, semester]);

    const handleScoreChange = (topic: string, value: number) => {
        setScores((prev) => ({ ...prev, [topic]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTeacherId) {
            toast.error("กรุณาเลือกครูที่ปรึกษา");
            return;
        }
        if (!topics.length) {
            toast.error("ไม่พบหัวข้อประเมิน");
            return;
        }

        const unanswered = topics.filter((t) => Number(scores[t] || 0) <= 0);
        if (unanswered.length > 0) {
            toast.error("กรุณากรอกข้อมูลให้ครบ");
            return;
        }

        setIsSubmitting(true);
        try {
            await StudentApiService.submitAdvisorTeacherEvaluation(
                selectedTeacherId,
                topics.map((t) => ({ name: t, score: Number(scores[t] || 0) })),
                year,
                semester,
                feedback
            );
            toast.success("ส่งประเมินครูที่ปรึกษาเรียบร้อยแล้ว");
            await loadTemplate();
        } catch (error: unknown) {
            console.error("Failed to submit advisor teacher evaluation", error);
            toast.error(error instanceof Error ? error.message : "ส่งแบบประเมินไม่สำเร็จ");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Build section-grouped table content
    const getSectionNum = (name: string) => {
        const m = name.match(/^(\d+)\./);
        return m ? parseInt(m[1]) : null;
    };
    const tableRows: TopicRow[] = [];
    let lastSection = -1;
    const sectionLabels: Record<number, string> = {};
    topics.forEach(name => {
        const sec = getSectionNum(name);
        if (sec !== null && !sectionLabels[sec]) sectionLabels[sec] = `ตอนที่ ${sec}`;
    });
    topics.forEach((name, idx) => {
        const sec = getSectionNum(name) ?? 0;
        if (sec !== lastSection) {
            tableRows.push({ type: 'section', label: sectionLabels[sec] || `ตอนที่ ${sec}` });
            lastSection = sec;
        }
        tableRows.push({ type: 'question', name, idx });
    });
    const scoreOptions = [5, 4, 3, 2, 1];
    const scoreHeaders = ['ดีมาก', 'ดี', 'ปานกลาง', 'พอใช้', 'ปรับปรุง'];
    const tableContent = (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm text-left">
                <thead className="text-sm text-slate-600 bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 font-bold w-1/2 min-w-[300px]">หัวข้อประเมิน</th>
                        {scoreHeaders.map((label, i) => (
                            <th key={i} className="px-3 py-4 font-medium text-center">
                                <div className="text-xs text-teal-700 font-bold">{scoreOptions[i]}</div>
                                <span className="text-sm font-semibold text-slate-700">{label}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tableRows.map((row, ri) => {
                        if (row.type === 'section') {
                            return (
                                <tr key={`sec-${ri}`} className="bg-teal-50 border-y border-teal-200">
                                    <td colSpan={6} className="px-6 py-3 font-bold text-teal-800 text-sm">
                                        {row.label}
                                    </td>
                                </tr>
                            );
                        }
                        const { name, idx } = row;
                        const value = Number(scores[name] || 0);
                        return (
                            <tr key={`q-${idx}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-700">
                                    {name.replace(/^[\d.]+\s*/, '')}
                                </td>
                                {scoreOptions.map((option) => (
                                    <td key={option} className="px-3 py-4 text-center">
                                        <label className="flex justify-center items-center w-full h-full cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`advisor-topic-${idx}`}
                                                value={option}
                                                checked={value === option}
                                                onChange={() => handleScoreChange(name, option)}
                                                className="w-5 h-5 text-teal-600 bg-slate-100 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                            />
                                        </label>
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-teal-600 to-emerald-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 -skew-x-12 translate-x-20" />
                <div className="relative z-10 flex flex-col md:flex-row md:justify-between gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3">
                            Advisor Evaluation
                        </div>
                        <h1 className="text-2xl font-bold mb-1">ประเมินครูที่ปรึกษา</h1>
                        <p className="text-emerald-100 text-sm">
                            ประเมินครูที่ปรึกษาของคุณ (เลือกได้เฉพาะครูที่ปรึกษาในห้องของตนเอง)
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[230px]">
                        <div className="text-emerald-100 text-xs font-medium mb-1.5">สถานะล่าสุด</div>
                        <div className="text-lg font-bold">
                            {submittedAt ? "ประเมินแล้ว" : "รอการประเมิน"}
                        </div>
                        <div className="text-[10px] text-emerald-100 mt-1.5">
                            {selectedAdvisor?.name || "ยังไม่ได้เลือกครูที่ปรึกษา"}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">เลือกปีการศึกษา ภาคเรียน และครูที่ปรึกษา</h3>
                        <p className="text-slate-500 text-sm">หน้าแรกสำหรับประเมินครูที่ปรึกษา 2 คน</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ปีการศึกษา</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50"
                        >
                            {yearOptions.map((y: any) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ภาคเรียน</label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(parseInt(e.target.value, 10))}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50"
                        >
                            {semesterOptions.length > 0 ? (
                                semesterOptions.map((s: any) => (
                                    <option key={s.semester_number} value={s.semester_number}>
                                        {s.semester_number}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                {isLoadingAdvisors ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        กำลังโหลดข้อมูลครูที่ปรึกษา...
                    </div>
                ) : advisors.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        ไม่พบครูที่ปรึกษาสำหรับห้องของคุณ
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {advisors.map((advisor, index) => {
                            const active = Number(selectedTeacherId) === Number(advisor.teacher_id);
                            return (
                                <button
                                    key={`${advisor.teacher_id}-${index}`}
                                    type="button"
                                    onClick={() => setSelectedTeacherId(Number(advisor.teacher_id))}
                                    className={`text-left p-4 rounded-2xl border transition-colors ${active
                                        ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100"
                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="text-xs text-slate-500 mb-1">ครูที่ปรึกษาคนที่ {index + 1}</div>
                                    <div className="font-semibold text-slate-800">{advisor.name || "-"}</div>
                                    <div className="text-sm text-slate-500 mt-1">{advisor.teacher_code || "-"}</div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
                    {errorMessage}
                </div>
            )}

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">แบบประเมินครูที่ปรึกษา</h3>
                        <p className="text-slate-500 text-sm">
                            {selectedAdvisor?.name ? `ผู้ถูกประเมิน: ${selectedAdvisor.name}` : "กรุณาเลือกครูที่ปรึกษา"}
                        </p>
                    </div>
                    {submittedAt && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ประเมินแล้ว
                        </span>
                    )}
                </div>

                {isLoadingTemplate ? (
                    <div className="text-center py-10 text-slate-500">กำลังโหลดแบบประเมิน...</div>
                ) : !selectedTeacherId ? (
                    <div className="text-center py-10 text-slate-500">เลือกครูที่ปรึกษาเพื่อเริ่มประเมิน</div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            {topics.length === 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500 text-sm">
                                    ยังไม่มีหัวข้อประเมิน
                                </div>
                            ) : tableContent}


                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={4}
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50"
                                placeholder="พิมพ์ข้อเสนอแนะถึงครูที่ปรึกษา..."
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedTeacherId || topics.length === 0}
                                className={`px-6 py-3 rounded-xl font-medium ${isSubmitting || !selectedTeacherId || topics.length === 0
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-teal-600 text-white hover:bg-teal-700"
                                    }`}
                            >
                                {isSubmitting ? "กำลังบันทึก..." : "ส่งประเมินครูที่ปรึกษา"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
