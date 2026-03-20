"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TeacherApiService } from "@/services/teacher-api.service";

function normalizeText(value: any) {
    return String(value ?? "").trim().toLowerCase();
}

function formatTime(raw: any): string {
    if (!raw) return "";
    // raw could be an ISO string "1970-01-01T08:00:00.000Z" or "08:00" etc.
    const s = String(raw);
    const match = s.match(/T?(\d{2}:\d{2})/);
    if (match) return match[1];
    return s.substring(0, 5);
}

function formatThaiDate(raw: any): string {
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

const EXAM_TYPE_LABELS: Record<string, string> = {
    midterm: "สอบกลางภาค",
    final: "สอบปลายภาค",
};



// ─── Exam Modal ─────────────────────────────────────────────────────────────

function ExamModal({
    section,
    onClose,
}: {
    section: any;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [examType, setExamType] = useState("midterm");
    const [examDate, setExamDate] = useState("");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("11:00");
    const [existingList, setExistingList] = useState<any[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await TeacherApiService.getSectionExamSchedule(section.id);
            const list = Array.isArray(data) ? data : [];
            setExistingList(list);
            // Pre-fill from existing if available
            const found = list.find((r: any) => r.exam_type === examType);
            if (found) {
                setExamDate(found.exam_date ? new Date(found.exam_date).toISOString().substring(0, 10) : "");
                setStartTime(formatTime(found.start_time) || "09:00");
                setEndTime(formatTime(found.end_time) || "11:00");
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [section.id, examType]);

    useEffect(() => {
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section.id]);

    // When exam type changes, update prefill
    useEffect(() => {
        const found = existingList.find((r: any) => r.exam_type === examType);
        if (found) {
            setExamDate(found.exam_date ? new Date(found.exam_date).toISOString().substring(0, 10) : "");
            setStartTime(formatTime(found.start_time) || "09:00");
            setEndTime(formatTime(found.end_time) || "11:00");
        } else {
            setExamDate("");
            setStartTime("09:00");
            setEndTime("11:00");
        }
    }, [examType, existingList]);

    const handleSave = async () => {
        if (!examDate) return alert("กรุณาเลือกวันสอบ");
        if (!startTime || !endTime) return alert("กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด");
        setSaving(true);
        try {
            await TeacherApiService.saveSectionExamSchedule({
                section_id: section.id,
                exam_type: examType,
                exam_date: examDate,
                start_time: startTime,
                end_time: endTime,
            });
            await load();
            alert("บันทึกวันสอบเรียบร้อยแล้ว ✓");
        } catch {
            alert("บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
                    <button onClick={onClose} className="absolute top-4 right-5 text-white/70 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-emerald-100">กำหนดวันสอบ</span>
                    </div>
                    <h2 className="text-xl font-bold">{section?.subjects?.name || "-"}</h2>
                    <p className="text-emerald-100 text-sm">{section?.subjects?.subject_code} · {section?.class_level}/{section?.classroom?.split("/").pop() || section?.classroom}</p>
                </div>

                {/* Existing exams summary */}
                {existingList.length > 0 && (
                    <div className="px-6 pt-4 flex flex-wrap gap-2">
                        {existingList.map((item: any) => (
                            <div key={item.id} className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800">
                                <span className="font-bold">{EXAM_TYPE_LABELS[item.exam_type] || item.exam_type}</span>
                                {" · "}
                                {formatThaiDate(item.exam_date)}
                                {" · "}
                                {formatTime(item.start_time)}–{formatTime(item.end_time)} น.
                            </div>
                        ))}
                    </div>
                )}

                {/* Form */}
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : (
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">ประเภทการสอบ</label>
                            <div className="flex gap-2">
                                {["midterm", "final"].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setExamType(t)}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${examType === t
                                            ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                            : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                                            }`}
                                    >
                                        {EXAM_TYPE_LABELS[t]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">วันสอบ</label>
                            <input
                                type="date"
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">เวลาเริ่ม</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">เวลาสิ้นสุด</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    บันทึกวันสอบ
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Feature ─────────────────────────────────────────────────────────────

export function ScoresFeature({ session }: { session: any }) {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [semesterFilter, setSemesterFilter] = useState<string>("all");
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const [classroomFilter, setClassroomFilter] = useState<string>("all");
    const [subjectFilter, setSubjectFilter] = useState<string>("all");
    const [examModalSection, setExamModalSection] = useState<any | null>(null);

    useEffect(() => {
        let active = true;
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await TeacherApiService.getTeacherSubjects(session.id);
                if (!active) return;
                setSubjects(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                setError("ไม่สามารถโหลดรายการวิชาที่สอนได้");
                setSubjects([]);
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [session.id]);

    const years = Array.from(new Set(subjects.map((s) => String(s.year ?? "")).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
    const semesters = Array.from(new Set(subjects.map((s) => String(s.semester ?? "")).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
    const levels = Array.from(new Set(subjects.map((s) => String(s.class_level ?? "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const classrooms = Array.from(new Set(subjects.map((s) => String(s.classroom ?? "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const subjectOptions = Array.from(new Set(subjects.map((s) => `${s?.subjects?.subject_code}|${s?.subjects?.name}`))).sort().map(val => {
        const [code, name] = val.split("|");
        return { code, name };
    });

    const filteredSubjects = subjects
        .filter((s) => {
            if (yearFilter !== "all" && String(s.year) !== yearFilter) return false;
            if (semesterFilter !== "all" && String(s.semester) !== semesterFilter) return false;
            if (levelFilter !== "all" && String(s.class_level) !== levelFilter) return false;
            if (classroomFilter !== "all" && String(s.classroom) !== classroomFilter) return false;
            if (subjectFilter !== "all" && s?.subjects?.subject_code !== subjectFilter) return false;
            if (!search.trim()) return true;
            const q = normalizeText(search);
            const haystack = [s?.subjects?.subject_code, s?.subjects?.name, s?.class_level, s?.classroom, s?.room, s?.year, s?.semester].map(normalizeText).join(" ");
            return haystack.includes(q);
        })
        .sort((a, b) => {
            const yearDiff = Number(b?.year || 0) - Number(a?.year || 0);
            if (yearDiff !== 0) return yearDiff;
            const semDiff = Number(b?.semester || 0) - Number(a?.semester || 0);
            if (semDiff !== 0) return semDiff;
            return String(a?.subjects?.subject_code || "").localeCompare(String(b?.subjects?.subject_code || ""));
        });

    return (
        <div className="space-y-6">
            {/* Header */}
            <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-4rem] w-72 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium mb-4">
                        Score Workspace
                    </div>
                    <h1 className="text-3xl font-bold">ข้อมูลรายวิชา</h1>
                    <p className="mt-2 text-emerald-50">
                        เลือกรายวิชา/Section เพื่อไปยังหน้าบันทึกคะแนน หรือหน้าตัดเกรด
                    </p>
                </div>
            </section>

            {/* Filters */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="md:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">ค้นหา</label>
                        <div className="relative">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="พิมพ์..."
                                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">รายวิชา</label>
                        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm">
                            <option value="all">ทั้งหมด</option>
                            {subjectOptions.map((opt) => (<option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ปีการศึกษา</label>
                        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm">
                            <option value="all">ทั้งหมด</option>
                            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ภาคเรียน</label>
                        <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm">
                            <option value="all">ทั้งหมด</option>
                            {semesters.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ระดับชั้น</label>
                        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm">
                            <option value="all">ทั้งหมด</option>
                            {levels.map((l) => (<option key={l} value={l}>{l}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ห้อง</label>
                        <select value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm">
                            <option value="all">ทั้งหมด</option>
                            {classrooms.map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div>
            )}

            {/* Cards */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="font-bold text-slate-800">รายการรายวิชา / Section</h2>
                        <p className="text-sm text-slate-500">จำนวน {filteredSubjects.length} รายการ</p>
                    </div>
                    {(search || yearFilter !== "all" || semesterFilter !== "all" || levelFilter !== "all" || classroomFilter !== "all" || subjectFilter !== "all") && (
                        <button
                            onClick={() => { setSearch(""); setYearFilter("all"); setSemesterFilter("all"); setLevelFilter("all"); setClassroomFilter("all"); setSubjectFilter("all"); }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-500">กำลังโหลดรายการวิชาที่สอน...</div>
                ) : filteredSubjects.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        {subjects.length === 0 ? "ยังไม่มีรายวิชาที่สอน" : "ไม่พบรายการตามตัวกรองที่เลือก"}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
                        {filteredSubjects.map((s) => {
                            return (
                                <div
                                    key={s.id}
                                    className="rounded-2xl border border-slate-200 p-5 bg-gradient-to-b from-white to-slate-50/60 hover:shadow-md hover:border-emerald-200 transition-all"
                                >
                                    {/* Subject heading */}
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-600">
                                                {s?.subjects?.subject_code || "-"}
                                            </div>
                                            <h3 className="mt-2 text-lg font-bold text-slate-800">
                                                {s?.subjects?.name || "ไม่ระบุชื่อรายวิชา"}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Info chips */}
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                            <div className="text-xs text-slate-500">Section ID</div>
                                            <div className="text-sm font-semibold text-slate-700">{s.id}</div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                            <div className="text-xs text-slate-500">ชั้น / ห้อง</div>
                                            <div className="text-sm font-semibold text-slate-700">
                                                {s.class_level || "-"} / {s.classroom?.split('/').pop() || s.classroom || "-"}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                            <div className="text-xs text-slate-500">ภาคเรียน</div>
                                            <div className="text-sm font-semibold text-slate-700">
                                                {s.year || "-"} / {s.semester || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Teaching schedule moved above – nothing here */}

                                    {/* Action buttons */}
                                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                        <Link
                                            href={`/teacher/score_input?section_id=${s.id}`}
                                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                                        >
                                            บันทึกคะแนน
                                        </Link>
                                        <Link
                                            href={`/teacher/grade_cut?section_id=${s.id}`}
                                            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                                        >
                                            ตัดเกรด
                                        </Link>
                                        <button
                                            onClick={() => setExamModalSection(s)}
                                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            วันสอบ
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Exam modal */}
            {examModalSection && (
                <ExamModal
                    section={examModalSection}
                    onClose={() => setExamModalSection(null)}
                />
            )}
        </div>
    );
}
