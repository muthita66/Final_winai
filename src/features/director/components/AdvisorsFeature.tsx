"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";
import Portal from "@/components/Portal";

type AdvisorFormState = {
    teacher_id: string;
    class_level: string;
    room: string;
    year: string;
    semester: string;
};

function uniqueSorted(values: string[]) {
    return Array.from(new Set(values.filter((v) => v.trim() !== ""))).sort((a, b) => a.localeCompare(b, "th"));
}

function emptyAdvisorForm(currentYear?: number, currentSemester?: number): AdvisorFormState {
    return {
        teacher_id: "",
        class_level: "",
        room: "",
        year: currentYear ? String(currentYear) : "",
        semester: currentSemester ? String(currentSemester) : "1",
    };
}

function buildAdvisorPayload(form: AdvisorFormState) {
    const teacher_id = Number(form.teacher_id);
    if (!form.teacher_id || Number.isNaN(teacher_id)) throw new Error("กรุณาเลือกครูที่ปรึกษา");

    const class_level = form.class_level.trim();
    if (!class_level) throw new Error("กรุณาเลือกชั้น");

    const nextYear = Number(form.year);
    if (!form.year || Number.isNaN(nextYear)) throw new Error("ปีไม่ถูกต้อง");

    const nextSemester = Number(form.semester);
    if (!form.semester || Number.isNaN(nextSemester)) throw new Error("ภาคเรียนไม่ถูกต้อง");

    return {
        teacher_id,
        class_level,
        room: form.room.trim(),
        year: nextYear,
        semester: nextSemester,
    };
}

export function AdvisorsFeature() {
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [allAdvisors, setAllAdvisors] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [studentCounts, setStudentCounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>("");
    const [year, setYear] = useState(2568);
    const [semester, setSemester] = useState(1);
    const [academicYears, setAcademicYears] = useState<{ id: number; year_name: string }[]>([]);

    const [editingAdvisor, setEditingAdvisor] = useState<any | null>(null);
    const [creatingAdvisor, setCreatingAdvisor] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [savingCreate, setSavingCreate] = useState(false);
    const [form, setForm] = useState<AdvisorFormState>(emptyAdvisorForm());

    const [levelOptions, setLevelOptions] = useState<string[]>([]);
    const [roomOptionsList, setRoomOptionsList] = useState<string[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const [selectedRoom, setSelectedRoom] = useState<string>("");

    const refreshAllAdvisors = () => {
        DirectorApiService.getAdvisors().then((rows) => setAllAdvisors(rows || [])).catch(() => { });
    };

    const load = () => {
        setLoading(true);
        setLoadError("");
        DirectorApiService.getAdvisors({
            year,
            semester,
            class_level: selectedLevel || undefined,
            room: selectedRoom || undefined
        })
            .then(async (rows) => {
                const list = rows || [];

                if (list.length === 0 && year < 2400 && !selectedLevel && !selectedRoom) {
                    const beYear = year + 543;
                    const beRows = (await DirectorApiService.getAdvisors({ year: beYear, semester }).catch(() => [])) || [];
                    if (beRows.length > 0) {
                        setYear(beYear);
                        setAdvisors(beRows);
                        setLoading(false);
                        return;
                    }
                }

                if (list.length === 0 && !selectedLevel && !selectedRoom) {
                    const allRows = (await DirectorApiService.getAdvisors().catch(() => [])) || [];
                    if (allRows.length > 0) {
                        const latest = allRows.find((r: any) => r?.year != null && r?.semester != null) || allRows[0];
                        const latestYear = Number(latest.year) || year;
                        const latestSemester = Number(latest.semester) || semester;
                        const latestRows = allRows.filter((r: any) => Number(r.year) === latestYear && Number(r.semester) === latestSemester);
                        if (latestRows.length > 0) {
                            setYear(latestYear);
                            setSemester(latestSemester);
                            setAdvisors(latestRows);
                            setAllAdvisors(allRows);
                            setLoading(false);
                            return;
                        }
                        setAllAdvisors(allRows);
                    }
                }

                setAdvisors(list);
                setLoading(false);
            })
            .catch((e: any) => {
                setLoadError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
                setAdvisors([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, [year, semester, selectedLevel, selectedRoom]);

    useEffect(() => {
        Promise.all([
            DirectorApiService.getAdvisors().catch(() => []),
            DirectorApiService.getTeachers().catch(() => []),
            DirectorApiService.getStudentCount().catch(() => []),
            DirectorApiService.getGradeLevels().catch(() => []),
            DirectorApiService.getClassrooms().catch(() => []),
            DirectorApiService.getAcademicYears().catch(() => []),
        ]).then(([advisorRows, teacherRows, studentCountRows, levels, rooms, years]) => {
            setAllAdvisors(advisorRows || []);
            setTeachers(teacherRows || []);
            setStudentCounts(studentCountRows || []);
            setLevelOptions(levels || []);
            setRoomOptionsList(rooms || []);
            setAcademicYears(years || []);
        });
    }, []);

    const openCreateModal = () => {
        setCreatingAdvisor(true);
        setEditingAdvisor(null);
        setForm(emptyAdvisorForm(year, semester));
    };

    const openEditModal = (advisor: any) => {
        setCreatingAdvisor(false);
        setEditingAdvisor(advisor);
        setForm({
            teacher_id: advisor.teacher_id == null ? "" : String(advisor.teacher_id),
            class_level: advisor.class_level ?? "",
            room: advisor.room ?? "",
            year: advisor.year == null ? String(year) : String(advisor.year),
            semester: advisor.semester == null ? String(semester) : String(advisor.semester),
        });
    };

    const closeModal = () => {
        if (savingEdit || savingCreate) return;
        setCreatingAdvisor(false);
        setEditingAdvisor(null);
        setForm(emptyAdvisorForm(year, semester));
    };

    const handleSaveCreate = async () => {
        let payload: any;
        try {
            payload = buildAdvisorPayload(form);
        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSavingCreate(true);
        try {
            await DirectorApiService.createAdvisor(payload);
            setCreatingAdvisor(false);
            setEditingAdvisor(null);
            setForm(emptyAdvisorForm(year, semester));
            load();
            refreshAllAdvisors();
        } catch (e: any) {
            alert(e?.message || "เพิ่มข้อมูลไม่สำเร็จ");
        } finally {
            setSavingCreate(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingAdvisor) return;

        let payload: any;
        try {
            payload = buildAdvisorPayload(form);
        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSavingEdit(true);
        try {
            await DirectorApiService.updateAdvisor(editingAdvisor.id, payload);
            setCreatingAdvisor(false);
            setEditingAdvisor(null);
            setForm(emptyAdvisorForm(year, semester));
            load();
            refreshAllAdvisors();
        } catch (e: any) {
            alert(e?.message || "บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("ลบรายการนี้?")) return;
        try {
            await DirectorApiService.deleteAdvisor(id);
            load();
            refreshAllAdvisors();
        } catch (e: any) {
            alert(e?.message || "ลบข้อมูลไม่สำเร็จ");
        }
    };

    const advisorSource = allAdvisors.length > 0 ? allAdvisors : advisors;
    const classLevelOptionsForForm = uniqueSorted([
        ...(advisorSource || []).map((a: any) => String(a.class_level || "")),
        ...(studentCounts || []).map((r: any) => String(r.class_level || "")),
        form.class_level || "",
    ]);
    const roomOptionsForForm = uniqueSorted([
        ...(advisorSource || [])
            .filter((a: any) => !form.class_level || String(a.class_level || "") === form.class_level)
            .map((a: any) => String(a.room || "")),
        ...(studentCounts || [])
            .filter((r: any) => !form.class_level || String(r.class_level || "") === form.class_level)
            .map((r: any) => String(r.room || "")),
        form.room || "",
    ]);
    const yearOptions = Array.from(new Set([
        ...(academicYears || []).map(y => String(y.year_name)),
        ...(advisorSource || []).map((a: any) => String(a.year ?? "")).filter(Boolean),
        form.year || "",
        String(year)
    ]))
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a)); // Sort descending for better UX
    const semesterOptions = Array.from(new Set([...(advisorSource || []).map((a: any) => String(a.semester ?? "")).filter(Boolean), form.semester || "", String(semester), "1", "2"]))
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b));

    const isModalOpen = creatingAdvisor || !!editingAdvisor;
    const isSaving = savingEdit || savingCreate;
    const isCreateMode = creatingAdvisor && !editingAdvisor;

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Advisors</div>
                    <h1 className="text-3xl font-bold">ครูที่ปรึกษา</h1>
                    <p className="text-emerald-100 mt-2">ปีการศึกษา {year} ภาคเรียนที่ {semester} ({advisors.length} รายการ)</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium ml-1">ปีการศึกษา</label>
                    <select
                        className="px-3 py-2 border border-slate-200 rounded-xl w-32 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium ml-1">ภาคเรียน</label>
                    <select
                        className="px-3 py-2 border border-slate-200 rounded-xl w-24 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={semester}
                        onChange={(e) => setSemester(Number(e.target.value))}
                    >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium ml-1">ระดับชั้น</label>
                    <select
                        className="px-3 py-2 border border-slate-200 rounded-xl min-w-[140px] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={selectedLevel}
                        onChange={(e) => {
                            setSelectedLevel(e.target.value);
                            setSelectedRoom(""); // Reset room when level changes
                        }}
                    >
                        <option value="">ทั้งหมด</option>
                        {levelOptions.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium ml-1">ห้อง</label>
                    <select
                        className="px-3 py-2 border border-slate-200 rounded-xl min-w-[100px] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                    >
                        <option value="">ทั้งหมด</option>
                        {roomOptionsList.map(rm => <option key={rm} value={rm}>{rm}</option>)}
                    </select>
                </div>

                <div className="flex gap-2">
                    <button onClick={openCreateModal} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-sm active:scale-95">
                        เพิ่ม
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : loadError ? (
                    <div className="p-6 text-center">
                        <div className="text-sm text-red-600 font-medium">{loadError}</div>
                        <button
                            type="button"
                            onClick={load}
                            className="mt-3 px-4 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm"
                        >
                            ลองใหม่
                        </button>
                    </div>
                ) : advisors.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">ไม่พบข้อมูล</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ลำดับ</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชั้น</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ห้อง</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ครูที่ปรึกษา</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ปีการศึกษา/ภาคเรียน</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {advisors.map((a, i) => (
                                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{a.class_level}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{a.room || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{a.teachers ? `${a.teachers.first_name} ${a.teachers.last_name}` : "-"}</td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{a.year}/{a.semester}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => openEditModal(a)} className="text-xs text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium">แก้ไข</button>
                                            <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium">ลบ</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={closeModal} />
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800">{isCreateMode ? "เพิ่มครูที่ปรึกษา" : "แก้ไขครูที่ปรึกษา"}</h3>
                            <button type="button" onClick={closeModal} className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">×</button>
                        </div>
                        <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block md:col-span-2">
                                    <span className="text-sm font-medium text-slate-700">ครู</span>
                                    <select
                                        value={form.teacher_id}
                                        onChange={(e) => setForm((p) => ({ ...p, teacher_id: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">- เลือกครู -</option>
                                        {form.teacher_id && !teachers.some((t: any) => String(t.id) === form.teacher_id) && (
                                            <option value={form.teacher_id}>{`Teacher #${form.teacher_id}`}</option>
                                        )}
                                        {teachers.map((t: any) => (
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
                                        onChange={(e) => setForm((p) => ({ ...p, class_level: e.target.value, room: "" }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">- เลือกชั้น -</option>
                                        {classLevelOptionsForForm.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ห้อง</span>
                                    <select
                                        value={form.room}
                                        onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        <option value="">- เลือกห้อง -</option>
                                        {roomOptionsForForm.map((room) => <option key={room} value={room}>{room}</option>)}
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
                                        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">ภาคเรียน</span>
                                    <select
                                        value={form.semester}
                                        onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {semesterOptions.map((sem) => <option key={sem} value={sem}>{sem}</option>)}
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
                            <button type="button" onClick={closeModal} disabled={isSaving} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60">ยกเลิก</button>
                            <button type="button" onClick={isCreateMode ? handleSaveCreate : handleSaveEdit} disabled={isSaving} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                                {isSaving ? "กำลังบันทึก..." : (isCreateMode ? "เพิ่ม" : "บันทึก")}
                            </button>
                        </div>
                    </div>
                </div>
            </Portal>
        )}
        </div>
    );
}
