"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";

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

function toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown) {
    return String(v ?? "").trim();
}

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

export function ScoreInputFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sectionId = Number(searchParams.get("section_id"));
    const hasSection = Number.isFinite(sectionId) && sectionId > 0;

    /* ─── state ─── */
    const [sections, setSections] = useState<any[]>([]);
    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headers, setHeaders] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedHeaderId, setSelectedHeaderId] = useState<number | null>(null);
    const [scoreMap, setScoreMap] = useState<Record<number, Record<number, string>>>({}); // student_id -> header_id -> score
    const [originalScoreMap, setOriginalScoreMap] = useState<Record<number, Record<number, string>>>({});
    const [loading, setLoading] = useState(true);
    const [scoreLoading, setScoreLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
    const [selectedRoomKey, setSelectedRoomKey] = useState("");
    const [selectedYearKey, setSelectedYearKey] = useState("");
    const [selectedTermKey, setSelectedTermKey] = useState("");

    // header inline add
    const [showAddHeader, setShowAddHeader] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newMax, setNewMax] = useState(100);
    const [addingHeader, setAddingHeader] = useState(false);

    // header inline edit
    const [editingHeaderId, setEditingHeaderId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editMax, setEditMax] = useState(100);
    const [updatingHeader, setUpdatingHeader] = useState(false);
    const activeHeader = headers.find((h) => h.id === selectedHeaderId) || null;
    const activeMax = toNum(activeHeader?.max_score);

    const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({}); // key: studentId-headerId

    /* ─── derived ─── */
    const filteredStudents = students.filter((s) => {
        if (!studentSearch.trim()) return true;
        const q = studentSearch.trim().toLowerCase();
        return [s.student_code, s.first_name, s.last_name].some((v) =>
            String(v ?? "").toLowerCase().includes(q)
        );
    });

    const filledCount = students.filter((s) => {
        const studentScores = scoreMap[s.id] || {};
        return Object.values(studentScores).some(v => v !== "");
    }).length;

    const invalidCount = students.reduce((acc, s) => {
        const studentScores = scoreMap[s.id] || {};
        headers.forEach(h => {
            const raw = studentScores[h.id];
            if (raw == null || raw === "") return;
            const n = Number(raw);
            const hMax = toNum(h.max_score);
            if (!Number.isFinite(n) || n < 0 || (hMax > 0 && n > hMax)) {
                acc++;
            }
        });
        return acc;
    }, 0);

    const changedCount = students.reduce((acc, s) => {
        const studentScores = scoreMap[s.id] || {};
        const originalStudentScores = originalScoreMap[s.id] || {};
        headers.forEach(h => {
            if ((studentScores[h.id] ?? "") !== (originalStudentScores[h.id] ?? "")) {
                acc++;
            }
        });
        return acc;
    }, 0);

    const studentTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        students.forEach(s => {
            const studentScores = scoreMap[s.id] || {};
            let sum = 0;
            headers.forEach(h => {
                const val = toNum(studentScores[h.id]);
                sum += val;
            });
            totals[s.id] = sum;
        });
        return totals;
    }, [students, headers, scoreMap]);

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
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || !selectedTermKey) return [];
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
    }, [sections, selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey]);

    const selectedSubjectLabel = subjectOptions.find((o) => o.value === selectedSubjectKey)?.label || "-";
    const selectedRoomLabel = roomOptions.find((o) => o.value === selectedRoomKey)?.label || "-";
    const selectedYearLabel = yearOptions.find((o) => o.value === selectedYearKey)?.label || "-";
    const selectedTermLabel = termOptions.find((o) => o.value === selectedTermKey)?.label || "-";
    const selectionReady = !!(selectedSubjectKey && selectedRoomKey && selectedYearKey && selectedTermKey);

    /* ─── loaders ─── */
    const loadSections = useCallback(async () => {
        try {
            const data = await TeacherApiService.getTeacherSubjects(session.id);
            setSections(Array.isArray(data) ? data : []);
        } catch { setSections([]); }
    }, [session.id]);

    const loadSectionData = useCallback(async () => {
        if (!hasSection) { setLoading(false); return; }
        setLoading(true);
        try {
            const [headerRows, studentRows] = await Promise.all([
                TeacherApiService.getScoreHeaders(sectionId),
                TeacherApiService.getSectionStudents(sectionId),
            ]);
            const nextHeaders = Array.isArray(headerRows) ? headerRows : [];
            setHeaders(nextHeaders);
            setStudents(Array.isArray(studentRows) ? studentRows : []);
            setSelectedHeaderId((prev) => {
                if (prev && nextHeaders.some((h: any) => h.id === prev)) return prev;
                return nextHeaders[0]?.id ?? null;
            });
        } catch {
            setHeaders([]);
            setStudents([]);
        } finally { setLoading(false); }
    }, [hasSection, sectionId]);

    const loadScores = useCallback(async (sectionId: number) => {
        setScoreLoading(true);
        try {
            const rows = await TeacherApiService.getSectionScores(sectionId);
            const map: Record<number, Record<number, string>> = {};
            (rows || []).forEach((r: any) => {
                if (r?.student_id && r?.header_id) {
                    if (!map[r.student_id]) map[r.student_id] = {};
                    map[r.student_id][r.header_id] = r.score == null ? "" : String(r.score);
                }
            });
            setScoreMap(map);
            setOriginalScoreMap(JSON.parse(JSON.stringify(map)));
        } catch { setScoreMap({}); setOriginalScoreMap({}); }
        finally { setScoreLoading(false); }
    }, []);

    useEffect(() => { loadSections(); }, [loadSections]);

    useEffect(() => {
        if (hasSection) {
            const found = sections.find((s) => s.id === sectionId) || null;
            setSectionInfo(found);
            loadSectionData();
        } else {
            setLoading(false);
        }
    }, [hasSection, sectionId, sections, loadSectionData]);

    useEffect(() => {
        if (!hasSection) return;
        loadScores(sectionId);
    }, [hasSection, sectionId, loadScores]);

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
        router.push(`/teacher/score_input?section_id=${nextId}`);
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey, sections, sectionId, router]);

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
        // auto-select term key from first semesterOption
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
        // find the section that matches and derive term key
        const matched = sections.find(
            (s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey && txt(s?.semester) === value
        );
        setSelectedTermKey(matched ? getTermKey(matched) : "");
    };

    const handleAddHeader = async () => {
        const title = newTitle.trim();
        if (!title) return alert("กรุณากรอกชื่อหัวข้อคะแนน");
        if (toNum(newMax) <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");
        setAddingHeader(true);
        try {
            const created = await TeacherApiService.addScoreHeader(sectionId, title, toNum(newMax));
            setNewTitle(""); setNewMax(100); setShowAddHeader(false);
            await loadSectionData();
            if (created?.id) setSelectedHeaderId(created.id);
        } catch { alert("เพิ่มหัวข้อคะแนนไม่สำเร็จ"); }
        finally { setAddingHeader(false); }
    };

    const handleStartEdit = (h: any) => {
        setEditingHeaderId(h.id);
        setEditTitle(String(h.title || ""));
        setEditMax(toNum(h.max_score) || 100);
    };

    const handleUpdateHeader = async () => {
        if (!editingHeaderId) return;
        const title = editTitle.trim();
        if (!title) return alert("กรุณากรอกชื่อหัวข้อ");
        if (toNum(editMax) <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");
        setUpdatingHeader(true);
        try {
            await TeacherApiService.updateScoreHeader(editingHeaderId, title, toNum(editMax));
            setEditingHeaderId(null);
            await loadSectionData();
        } catch { alert("แก้ไขหัวข้อไม่สำเร็จ"); }
        finally { setUpdatingHeader(false); }
    };

    const handleDeleteHeader = async (id: number) => {
        const target = headers.find((h) => h.id === id);
        if (!confirm(`ลบหัวข้อ "${target?.title || "รายการนี้"}" ?`)) return;
        try {
            await TeacherApiService.deleteScoreHeader(id);
            if (selectedHeaderId === id) setSelectedHeaderId(null);
            await loadSectionData();
        } catch { alert("ลบหัวข้อไม่สำเร็จ"); }
    };

    const handleSaveScores = async () => {
        if (invalidCount > 0) return alert("มีคะแนนไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก");
        setSaving(true);
        try {
            const changedHeaders = headers.filter(h => {
                return students.some(s => {
                    const current = (scoreMap[s.id] || {})[h.id] ?? "";
                    const original = (originalScoreMap[s.id] || {})[h.id] ?? "";
                    return current !== original;
                });
            });

            if (changedHeaders.length === 0) {
                setSaving(false);
                return;
            }

            await Promise.all(changedHeaders.map(h => {
                const hMax = toNum(h.max_score);
                return TeacherApiService.saveScores(
                    h.id,
                    students.map((s) => {
                        const raw = (scoreMap[s.id] || {})[h.id];
                        const n = raw == null || raw === "" ? 0 : Number(raw);
                        return {
                            student_id: s.id,
                            score: hMax > 0 ? Math.max(0, Math.min(hMax, toNum(n))) : Math.max(0, toNum(n))
                        };
                    })
                );
            }));

            setOriginalScoreMap(JSON.parse(JSON.stringify(scoreMap)));
            alert("บันทึกคะแนนเรียบร้อย");
        } catch (err) {
            console.error(err);
            alert("บันทึกคะแนนไม่สำเร็จ");
        }
        finally { setSaving(false); }
    };

    const handleFillZero = () => {
        if (!selectedHeaderId) return alert("กรุณาเลือกหัวข้อที่ต้องการเติม 0");
        setScoreMap((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            students.forEach((s) => {
                if (!next[s.id]) next[s.id] = {};
                if ((next[s.id][selectedHeaderId] ?? "") === "") {
                    next[s.id][selectedHeaderId] = "0";
                }
            });
            return next;
        });
    };

    const handleScoreInputEnter = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, headerId: number) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const nextStudent = filteredStudents[rowIndex + 1];
            if (nextStudent) {
                const nextInput = scoreInputRefs.current[`${nextStudent.id}-${headerId}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === "ArrowRight") {
            const hIndex = headers.findIndex(h => h.id === headerId);
            if (hIndex < headers.length - 1) {
                const nextHeader = headers[hIndex + 1];
                const nextInput = scoreInputRefs.current[`${filteredStudents[rowIndex].id}-${nextHeader.id}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === "ArrowLeft") {
            const hIndex = headers.findIndex(h => h.id === headerId);
            if (hIndex > 0) {
                const nextHeader = headers[hIndex - 1];
                const nextInput = scoreInputRefs.current[`${filteredStudents[rowIndex].id}-${nextHeader.id}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        }
    };


    /* ─── render ─── */
    return (
        <div className="space-y-4 pb-24">
            {/* ── Top Bar: Section selector + info ── */}
            <section className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                        <Link href="/teacher/scores" className="inline-flex items-center gap-1.5 text-orange-100 hover:text-white mb-2 transition-colors text-sm font-medium">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            กลับหน้าหลัก
                        </Link>
                        <div className="mt-1">
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                บันทึกคะแนน
                            </h1>
                            {sectionInfo && (
                                <div className="mt-2 space-y-0.5 text-sm opacity-90 break-words">
                                    <div className="font-semibold">{sectionInfo.subjects?.subject_code} {sectionInfo.subjects?.name}</div>
                                    <div className="text-orange-50/80">
                                        ชั้น{formatRoomLabel(sectionInfo)}
                                    </div>
                                    <div className="text-orange-50/70 text-xs">
                                        {formatTermLabel(sectionInfo)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 flex justify-end">
                        <Link href={`/teacher/grade_cut${hasSection ? `?section_id=${sectionId}` : ""}`}
                            className="inline-flex items-center gap-1.5 text-orange-100 hover:text-white transition-colors text-sm font-medium">
                            ไปหน้าตัดเกรด
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </section>

            {hasSection && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ปีการศึกษา</span>
                            <select
                                value={selectedYearKey}
                                onChange={(e) => handleYearSelect(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none hover:bg-slate-100 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-slate-700"
                            >
                                <option value="">เลือกปีการศึกษา...</option>
                                {yearOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ภาคเรียน</span>
                            <select
                                value={selectedTermKey ? txt(sections.find(s => getTermKey(s) === selectedTermKey)?.semester) : ""}
                                onChange={(e) => handleSemesterSelect(e.target.value)}
                                disabled={!selectedYearKey}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none hover:bg-slate-100 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-slate-700"
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
                </section>
            )}

            {!hasSection ? (
                /* ── No section selected ── */
                <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mb-4 flex justify-center">
                        <svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700">เลือกวิชา ห้อง และปีการศึกษา เพื่อเริ่มบันทึกคะแนน</h2>
                    <p className="mt-2 text-slate-500">ระบบจะเลือกเทอมล่าสุดให้อัตโนมัติภายใต้ปีการศึกษาที่เลือก</p>
                </section>
            ) : loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ── Score Table ── */}
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Compact stat bar */}
                        <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-50/70">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <span className="font-semibold text-slate-700">{students.length}</span> คน
                                </span>
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                    กรอกแล้ว <span className="font-semibold text-emerald-700">{filledCount}</span>/{students.length}
                                </span>
                                {changedCount > 0 && (
                                    <span className="text-sm text-amber-700 font-medium flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        แก้ไข {changedCount} รายการ
                                    </span>
                                )}
                                {invalidCount > 0 && (
                                    <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ผิด {invalidCount} จุด
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        placeholder="ค้นหานักเรียน..."
                                        className="w-48 rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowManageModal(true)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                    จัดการหัวข้อ
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        {scoreLoading ? (
                            <div className="p-16 text-center text-slate-400">
                                <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto" />
                                <p className="mt-4 text-sm font-medium">กำลังโหลดข้อมูลคะแนน...</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 text-sm">ไม่พบรายชื่อนักเรียนในกลุ่มนี้</div>
                        ) : (
                            <div className="overflow-x-auto max-w-full">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200">
                                            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12 border-r border-slate-200">#</th>
                                            <th className="sticky left-12 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] border-r border-slate-200">รหัส</th>
                                            <th className="sticky left-[148px] z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">ชื่อ-นามสกุล</th>

                                            {headers.map(h => (
                                                <th key={h.id}
                                                    onClick={() => setSelectedHeaderId(h.id)}
                                                    className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-100 min-w-[100px] cursor-pointer transition-colors ${selectedHeaderId === h.id ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"}`}>
                                                    <div className="line-clamp-1" title={h.title}>{h.title}</div>
                                                    <div className="mt-0.5 text-[10px] font-normal opacity-60">เต็ม {toNum(h.max_score)}</div>
                                                </th>
                                            ))}

                                            <th className="px-4 py-3 text-center text-xs font-bold text-amber-600 uppercase tracking-wider bg-amber-50/30 min-w-[100px]">คะแนนรวม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map((s, i) => {
                                            const total = studentTotals[s.id] || 0;
                                            const studentScores = scoreMap[s.id] || {};
                                            const studentOriginalScores = originalScoreMap[s.id] || {};

                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-xs text-slate-400 border-r border-slate-100">{i + 1}</td>
                                                    <td className="sticky left-12 z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-[15px] font-bold font-mono text-slate-600 border-r border-slate-100 tracking-tight">{s.student_code}</td>
                                                    <td className="sticky left-[148px] z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                        {s.prefix}{s.first_name} {s.last_name}
                                                    </td>

                                                    {headers.map(h => {
                                                        const raw = studentScores[h.id] ?? "";
                                                        const originalRaw = studentOriginalScores[h.id] ?? "";
                                                        const n = raw === "" ? null : Number(raw);
                                                        const hMax = toNum(h.max_score);
                                                        const invalid = raw !== "" && (!Number.isFinite(n) || (n as number) < 0 || (hMax > 0 && (n as number) > hMax));
                                                        const changed = raw !== originalRaw;

                                                        return (
                                                            <td key={h.id} className={`px-2 py-1.5 text-center border-r border-slate-50 ${selectedHeaderId === h.id ? "bg-amber-50/20" : ""}`}>
                                                                <input
                                                                    ref={(el) => {
                                                                        scoreInputRefs.current[`${s.id}-${h.id}`] = el;
                                                                    }}
                                                                    type="number"
                                                                    value={raw}
                                                                    onFocus={() => setSelectedHeaderId(h.id)}
                                                                    onChange={(e) => setScoreMap((prev) => ({
                                                                        ...prev,
                                                                        [s.id]: { ...(prev[s.id] || {}), [h.id]: e.target.value }
                                                                    }))}
                                                                    onKeyDown={(e) => handleScoreInputEnter(e, i, h.id)}
                                                                    className={`w-16 rounded-lg border px-2 py-1.5 text-center text-sm outline-none transition-all focus:ring-2 ${invalid ? "border-red-300 bg-red-50 text-red-700 focus:ring-red-400 cursor-help"
                                                                        : changed ? "border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-400"
                                                                            : "border-slate-200 focus:border-amber-400 focus:ring-amber-400/20"
                                                                        }`}
                                                                />
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="px-4 py-2 text-center bg-amber-50/10">
                                                        <span className={`text-sm font-bold ${total > 0 ? "text-amber-600" : "text-slate-300"}`}>
                                                            {total.toLocaleString()}
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

            {/* ── Action Bar (Save/Cancel) ── */}
            {hasSection && (
                <div className="mt-6 flex justify-end px-4 overflow-visible">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                            <div className={`w-2.5 h-2.5 rounded-full ${changedCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                            <span className="font-medium">{changedCount > 0 ? `มีการเปลี่ยนแปลง ${changedCount} รายการ` : "ข้อมูลเป็นปัจจุบันแล้ว"}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setScoreMap(JSON.parse(JSON.stringify(originalScoreMap)))}
                                disabled={saving || changedCount === 0}
                                className="px-6 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveScores}
                                disabled={saving || invalidCount > 0 || changedCount === 0}
                                className="px-8 py-2.5 rounded-2xl bg-amber-500 text-sm font-black text-white hover:bg-amber-600 shadow-md shadow-amber-200 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                {saving ? "กำลังบันทึก..." : "บันทึกคะแนนทั้งหมด"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Manage Headers Modal ── */}
            {showManageModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">จัดการหัวข้อคะแนน</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{headers.length} หัวข้อคะแนนทั้งหมด</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowManageModal(false);
                                    setShowAddHeader(false);
                                    setEditingHeaderId(null);
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {headers.map((h) => {
                                    const isEditing = editingHeaderId === h.id;
                                    if (isEditing) {
                                        return (
                                            <div key={h.id} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-amber-400 bg-amber-50 animate-in slide-in-from-top-2">
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                                        placeholder="ชื่อหัวข้อ"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500 font-medium">คะแนนเต็ม:</span>
                                                        <input
                                                            type="number"
                                                            value={editMax}
                                                            onChange={(e) => setEditMax(Number(e.target.value))}
                                                            className="w-20 rounded-xl border border-amber-200 px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-amber-400"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={handleUpdateHeader} disabled={updatingHeader} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50">บันทึก</button>
                                                    <button onClick={() => setEditingHeaderId(null)} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300">ยกเลิก</button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={h.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 hover:shadow-md transition-all group">
                                            <div>
                                                <div className="font-bold text-slate-700">{h.title}</div>
                                                <div className="text-xs text-slate-400 font-medium mt-1">เต็ม {toNum(h.max_score)} คะแนน</div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStartEdit(h)} className="p-2 rounded-lg text-slate-400 hover:bg-amber-100 hover:text-amber-600" title="แก้ไข">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteHeader(h.id)} className="p-2 rounded-lg text-slate-400 hover:bg-red-100 hover:text-red-600" title="ลบ">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {showAddHeader ? (
                                    <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 space-y-3 animate-in fade-in zoom-in-95">
                                        <input
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                                            placeholder="กรอกชื่อหัวข้อใหม่ (เช่น เก็บหลังเรียนบทที่ 1)"
                                            autoFocus
                                        />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 font-medium">คะแนนเต็ม:</span>
                                                <input
                                                    type="number"
                                                    value={newMax}
                                                    onChange={(e) => setNewMax(Number(e.target.value))}
                                                    className="w-20 rounded-xl border border-emerald-200 px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-emerald-400"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleAddHeader} disabled={addingHeader} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">เพิ่ม</button>
                                                <button onClick={() => { setShowAddHeader(false); setNewTitle(""); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300">ยกเลิก</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowAddHeader(true)}
                                        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        <span className="font-bold">เพิ่มหัวข้อใหม่</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowManageModal(false);
                                    setShowAddHeader(false);
                                    setEditingHeaderId(null);
                                }}
                                className="px-6 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-all hover:shadow-lg active:scale-95"
                            >
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

