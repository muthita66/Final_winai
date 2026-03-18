"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";

const DEFAULT_THRESHOLDS = { a: 80, b_plus: 75, b: 70, c_plus: 65, c: 60, d_plus: 55, d: 50 };
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const txt = (v: any) => String(v ?? "").trim();
type SectionLike = {
    id?: number | string | null;
    class_level?: string | number | null;
    classroom?: string | number | null;
    year?: string | number | null;
    semester?: string | number | null;
    semesters?: {
        academic_years?: {
            year_name?: string | number | null;
        } | null;
    } | null;
    subjects?: {
        id?: number | string | null;
        subject_code?: string | number | null;
        name?: string | null;
    } | null;
} | null | undefined;

function getSubjectKey(section: SectionLike) {
    const subjectId = txt(section?.subjects?.id);
    if (subjectId) return `id:${subjectId}`;
    return `${txt(section?.subjects?.subject_code)}|${txt(section?.subjects?.name)}`;
}

function formatSubjectLabel(section: SectionLike) {
    const code = txt(section?.subjects?.subject_code);
    const name = txt(section?.subjects?.name);
    if (code && name) return `${code} ${name}`;
    return code || name || "-";
}

function getRoomKey(section: SectionLike) {
    return `${txt(section?.class_level)}|${txt(section?.classroom)}`;
}

function getAcademicYearValue(section: SectionLike) {
    return txt(section?.semesters?.academic_years?.year_name) || txt(section?.year);
}

function getYearKey(section: SectionLike) {
    return getAcademicYearValue(section);
}

function formatYearLabel(section: SectionLike) {
    return getAcademicYearValue(section) || "-";
}

function formatRoomLabel(section: SectionLike) {
    const level = txt(section?.class_level);
    const room = txt(section?.classroom);
    if (level && room && room.includes(level)) return room;
    if (level && room) return `${level}/${room}`;
    return room || level || "-";
}

function getTermKey(section: SectionLike) {
    return `${getAcademicYearValue(section)}|${txt(section?.semester)}`;
}

function formatTermLabel(section: SectionLike) {
    return `ปีการศึกษา ${getAcademicYearValue(section) || "-"} ภาคเรียน ${txt(section?.semester) || "-"}`;
}

const GRADE_ORDER = ["4", "3.5", "3", "2.5", "2", "1.5", "1", "0"] as const;
const GRADE_LABELS: Record<string, string> = { "4": "A", "3.5": "B+", "3": "B", "2.5": "C+", "2": "C", "1.5": "D+", "1": "D", "0": "F" };
const GRADE_COLORS: Record<string, string> = {
    "4": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "3.5": "bg-green-100 text-green-800 border-green-300",
    "3": "bg-teal-100 text-teal-800 border-teal-300",
    "2.5": "bg-blue-100 text-blue-800 border-blue-300",
    "2": "bg-sky-100 text-sky-800 border-sky-300",
    "1.5": "bg-amber-100 text-amber-800 border-amber-300",
    "1": "bg-orange-100 text-orange-800 border-orange-300",
    "0": "bg-rose-100 text-rose-800 border-rose-300",
};

const GRADE_ALIAS_TO_NUMERIC: Record<string, string> = {
    a: "4", "a+": "4", "4": "4", "4.0": "4",
    "b+": "3.5", "3.5": "3.5",
    b: "3", "3": "3", "3.0": "3",
    "c+": "2.5", "2.5": "2.5",
    c: "2", "2": "2", "2.0": "2",
    "d+": "1.5", "1.5": "1.5",
    d: "1", "1": "1", "1.0": "1",
    f: "0", "0": "0", "0.0": "0",
};

function normalizeGrade(grade: any) {
    const raw = txt(grade).toLowerCase();
    return GRADE_ALIAS_TO_NUMERIC[raw] || raw || "0";
}

function ThresholdInput({ label, gradeLabel, value, onChange, min = 0, max = 100, color }: {
    label: string; gradeLabel: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color: string;
}) {
    return (
        <div className="flex items-center justify-between py-1 px-3 rounded-xl border border-slate-50 hover:border-indigo-100 transition-colors">
            <div className="flex items-center gap-3">
                <span className={`inline-flex min-w-[4rem] items-center justify-center rounded-lg border px-2 py-1 text-xs font-bold ${color}`}>
                    {gradeLabel}
                </span>
                <span className="text-sm font-medium text-slate-500">คะแนนสะสมตั้งแต่</span>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="number" min={min} max={max} value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-16 rounded-xl border border-slate-200 px-2 py-1.5 text-center text-base font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
                />
            </div>
        </div>
    );
}

export function GradeCutFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sectionId = Number(searchParams.get("section_id"));
    const hasSection = Number.isFinite(sectionId) && sectionId > 0;

    /* ─── state ─── */
    const [sections, setSections] = useState<any[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);
    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headerCount, setHeaderCount] = useState(0);
    const [thresholds, setThresholds] = useState<any>(DEFAULT_THRESHOLDS);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingThresholds, setSavingThresholds] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
    const [selectedRoomKey, setSelectedRoomKey] = useState("");
    const [selectedYearKey, setSelectedYearKey] = useState("");
    const [selectedTermKey, setSelectedTermKey] = useState("");

    /* ─── loaders ─── */
    const loadSections = useCallback(async () => {
        setSectionsLoading(true);
        try {
            const data = await TeacherApiService.getTeacherSubjects(session.id);
            setSections(Array.isArray(data) ? data : []);
        } catch { setSections([]); }
        finally { setSectionsLoading(false); }
    }, [session.id]);

    useEffect(() => { loadSections(); }, [loadSections]);

    useEffect(() => {
        if (!hasSection) { setLoading(false); setSummary([]); return; }
        const found = sections.find((s) => s.id === sectionId) || null;
        setSectionInfo(found);
        (async () => {
            setLoading(true);
            try {
                const [headers, thresholdData, summaryRows] = await Promise.all([
                    TeacherApiService.getScoreHeaders(sectionId),
                    TeacherApiService.getGradeThresholds(sectionId),
                    TeacherApiService.getGradeSummary(sectionId),
                ]);
                setHeaderCount(Array.isArray(headers) ? headers.length : 0);
                setThresholds(thresholdData ? { ...DEFAULT_THRESHOLDS, ...thresholdData } : DEFAULT_THRESHOLDS);
                setSummary(Array.isArray(summaryRows) ? summaryRows : []);
            } catch { setSummary([]); }
            finally { setLoading(false); }
        })();
    }, [hasSection, sectionId, sections]);

    useEffect(() => {
        if (!hasSection) return;
        const found = sections.find((s) => s.id === sectionId);
        if (!found) return;
        setSelectedSubjectKey(getSubjectKey(found));
        setSelectedRoomKey(getRoomKey(found));
        setSelectedYearKey(getYearKey(found));
        setSelectedTermKey(getTermKey(found));
    }, [hasSection, sectionId, sections]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || !selectedTermKey) return;
        const matched = sections.find(
            (s) =>
                getSubjectKey(s) === selectedSubjectKey &&
                getRoomKey(s) === selectedRoomKey &&
                getYearKey(s) === selectedYearKey &&
                getTermKey(s) === selectedTermKey
        );
        const nextId = Number(matched?.id);
        if (!Number.isFinite(nextId) || nextId <= 0 || nextId === sectionId) return;
        router.push(`/teacher/grade_cut?section_id=${nextId}`);
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey, sections, sectionId, router]);

    /* ─── derived ─── */
    const thresholdValid =
        num(thresholds.a) >= num(thresholds.b_plus) &&
        num(thresholds.b_plus) >= num(thresholds.b) &&
        num(thresholds.b) >= num(thresholds.c_plus) &&
        num(thresholds.c_plus) >= num(thresholds.c) &&
        num(thresholds.c) >= num(thresholds.d_plus) &&
        num(thresholds.d_plus) >= num(thresholds.d);

    const stats = useMemo(() => {
        const count = summary.length;
        const avgPct = count ? Math.round((summary.reduce((s, r) => s + num(r.percentage), 0) / count) * 100) / 100 : 0;
        const passCount = summary.filter((r) => num(r.percentage) >= num(thresholds.d)).length;
        const maxPossible = count ? num(summary[0]?.max_possible) : 0;
        const distribution = summary.reduce<Record<string, number>>((acc, r) => {
            const k = normalizeGrade(r.grade);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
        return { count, avgPct, passCount, maxPossible, distribution };
    }, [summary, thresholds.d]);

    const filteredSummary = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return summary;
        return summary.filter((r) =>
            [r.student_code, r.first_name, r.last_name].some((v) => txt(v).toLowerCase().includes(q))
        );
    }, [summary, studentSearch]);

    const subjectOptions = useMemo(() => {
        const map = new Map<string, string>();
        sections.forEach((s) => {
            const key = getSubjectKey(s);
            if (!key) return;
            if (!map.has(key)) map.set(key, formatSubjectLabel(s));
        });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "th"));
    }, [sections]);

    const roomOptions = useMemo(() => {
        if (!selectedSubjectKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey)
            .forEach((s) => {
                const key = getRoomKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatRoomLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                const [aG = "999", aR = "999"] = a.label.split("/");
                const [bG = "999", bR = "999"] = b.label.split("/");
                const gDiff = Number(aG) - Number(bG);
                if (gDiff !== 0) return gDiff;
                return Number(aR) - Number(bR);
            });
    }, [sections, selectedSubjectKey]);

    const yearOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey)
            .forEach((s) => {
                const key = getYearKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatYearLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => Number(b.value) - Number(a.value));
    }, [sections, selectedSubjectKey, selectedRoomKey]);

    const semesterOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey)
            .forEach((s) => {
                const sem = txt(s?.semester);
                if (!sem) return;
                if (!map.has(sem)) map.set(sem, `ภาคเรียนที่ ${sem}`);
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => Number(a.value) - Number(b.value));
    }, [sections, selectedSubjectKey, selectedRoomKey, selectedYearKey]);

    const termOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey)
            .forEach((s) => {
                const key = getTermKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatTermLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                const [aYear = "0", aSem = "0"] = a.value.split("|");
                const [bYear = "0", bSem = "0"] = b.value.split("|");
                const yearDiff = Number(bYear) - Number(aYear);
                if (yearDiff !== 0) return yearDiff;
                return Number(bSem) - Number(aSem);
            });
    }, [sections, selectedSubjectKey, selectedRoomKey, selectedYearKey]);

    const selectedSubjectLabel = subjectOptions.find((o) => o.value === selectedSubjectKey)?.label || "-";
    const selectedRoomLabel = roomOptions.find((o) => o.value === selectedRoomKey)?.label || "-";
    const selectedYearLabel = yearOptions.find((o) => o.value === selectedYearKey)?.label || "-";
    const selectedTermLabel = termOptions.find((o) => o.value === selectedTermKey)?.label || "-";
    const selectionReady = !!(selectedSubjectKey && selectedRoomKey && selectedYearKey && selectedTermKey);

    useEffect(() => {
        if (!selectedSubjectKey || selectedRoomKey || roomOptions.length !== 1) return;
        setSelectedRoomKey(roomOptions[0].value);
    }, [selectedSubjectKey, selectedRoomKey, roomOptions]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || selectedYearKey || yearOptions.length === 0) return;
        setSelectedYearKey(yearOptions[0].value);
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, yearOptions]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || selectedTermKey || semesterOptions.length === 0) return;
        const firstSem = semesterOptions[0].value;
        const matched = sections.find(
            (s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey && txt(s?.semester) === firstSem
        );
        if (matched) setSelectedTermKey(getTermKey(matched));
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey, semesterOptions, sections]);

    /* ─── handlers ─── */
    const handleSubjectSelect = (value: string) => {
        setSelectedSubjectKey(value);
        setSelectedRoomKey("");
        setSelectedYearKey("");
        setSelectedTermKey("");
    };

    const handleRoomSelect = (value: string) => {
        setSelectedRoomKey(value);
        setSelectedYearKey("");
        setSelectedTermKey("");
    };

    const handleYearSelect = (value: string) => {
        setSelectedYearKey(value);
        setSelectedTermKey("");
    };

    const handleSemesterSelect = (value: string) => {
        const matched = sections.find(
            (s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey && txt(s?.semester) === value
        );
        setSelectedTermKey(matched ? getTermKey(matched) : "");
    };

    const handleSaveAndCalculate = async () => {
        if (!thresholdValid) return alert("ลำดับเกณฑ์ไม่ถูกต้อง (A ≥ B+ ≥ B ≥ ... ≥ D)");
        if (headerCount === 0) return alert("ยังไม่มีหัวข้อคะแนน กรุณาบันทึกคะแนนก่อน");

        setSavingThresholds(true);
        setCalculating(true);
        try {
            await TeacherApiService.saveGradeThresholds(sectionId, thresholds);
            await TeacherApiService.calculateGrades(sectionId);
            const rows = await TeacherApiService.getGradeSummary(sectionId);
            setSummary(Array.isArray(rows) ? rows : []);
            alert("บันทึกเกณฑ์และคำนวณเกรดเรียบร้อย ✓");
        } catch { alert("ดำเนินการไม่สำเร็จ"); }
        finally { setSavingThresholds(false); setCalculating(false); }
    };

    /* ─── render ─── */
    return (
        <div className="space-y-4">
            {/* ── Top Bar ── */}
            <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Link href="/teacher/scores" className="inline-flex items-center gap-1.5 text-indigo-100 hover:text-white mb-2 transition-colors text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            กลับหน้าหลัก
                        </Link>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                            ตัดเกรด
                        </h1>
                        {sectionInfo && (
                            <div className="mt-2 space-y-0.5 text-sm opacity-90">
                                <div className="font-semibold">{sectionInfo.subjects?.subject_code} {sectionInfo.subjects?.name}</div>
                                <div className="text-indigo-100/80">
                                    ชั้น{formatRoomLabel(sectionInfo)}
                                </div>
                                <div className="text-indigo-100/70 text-xs">
                                    {formatTermLabel(sectionInfo)}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="w-full lg:flex-1">
                        <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-4 flex items-end gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-indigo-100/90">วิชา</span>
                                    <select
                                        value={selectedSubjectKey}
                                        onChange={(e) => handleSubjectSelect(e.target.value)}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none [&>option]:text-slate-800"
                                    >
                                        <option value="">เลือกวิชา...</option>
                                        {subjectOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-indigo-100/90">ห้อง</span>
                                    <select
                                        value={selectedRoomKey}
                                        onChange={(e) => handleRoomSelect(e.target.value)}
                                        disabled={!selectedSubjectKey}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none [&>option]:text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{selectedSubjectKey ? "เลือกห้อง..." : "เลือกวิชาก่อน"}</option>
                                        {roomOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-indigo-100/90">ปีการศึกษา</span>
                                    <select
                                        value={selectedYearKey}
                                        onChange={(e) => handleYearSelect(e.target.value)}
                                        disabled={!selectedSubjectKey || !selectedRoomKey}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none [&>option]:text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{selectedRoomKey ? "เลือกปีการศึกษา..." : "เลือกห้องก่อน"}</option>
                                        {yearOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-indigo-100/90">ภาคเรียน</span>
                                    <select
                                        value={selectedTermKey ? txt(sections.find(s => getTermKey(s) === selectedTermKey)?.semester) : ""}
                                        onChange={(e) => handleSemesterSelect(e.target.value)}
                                        disabled={!selectedSubjectKey || !selectedRoomKey || !selectedYearKey}
                                        className="w-full rounded-xl bg-white/20 border border-white/30 text-white px-3 py-2 text-sm outline-none [&>option]:text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{selectedYearKey ? "เลือกภาคเรียน..." : "เลือกปีก่อน"}</option>
                                        {semesterOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <Link href={`/teacher/score_input${hasSection ? `?section_id=${sectionId}` : ""}`}
                                className="shrink-0 rounded-xl bg-white/25 border border-white/40 px-3 py-2 text-sm font-bold text-center hover:bg-white/35 transition-colors whitespace-nowrap shadow-sm">
                                ไปหน้าบันทึกคะแนน
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {!hasSection ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mb-4 flex justify-center">
                        <svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M12 14l9-5-9-5-9 5 9 5z" />
                            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700">เลือกวิชา ห้อง และปีการศึกษา เพื่อเริ่มตัดเกรด</h2>
                    <p className="mt-2 text-slate-500">ระบบจะเลือกเทอมล่าสุดให้อัตโนมัติภายใต้ปีการศึกษาที่เลือก</p>
                </section>
            ) : loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ── KPI Row ── */}
                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs text-slate-500">นักเรียน</div>
                            <div className="mt-1 text-2xl font-bold text-slate-800">{stats.count}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs text-slate-500">ค่าเฉลี่ย</div>
                            <div className="mt-1 text-2xl font-bold text-slate-800">{stats.avgPct}%</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs text-slate-500">ผ่านเกณฑ์ (D ขึ้นไป)</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.passCount}<span className="text-sm text-slate-400 font-normal">/{stats.count}</span></div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs text-slate-500">เต็มรวม / หัวข้อ</div>
                            <div className="mt-1 text-2xl font-bold text-slate-800">{stats.maxPossible} <span className="text-sm text-slate-400 font-normal">({headerCount})</span></div>
                        </div>
                    </section>

                    {/* ── Threshold + Distribution ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* Threshold sliders */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-slate-700">กำหนดเกณฑ์คะแนน (เกรดขั้นต่ำ)</h2>
                                <button onClick={() => setThresholds(DEFAULT_THRESHOLDS)} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">Reset</button>
                            </div>

                            {!thresholdValid && (
                                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    ลำดับเกณฑ์ไม่ถูกต้อง (A ≥ B+ ≥ B ≥ ... ≥ D)
                                </div>
                            )}

                            <div className="space-y-1.5">
                                {([
                                    ["a", "A (4.0)", GRADE_COLORS["4"]],
                                    ["b_plus", "B+ (3.5)", GRADE_COLORS["3.5"]],
                                    ["b", "B (3.0)", GRADE_COLORS["3"]],
                                    ["c_plus", "C+ (2.5)", GRADE_COLORS["2.5"]],
                                    ["c", "C (2.0)", GRADE_COLORS["2"]],
                                    ["d_plus", "D+ (1.5)", GRADE_COLORS["1.5"]],
                                    ["d", "D (1.0)", GRADE_COLORS["1"]],
                                ] as [string, string, string][]).map(([key, label, color]) => (
                                    <ThresholdInput
                                        key={key}
                                        label={key}
                                        gradeLabel={label}
                                        value={num(thresholds[key])}
                                        onChange={(v) => setThresholds({ ...thresholds, [key]: v })}
                                        color={color}
                                    />
                                ))}
                            </div>

                            <div className="mt-5 flex gap-2">
                                <button
                                    onClick={handleSaveAndCalculate}
                                    disabled={savingThresholds || calculating || !thresholdValid || headerCount === 0}
                                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 shadow-sm"
                                >
                                    {calculating || savingThresholds ? "กำลังดำเนินการ..." : "บันทึกเกณฑ์คะแนนและตัดเกรด"}
                                </button>
                            </div>
                            {headerCount === 0 && (
                                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    ยังไม่มีหัวข้อคะแนน กรุณาบันทึกคะแนนก่อน
                                </p>
                            )}
                        </section>

                        {/* Grade distribution */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-700 mb-4">การกระจายเกรด</h2>
                            {summary.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
                                    ยังไม่มีข้อมูล — กดปุ่ม "คำนวณเกรด" เพื่อเริ่มต้น
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {GRADE_ORDER.map((grade) => {
                                        const count = stats.distribution[grade] || 0;
                                        const pct = stats.count ? (count / stats.count) * 100 : 0;
                                        return (
                                            <div key={grade} className="flex items-center gap-3">
                                                <span className={`inline-flex w-12 items-center justify-center rounded-lg border px-2 py-1 text-xs font-bold ${GRADE_COLORS[grade] || ""}`}>
                                                    {GRADE_LABELS[grade] || grade}
                                                </span>
                                                <div className="flex-1 h-6 rounded-full bg-slate-100 overflow-hidden relative">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                    {count > 0 && (
                                                        <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-700">
                                                            {count} คน ({Math.round(pct)}%)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ── Student Table (always visible) ── */}
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                            <h2 className="font-bold text-slate-700 text-sm">รายชื่อนักเรียนและเกรด</h2>
                            <div className="relative">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    placeholder="ค้นหานักเรียน..."
                                    className="w-48 rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                        </div>

                        {summary.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">
                                ยังไม่มีข้อมูล — กดคำนวณเกรดก่อน
                            </div>
                        ) : filteredSummary.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">ไม่พบนักเรียนตามการค้นหา</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-12">#</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">เลขประจำตัวนักเรียน</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">ชื่อ-นามสกุล</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">คะแนนรวม</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">%</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">เกรด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary.map((s, i) => {
                                            const displayGrade = normalizeGrade(s.grade);
                                            return (
                                                <tr key={`${s.student_id}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                    <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                                                    <td className="px-4 py-2 text-sm font-mono text-slate-600">{s.student_code}</td>
                                                    <td className="px-4 py-2 text-sm text-slate-800">{s.first_name} {s.last_name}</td>
                                                    <td className="px-4 py-2 text-center text-sm text-slate-700">{num(s.total_score)}<span className="text-slate-400">/{num(s.max_possible)}</span></td>
                                                    <td className="px-4 py-2 text-center text-sm text-slate-700">{num(s.percentage)}%</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${GRADE_COLORS[displayGrade] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                            {GRADE_LABELS[displayGrade] || displayGrade} ({displayGrade})
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

