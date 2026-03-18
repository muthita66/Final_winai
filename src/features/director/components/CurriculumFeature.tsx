"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";

type SectionFormState = {
    subject_id: string;
    subject_group: string;
    teacher_id: string;
    class_level: string;
    classroom: string;
    day_of_week: string;
    time_range: string;
    year: string;
    semester: string;
};

function uniqueSorted(values: string[]) {
    return Array.from(new Set(values.filter((v) => v.trim() !== ""))).sort((a, b) => a.localeCompare(b, "th"));
}

function roomOnlyLabel(roomValue: unknown, classLevel?: unknown) {
    const room = String(roomValue || "").trim();
    if (!room) return "";

    const level = String(classLevel || "").trim();
    if (level && room.startsWith(level)) {
        const rest = room.slice(level.length).trim();
        if (!rest) return room;
        return rest.replace(/^\/+/, "").trim() || room;
    }

    return room;
}

function emptySectionForm(currentYear?: number, currentSemester?: number): SectionFormState {
    return {
        subject_id: "",
        subject_group: "",
        teacher_id: "",
        class_level: "",
        classroom: "",
        day_of_week: "",
        time_range: "",
        year: currentYear ? String(currentYear) : "",
        semester: currentSemester ? String(currentSemester) : "1",
    };
}

function buildSectionPayload(form: SectionFormState) {
    const subject_id = Number(form.subject_id);
    if (!form.subject_id || Number.isNaN(subject_id)) throw new Error("กรุณาเลือกรายวิชา");

    const teacher_id = Number(form.teacher_id);
    if (!form.teacher_id || Number.isNaN(teacher_id)) throw new Error("กรุณาเลือกผู้สอน");

    const nextYear = Number(form.year);
    if (!form.year || Number.isNaN(nextYear)) throw new Error("ปีไม่ถูกต้อง");

    const nextSemester = Number(form.semester);
    if (!form.semester || Number.isNaN(nextSemester)) throw new Error("ภาคเรียนไม่ถูกต้อง");

    return {
        subject_id,
        teacher_id,
        class_level: form.class_level.trim() || null,
        classroom: form.classroom.trim() || null,
        day_of_week: form.day_of_week.trim() || null,
        time_range: form.time_range.trim() || null,
        year: nextYear,
        semester: nextSemester,
    };
}

export function CurriculumFeature() {
    const [sections, setSections] = useState<any[]>([]);
    const [allSections, setAllSections] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [studentCounts, setStudentCounts] = useState<any[]>([]);
    const [learningSubjectGroups, setLearningSubjectGroups] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(2568);
    const [semester, setSemester] = useState(1);

    const [filterClassLevel, setFilterClassLevel] = useState("");
    const [filterRoom, setFilterRoom] = useState("");
    const [filterSubjectGroup, setFilterSubjectGroup] = useState("");

    const [creatingSection, setCreatingSection] = useState(false);
    const [editingSection, setEditingSection] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<SectionFormState>(emptySectionForm());

    const refreshAllSections = () => {
        DirectorApiService.getSections().then((rows) => setAllSections(rows || [])).catch(() => { });
    };

    const load = () => {
        setLoading(true);
        DirectorApiService.getSections(year, semester)
            .then(async (d) => {
                setSections(d || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [year, semester]);

    useEffect(() => {
        Promise.all([
            DirectorApiService.getSubjects().catch(() => []),
            DirectorApiService.getTeachers().catch(() => []),
            DirectorApiService.getSections().catch(() => []),
            DirectorApiService.getStudentCount().catch(() => []),
            DirectorApiService.getLearningSubjectGroups().catch(() => []),
            DirectorApiService.getAcademicYears().catch(() => []),
        ]).then(([subjectRows, teacherRows, sectionRows, studentCountRows, groupRows, yearRows]) => {
            setSubjects(subjectRows || []);
            setTeachers(teacherRows || []);
            setAllSections(sectionRows || []);
            setStudentCounts(studentCountRows || []);
            setLearningSubjectGroups(groupRows || []);
            setAcademicYears(yearRows || []);
        });
    }, []);

    const openCreateModal = () => {
        setCreatingSection(true);
        setEditingSection(null);
        const defaultSubjectId = subjects[0]?.id != null ? String(subjects[0].id) : "";
        setForm({
            ...emptySectionForm(year, semester),
            subject_id: "",
            subject_group: "",
            year: String(year),
            semester: String(semester),
        });
    };

    const openEditModal = (section: any) => {
        setCreatingSection(false);
        setEditingSection(section);
        const firstSchedule = Array.isArray(section.class_schedules) ? section.class_schedules[0] : null;
        const period = firstSchedule?.periods;
        const timeRangeFallback = period?.start_time && period?.end_time
            ? `${new Date(period.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}-${new Date(period.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`
            : "";
        setForm({
            subject_id: section.subject_id == null ? "" : String(section.subject_id),
            subject_group: section.subjects?.subject_group || "",
            teacher_id: section.teacher_id == null ? "" : String(section.teacher_id),
            class_level: section.class_level ?? section.classrooms?.levels?.name ?? "",
            classroom: section.classroom ?? section.classrooms?.room_name ?? "",
            day_of_week: section.day_of_week ?? firstSchedule?.day_of_weeks?.day_name_th ?? "",
            time_range: section.time_range ?? timeRangeFallback,
            year: section.year == null ? (section.semesters?.academic_years?.year_name ? String(section.semesters.academic_years.year_name) : String(year)) : String(section.year),
            semester: section.semester == null ? (section.semesters?.semester_number != null ? String(section.semesters.semester_number) : String(semester)) : String(section.semester),
        });
    };

    const closeModal = () => {
        if (saving) return;
        setCreatingSection(false);
        setEditingSection(null);
        setForm(emptySectionForm(year, semester));
    };

    const handleSaveCreate = async () => {
        let payload: any;
        try {
            payload = buildSectionPayload(form);
        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSaving(true);
        try {
            await DirectorApiService.createSection(payload);
            setCreatingSection(false);
            setEditingSection(null);
            setForm(emptySectionForm(year, semester));
            load();
            refreshAllSections();
        } catch (e: any) {
            alert(e?.message || "เพิ่มข้อมูลไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSection) return;

        let payload: any;
        try {
            payload = buildSectionPayload(form);
        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSaving(true);
        try {
            await DirectorApiService.updateSection(editingSection.id, payload);
            setCreatingSection(false);
            setEditingSection(null);
            setForm(emptySectionForm(year, semester));
            load();
            refreshAllSections();
        } catch (e: any) {
            alert(e?.message || "บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("ลบ Section นี้?")) return;
        try {
            await DirectorApiService.deleteSection(id);
            load();
            refreshAllSections();
        } catch (e: any) {
            alert(e?.message || "ลบข้อมูลไม่สำเร็จ");
        }
    };

    const filteredSections = sections.filter((s) => {
        if (filterClassLevel) {
            const cl = String(s.class_level || s.classrooms?.levels?.name || "");
            if (cl !== filterClassLevel) return false;
        }
        if (filterRoom) {
            const r = String(s.classroom || s.classrooms?.room_name || "");
            if (r !== filterRoom) return false;
        }
        if (filterSubjectGroup) {
            const sg = String(s.subjects?.subject_group || "");
            if (sg !== filterSubjectGroup) return false;
        }
        return true;
    }).sort((a, b) => {
        // 1. Sort by Subject Code (ก-ฮ)
        const codeA = a.subjects?.subject_code || "";
        const codeB = b.subjects?.subject_code || "";
        if (codeA !== codeB) return codeA.localeCompare(codeB, "th");

        // 2. Sort by Class Level
        const levelA = String(a.class_level || a.classrooms?.levels?.name || "");
        const levelB = String(b.class_level || b.classrooms?.levels?.name || "");
        if (levelA !== levelB) return levelA.localeCompare(levelB, "th");

        // 3. Sort by Room
        const roomA = String(a.classroom || a.classrooms?.room_name || "");
        const roomB = String(b.classroom || b.classrooms?.room_name || "");
        return roomA.localeCompare(roomB, "th");
    });

    const optionSource = allSections.length > 0 ? allSections : sections;
    const classLevelOptions = uniqueSorted([
        ...(optionSource || []).map((s: any) => String(s.class_level || s.classrooms?.levels?.name || "")),
        ...(studentCounts || []).map((r: any) => String(r.class_level || "")),
        form.class_level || ""
    ]);
    const roomOptions = uniqueSorted([
        ...(optionSource || [])
            .filter((s: any) => !form.class_level || String(s.class_level || s.classrooms?.levels?.name || "") === form.class_level)
            .map((s: any) => String(s.classroom || s.classrooms?.room_name || "")),
        ...(studentCounts || [])
            .filter((r: any) => !form.class_level || String(r.class_level || "") === form.class_level)
            .map((r: any) => String(r.room || "")),
        form.classroom || "",
    ]);

    const filterClassLevelOptions = uniqueSorted(
        (optionSource || []).map((s: any) => String(s.class_level || s.classrooms?.levels?.name || ""))
    );
    const filterRoomOptions = uniqueSorted(
        (optionSource || [])
            .filter((s: any) => !filterClassLevel || String(s.class_level || s.classrooms?.levels?.name || "") === filterClassLevel)
            .map((s: any) => String(s.classroom || s.classrooms?.room_name || ""))
    );
    const filterSubjectGroupOptions = learningSubjectGroups.map((g: any) => String(g.group_name || ""));

    const yearOptions = academicYears.length > 0
        ? academicYears.map(y => String(y.year_name))
        : Array.from(new Set([...(optionSource || []).map((s: any) => String(s.year ?? "")).filter(Boolean), form.year || "", String(year)]))
            .filter(Boolean)
            .sort((a, b) => Number(b) - Number(a));

    const semesterOptions = Array.from(new Set([...(optionSource || []).map((s: any) => String(s.semester ?? "")).filter(Boolean), form.semester || "", String(semester), "1", "2"]))
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b));
    const dayOptions = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const defaultTimeOptions = ["08:00-08:50", "09:00-09:50", "10:00-10:50", "11:00-11:50", "13:00-13:50", "14:00-14:50", "15:00-15:50"];
    const timeOptions = uniqueSorted([
        ...(optionSource || []).map((s: any) => String(s.time_range || "")),
        ...defaultTimeOptions,
        form.time_range || "",
    ]);

    const subjectOptions = subjects.length > 0
        ? subjects
        : Array.from(new Map(
            (optionSource || [])
                .filter((s: any) => s?.subject_id != null)
                .map((s: any) => [Number(s.subject_id), { id: Number(s.subject_id), subject_code: s.subjects?.subject_code || "", name: s.subjects?.name || s.subjects?.subject_name || "" }])
        ).values());

    const teacherOptions = teachers.length > 0
        ? teachers
        : Array.from(new Map(
            (optionSource || [])
                .filter((s: any) => s?.teacher_id != null)
                .map((s: any) => [Number(s.teacher_id), { id: Number(s.teacher_id), teacher_code: s.teachers?.teacher_code || "", first_name: s.teachers?.first_name || "", last_name: s.teachers?.last_name || "" }])
        ).values());

    const isModalOpen = creatingSection || !!editingSection;
    const isCreateMode = creatingSection && !editingSection;

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Curriculum</div>
                    <h1 className="text-3xl font-bold">หลักสูตรและตารางสอน</h1>
                    <p className="text-emerald-100 mt-2">จัดการ Section ({filteredSections.length} รายการ)</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-end">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ปีการศึกษา</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-white" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        {!yearOptions.includes(String(year)) && <option value={year}>{year}</option>}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ภาคเรียน</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">กลุ่มสาระการเรียนรู้</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-white" value={filterSubjectGroup} onChange={(e) => setFilterSubjectGroup(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {filterSubjectGroupOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ชั้น</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-white" value={filterClassLevel} onChange={(e) => { setFilterClassLevel(e.target.value); setFilterRoom(""); }}>
                        <option value="">ทั้งหมด</option>
                        {filterClassLevelOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ห้อง</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-white" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {filterRoomOptions.map(o => <option key={o} value={o}>{roomOnlyLabel(o, filterClassLevel) || o}</option>)}
                    </select>
                </div>
                <button onClick={load} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                    ดึงข้อมูล
                </button>
                <button onClick={openCreateModal} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                    เพิ่ม
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : sections.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">ไม่พบข้อมูล</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">#</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">รหัสวิชา</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชื่อวิชา</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ผู้สอน</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชั้น/ห้อง</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">วัน/เวลา</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSections.map((s, i) => (
                                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    {(() => {
                                        const classLevel = s.class_level || s.classrooms?.levels?.name || "-";
                                        const rawRoom = s.classroom || s.classrooms?.room_name || "-";
                                        const roomLabel = roomOnlyLabel(rawRoom, classLevel) || "-";
                                        return (
                                            <>
                                                <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{s.subjects?.subject_code || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-slate-800 font-medium">{s.subjects?.name || s.subjects?.subject_name || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{s.teachers ? `${s.teachers.first_name} ${s.teachers.last_name}` : "-"}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{classLevel}/{roomLabel}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{s.day_of_week || "-"} {s.time_range || ""}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => openEditModal(s)} className="text-xs text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium">แก้ไข</button>
                                                        <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium">ลบ</button>
                                                    </div>
                                                </td>
                                            </>
                                        );
                                    })()}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={closeModal} />
                    <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800">{isCreateMode ? "เพิ่มหลักสูตร / Section" : "แก้ไขหลักสูตร / Section"}</h3>
                            <button type="button" onClick={closeModal} className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">×</button>
                        </div>
                        <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">กลุ่มสาระการเรียนรู้</span>
                                    <select
                                        value={form.subject_group}
                                        onChange={(e) => setForm((p) => ({ ...p, subject_group: e.target.value, subject_id: "" }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกกลุ่มสาระการเรียนรู้</option>
                                        {learningSubjectGroups.map((g: any) => (
                                            <option key={g.id} value={g.group_name}>{g.group_name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">รายวิชา</span>
                                    <select
                                        value={form.subject_id}
                                        onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกรายวิชา</option>
                                        {form.subject_id && !subjectOptions.some((s: any) => String(s.id) === form.subject_id) && (
                                            <option value={form.subject_id}>{`Subject #${form.subject_id}`}</option>
                                        )}
                                        {(() => {
                                            const filteredSubjects = form.subject_group 
                                                ? subjectOptions.filter((s: any) => (s.subject_group || "ทั่วไป") === form.subject_group)
                                                : subjectOptions;
                                            
                                            const groups = Array.from(new Set(filteredSubjects.map((s: any) => s.subject_group || "ทั่วไป")));
                                            
                                            return groups.map(groupName => (
                                                <optgroup key={groupName} label={String(groupName)}>
                                                    {filteredSubjects.filter((s: any) => (s.subject_group || "ทั่วไป") === groupName).map((s: any) => (
                                                        <option key={s.id} value={String(s.id)}>
                                                            {s.subject_code ? `${s.subject_code} - ` : ""}{s.name || s.subject_name || `Subject #${s.id}`}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ));
                                        })()}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ผู้สอน</span>
                                    <select
                                        value={form.teacher_id}
                                        onChange={(e) => setForm((p) => ({ ...p, teacher_id: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกครูผู้สอน</option>
                                        {form.teacher_id && !teacherOptions.some((t: any) => String(t.id) === form.teacher_id) && (
                                            <option value={form.teacher_id}>{`Teacher #${form.teacher_id}`}</option>
                                        )}
                                        {teacherOptions.map((t: any) => (
                                            <option key={t.id} value={String(t.id)}>
                                                {t.teacher_code ? `${t.teacher_code} - ` : ""}{`${t.first_name || ""} ${t.last_name || ""}`.trim() || `Teacher #${t.id}`}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ชั้น</span>
                                    <select
                                        value={form.class_level}
                                        onChange={(e) => setForm((p) => ({ ...p, class_level: e.target.value, classroom: "" }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกระดับชั้น</option>
                                        {classLevelOptions.map((lvl) => (
                                            <option key={lvl} value={lvl}>{lvl}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ห้อง</span>
                                    <select
                                        value={form.classroom}
                                        onChange={(e) => setForm((p) => ({ ...p, classroom: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกห้อง</option>
                                        {roomOptions.map((room) => (
                                            <option key={room} value={room}>{roomOnlyLabel(room, form.class_level) || room}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">วัน</span>
                                    <select
                                        value={form.day_of_week}
                                        onChange={(e) => setForm((p) => ({ ...p, day_of_week: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {dayOptions.map((day) => (
                                            <option key={day || "empty"} value={day}>{day || "เลือกวัน"}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">เวลา</span>
                                    <select
                                        value={form.time_range}
                                        onChange={(e) => setForm((p) => ({ ...p, time_range: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">เลือกช่วงเวลา</option>
                                        {timeOptions.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ปีการศึกษา</span>
                                    <select
                                        value={form.year}
                                        onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {form.year && !yearOptions.includes(form.year) && <option value={form.year}>{form.year}</option>}
                                        {yearOptions.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ภาคเรียน</span>
                                    <select
                                        value={form.semester}
                                        onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {semesterOptions.map((sem) => (
                                            <option key={sem} value={sem}>{sem}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
                            <button type="button" onClick={closeModal} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60">ยกเลิก</button>
                            <button type="button" onClick={isCreateMode ? handleSaveCreate : handleSaveEdit} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                                {saving ? "กำลังบันทึก..." : (isCreateMode ? "เพิ่ม" : "บันทึก")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
