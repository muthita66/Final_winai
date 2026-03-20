"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";

const DEFAULT_THRESHOLDS: any = { a: 80, b_plus: 75, b: 70, c_plus: 65, c: 60, d_plus: 55, d: 50, is_custom: false };
const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

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
const GRADE_LABELS: Record<string, string> = { "4": "A", "3.5": "B+", "3": "B", "2.5": "C+", "2": "C", "1.5": "D+", "1": "D", "0": "F", "ผ": "Pass", "มผ": "Fail" };
const GRADE_COLORS: Record<string, string> = {
    "4": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "3.5": "bg-green-100 text-green-800 border-green-300",
    "3": "bg-teal-100 text-teal-800 border-teal-300",
    "2.5": "bg-teal-100 text-teal-800 border-teal-300",
    "2": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "1.5": "bg-teal-50 text-teal-700 border-teal-200",
    "1": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "0": "bg-rose-100 text-rose-800 border-rose-300",
    "ผ": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "มผ": "bg-rose-100 text-rose-800 border-rose-300",
};

const GRADE_BAR_COLORS: Record<string, string> = {
    "4": "from-emerald-400 to-emerald-500",
    "3.5": "from-green-400 to-green-500",
    "3": "from-teal-400 to-teal-500",
    "2.5": "from-teal-400 to-teal-500",
    "2": "from-emerald-400 to-emerald-500",
    "1.5": "from-teal-300 to-teal-400",
    "1": "from-emerald-300 to-emerald-400",
    "0": "from-rose-400 to-rose-500",
    "ผ": "from-emerald-400 to-emerald-500",
    "มผ": "from-rose-400 to-rose-500",
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

export function GradeCutFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sectionId = Number(searchParams.get("section_id"));
    const hasSection = Number.isFinite(sectionId) && sectionId > 0;

    /* ─── state ─── */
    const [sections, setSections] = useState<any[]>([]);
    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headerCount, setHeaderCount] = useState(0);
    const [thresholds, setThresholds] = useState<any>(DEFAULT_THRESHOLDS);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingThresholds, setSavingThresholds] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [groupOptions, setGroupOptions] = useState<any[]>([]);
    const [selectingGroup, setSelectingGroup] = useState(false);

    const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
    const [selectedRoomKey, setSelectedRoomKey] = useState("");
    const [selectedYearKey, setSelectedYearKey] = useState("");
    const [selectedTermKey, setSelectedTermKey] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const data = await TeacherApiService.getTeacherSubjects(session.id);
                setSections(Array.isArray(data) ? data : []);
            } catch { setSections([]); }
        })();
    }, [session.id]);

    useEffect(() => {
        if (!hasSection || sections.length === 0) return;
        const s = sections.find(x => x.id === sectionId);
        if (s) {
            setSelectedSubjectKey(getSubjectKey(s));
            setSelectedRoomKey(getRoomKey(s));
            setSelectedYearKey(getYearKey(s));
            setSelectedTermKey(getTermKey(s));
        }
    }, [hasSection, sectionId, sections]);

    useEffect(() => {
        if (!hasSection) { setLoading(false); setSummary([]); setSectionInfo(null); return; }

        (async () => {
            setLoading(true);
            try {
                if (!sectionInfo) {
                    const found = sections.find((s: any) => s.id === sectionId) || null;
                    setSectionInfo(found);
                }

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
    }, [hasSection, sectionId, session.id, sections, sectionInfo]);

    const handleThresholdChange = (key: keyof typeof DEFAULT_THRESHOLDS, val: string) => {
        const n = Number(val);
        setThresholds((prev: any) => ({ ...prev, [key]: n }));
    };

    // Removed handleSelectGroup function

    /* ─── derived ─── */
    const stats = useMemo(() => {
        const count = summary.length;
        const isPF = summary.some(r => r.is_pf);
        const avgPct = count ? Math.round((summary.reduce((s, r) => s + num(r.percentage), 0) / count) * 100) / 100 : 0;
        const passCount = summary.filter((r) => {
            if (isPF) return r.grade === "ผ";
            return num(r.percentage) >= num(thresholds.d);
        }).length;
        const maxPossible = count ? num(summary[0]?.max_possible) : 0;
        const distribution = summary.reduce<Record<string, number>>((acc, r) => {
            const k = r.is_pf ? r.grade : normalizeGrade(r.grade);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
        return { count, avgPct, passCount, maxPossible, distribution, isPF };
    }, [summary, thresholds.d]);

    const filteredSummary = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return summary;
        return summary.filter((r) =>
            [r.student_code, r.first_name, r.last_name].some((v) => txt(v).toLowerCase().includes(q))
        );
    }, [summary, studentSearch]);

    const isModified = useMemo(() => {
        return (["a", "b_plus", "b", "c_plus", "c", "d_plus", "d"] as const).some(
            key => thresholds[key] !== DEFAULT_THRESHOLDS[key as keyof typeof DEFAULT_THRESHOLDS]
        ) || thresholds.is_custom;
    }, [thresholds]);

    /* ─── selection logic ─── */

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

    const handleSubjectSelect = (val: string) => { setSelectedSubjectKey(val); setSelectedRoomKey(""); setSelectedYearKey(""); setSelectedTermKey(""); };
    const handleRoomSelect = (val: string) => { setSelectedRoomKey(val); setSelectedYearKey(""); setSelectedTermKey(""); };
    const handleYearSelect = (val: string) => {
        setSelectedYearKey(val);
        setSelectedTermKey("");
        // Auto-select the latest term if possible
        if (!val) return;
        const availableTerms = sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === val)
            .map((s) => getTermKey(s))
            .filter(Boolean);
        
        if (availableTerms.length > 0) {
            const latestTerm = availableTerms.sort((a, b) => {
                const [, aSem = "0"] = a.split("|");
                const [, bSem = "0"] = b.split("|");
                return Number(bSem) - Number(aSem);
            })[0];
            handleSemesterSelect(latestTerm);
        }
    };
    const handleSemesterSelect = (val: string) => {
        if (!val) { setSelectedTermKey(""); return; }
        setSelectedTermKey(val);
        
        // Find section immediately and navigate
        const targetSection = sections.find((s) => 
            getSubjectKey(s) === selectedSubjectKey &&
            getRoomKey(s) === selectedRoomKey &&
            getTermKey(s) === val
        );
        
        if (targetSection?.id) {
            router.push(`/teacher/grade_cut?section_id=${targetSection.id}`);
        } else {
            console.warn("Could not find section for selected filters", { selectedSubjectKey, selectedRoomKey, val });
        }
    };


    /* ─── handlers ─── */

    const handleSaveAndCalculate = async () => {
        if (headerCount === 0) return alert("ยังไม่มีหัวข้อคะแนน กรุณาบันทึกคะแนนก่อน");

        setSavingThresholds(true);
        setCalculating(true);
        try {
            await TeacherApiService.saveGradeThresholds(sectionId, thresholds);
            await TeacherApiService.calculateGrades(sectionId);
            const rows = await TeacherApiService.getGradeSummary(sectionId);
            setSummary(Array.isArray(rows) ? rows : []);
            // refresh thresholds to get is_custom flag
            const tData = await TeacherApiService.getGradeThresholds(sectionId);
            setThresholds(tData ? { ...DEFAULT_THRESHOLDS, ...tData } : DEFAULT_THRESHOLDS);
            alert("บันทึกเกณฑ์และคำนวณเกรดเรียบร้อย ✓");
        } catch { alert("ดำเนินการไม่สำเร็จ"); }
        finally { setSavingThresholds(false); setCalculating(false); }
    };

    const handleResetThresholds = async () => {
        if (!confirm("คุณต้องการคืนค่าเกณฑ์คะแนนเริ่มต้นใช่หรือไม่?")) return;
        
        try {
            if (thresholds.is_custom) {
                setSavingThresholds(true);
                await TeacherApiService.resetGradeThresholds(sectionId);
                const [tData, rows] = await Promise.all([
                    TeacherApiService.getGradeThresholds(sectionId),
                    TeacherApiService.getGradeSummary(sectionId),
                ]);
                setThresholds(tData ? { ...DEFAULT_THRESHOLDS, ...tData } : DEFAULT_THRESHOLDS);
                setSummary(Array.isArray(rows) ? rows : []);
                alert("ระบบคืนค่าเกณฑ์มาตรฐานเรียบร้อยแล้ว ✓");
            } else {
                setThresholds({ ...DEFAULT_THRESHOLDS, is_custom: false });
            }
        } catch (err) {
            console.error("Reset failed", err);
            alert("ไม่สามารถคืนค่าได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setSavingThresholds(false);
        }
    };

    /* ─── render ─── */
    return (
        <div className="space-y-4">
            {/* ── Top Bar ── */}
            <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Link href="/teacher/scores" className="inline-flex items-center gap-1.5 text-emerald-100 hover:text-white mb-2 transition-colors text-sm font-medium">
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
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                        <svg className="w-5 h-5 text-emerald-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">วิชาที่สอน</div>
                                        <div className="text-sm font-bold leading-tight truncate">{sectionInfo.subjects?.subject_code} {sectionInfo.subjects?.name}</div>
                                    </div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                    <div className="w-10 h-10 rounded-lg bg-teal-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                        <svg className="w-5 h-5 text-teal-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-teal-200">ห้องเรียน</div>
                                        <div className="text-sm font-bold leading-tight">ชั้น{formatRoomLabel(sectionInfo)}</div>
                                    </div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                        <svg className="w-5 h-5 text-emerald-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">ปีการศึกษา/ภาคเรียน</div>
                                        <div className="text-sm font-bold leading-tight">{formatTermLabel(sectionInfo)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="w-full lg:flex-1 flex justify-end items-end">
                        <Link href={`/teacher/score_input${hasSection ? `?section_id=${sectionId}` : ""}`}
                            className="rounded-xl bg-white/25 border border-white/40 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/35 transition-all shadow-sm active:scale-95">
                            ไปหน้าบันทึกคะแนน
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Selection Box (Premium Design) ── */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 transition-all mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <div className="p-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลสำหรับการตัดเกรด</h2>
                                <p className="text-xs font-medium text-slate-400">เลือกวิชาและห้องเรียนที่ต้องการคำนวณเกรด</p>
                            </div>
                        </div>
                        {!hasSection && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 animate-pulse">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">กรุณาเลือกข้อมูลให้ครบ</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Subject */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                วิชาที่สอน
                            </label>
                            <div className="relative group">
                                <select
                                    value={selectedSubjectKey}
                                    onChange={(e) => handleSubjectSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกวิชา...</option>
                                    {subjectOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Room */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                ห้องเรียน
                            </label>
                            <div className="relative group">
                                <select
                                    disabled={!selectedSubjectKey}
                                    value={selectedRoomKey}
                                    onChange={(e) => handleRoomSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกห้อง...</option>
                                    {roomOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                ปีการศึกษา
                            </label>
                            <div className="relative group">
                                <select
                                    disabled={!selectedRoomKey}
                                    value={selectedYearKey}
                                    onChange={(e) => handleYearSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกปีการศึกษา...</option>
                                    {yearOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Semester */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                ภาคเรียน
                            </label>
                            <div className="relative group">
                                <select
                                    value={selectedTermKey}
                                    onChange={(e) => handleSemesterSelect(e.target.value)}
                                    disabled={!selectedYearKey}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">{selectedYearKey ? "เลือกภาคเรียน..." : "เลือกปีก่อน"}</option>
                                    {semesterOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {!hasSection ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mb-4 flex justify-center">
                        <svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700">เลือกวิชา ห้อง และปีการศึกษา เพื่อเริ่มตัดเกรด</h2>
                    <p className="mt-2 text-slate-500">ระบบจะเลือกเทอมล่าสุดให้อัตโนมัติภายใต้ปีการศึกษาที่เลือก</p>
                </section>
            ) : loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
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
                            <div className="text-xs text-slate-500">{stats.isPF ? "ผ่าน (ผ)" : "ผ่านเกณฑ์ (D ขึ้นไป)"}</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.passCount}<span className="text-sm text-slate-400 font-normal">/{stats.count}</span></div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs text-slate-500">{stats.isPF ? "ชิ้นงานรวม" : "เต็มรวม / หัวข้อ"}</div>
                            <div className="mt-1 text-2xl font-bold text-slate-800">{stats.maxPossible} {!stats.isPF && <span className="text-sm text-slate-400 font-normal">({headerCount})</span>}</div>
                        </div>
                    </section>

                    {/* ── Threshold + Distribution ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {!stats.isPF ? (
                            <>
                                {/* Threshold display */}
                                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m4 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                            </div>
                                            <div>
                                                <h2 className="font-black text-slate-800 tracking-tight">เกณฑ์คะแนน (เกรดขั้นต่ำ)</h2>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap">
                                                    สัดส่วนถ่วงน้ำหนัก (เต็ม 100%)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            {isModified && (
                                                <button 
                                                    onClick={handleResetThresholds}
                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100"
                                                >คืนค่าเริ่มต้น</button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <div className="space-y-2">
                                            {(["a", "b_plus", "b", "c_plus", "c", "d_plus", "d"] as const).map((key) => {
                                                const grade = key === 'a' ? '4' : key === 'b_plus' ? '3.5' : key === 'b' ? '3' : key === 'c_plus' ? '2.5' : key === 'c' ? '2' : key === 'd_plus' ? '1.5' : '1';
                                                return (
                                                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-50 bg-slate-50/50 p-2.5">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`flex h-7 w-12 items-center justify-center rounded-lg border text-[10px] font-bold ${GRADE_COLORS[grade] || ""}`}>
                                                                {GRADE_LABELS[grade]}
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-500">คะแนนสะสมตั้งแต่</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 focus-within:scale-105 transition-transform">
                                                            <input 
                                                                type="number"
                                                                step="0.01"
                                                                value={num(thresholds[key])}
                                                                onChange={(e) => handleThresholdChange(key, e.target.value)}
                                                                className="w-16 h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-700 text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                            />
                                                            <span className="text-[10px] font-bold text-slate-400">คะแนน (%)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={handleSaveAndCalculate}
                                            disabled={savingThresholds || calculating || headerCount === 0}
                                            className="mt-5 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                                        >
                                            {calculating ? "กำลังคำนวณ..." : "คำนวณและบันทึกเกรดลงฐานข้อมูล"}
                                        </button>

                                        {headerCount === 0 && (
                                            <p className="mt-2 text-xs text-emerald-600 flex items-center justify-center gap-1 font-bold">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                ยังไม่มีหัวข้อคะแนน กรุณาบันทึกคะแนนก่อน
                                            </p>
                                        )}
                                    </div>
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
                                                                className={`h-full rounded-full bg-gradient-to-r ${GRADE_BAR_COLORS[grade] || "from-emerald-500 to-teal-500"} transition-all duration-500`}
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
                            </>
                        ) : (
                            <>
                                {/* Info & Button display for PF */}
                                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
                                    <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="font-black text-slate-800 tracking-tight">ระบบบันทึกผลการเรียนรายวิชากิจกรรม</h2>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap">
                                                ประเมินผลแบบ ผ่าน (ผ) / ไม่ผ่าน (มผ)
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-center">
                                        <p className="text-slate-500 text-sm mb-6 flex-1">รายวิชานี้ใช้การประเมินผลแบบ <b>ผ่าน (ผ) / ไม่ผ่าน (มผ)</b> โดยอิงตามการส่งภาระงานที่ครูกำหนดให้ครบถ้วน ไม่มีการกำหนดเกณฑ์คะแนนขั้นต่ำ</p>
                                        
                                        <button
                                            onClick={handleSaveAndCalculate}
                                            disabled={savingThresholds || calculating || headerCount === 0}
                                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                                        >
                                            {calculating ? "กำลังประมวลผล..." : "ประมวลผลและบันทึก ผ/มผ ลงฐานข้อมูล"}
                                        </button>
                                        
                                        {headerCount === 0 && (
                                            <p className="mt-2 text-xs text-emerald-600 flex items-center justify-center gap-1 font-bold">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                ยังไม่มีภาระงาน กรุณาเพิ่มชิ้นงานก่อน
                                            </p>
                                        )}
                                    </div>
                                </section>

                                {/* Grade distribution for PF */}
                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="font-bold text-slate-700 mb-4">การกระจายผลการประเมิน</h2>
                                    {summary.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
                                            ยังไม่มีข้อมูล — กดปุ่ม "ประมวลผล" เพื่อเริ่มต้น
                                        </div>
                                    ) : (
                                        <div className="space-y-4 pt-2">
                                            {(["ผ", "มผ"]).map((grade) => {
                                                const count = stats.distribution[grade] || 0;
                                                const pct = stats.count ? (count / stats.count) * 100 : 0;
                                                return (
                                                    <div key={grade} className="flex items-center gap-4">
                                                        <span className={`inline-flex w-24 items-center justify-center rounded-xl border px-2 py-1.5 text-sm font-black ${GRADE_COLORS[grade] || ""}`}>
                                                            {grade === "ผ" ? "ผ่าน (ผ)" : grade === "มผ" ? "ไม่ผ่าน (มผ)" : GRADE_LABELS[grade] || grade}
                                                        </span>
                                                        <div className="flex-1 h-8 rounded-full bg-slate-100 overflow-hidden relative shadow-inner">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ease-out ${grade === "มผ" ? "bg-gradient-to-r from-rose-400 to-red-500" : "bg-gradient-to-r from-emerald-400 to-teal-500"}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                            {count > 0 && (
                                                                <span className="absolute inset-0 flex items-center px-4 text-xs font-bold text-slate-700">
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
                            </>
                        )}
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
                                    className="w-48 rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
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
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">{stats.isPF ? "งานที่ส่ง" : "คะแนนรวม"}</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">{stats.isPF ? "ความครบถ้วน (%)" : "%"}</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">เกรด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary.map((s, i) => (
                                                <tr key={`${s.student_id}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                    <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                                                    <td className="px-4 py-2 text-sm font-mono text-slate-600">{s.student_code}</td>
                                                    <td className="px-4 py-2 text-sm text-slate-800">{s.first_name} {s.last_name}</td>
                                                    <td className="px-4 py-2 text-center text-sm text-slate-700">{num(s.total_score)}<span className="text-slate-400">/{num(s.max_possible)}</span></td>
                                                    <td className="px-4 py-2 text-center text-sm text-slate-700">{num(s.percentage)}%</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${GRADE_COLORS[s.grade] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                            {GRADE_LABELS[s.grade] || s.grade} {(!s.is_pf && s.grade !== normalizeGrade(s.grade)) ? `(${normalizeGrade(s.grade)})` : ''}
                                                        </span>
                                                    </td>
                                                </tr>
                                        ))}
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

