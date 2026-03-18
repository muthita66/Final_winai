"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";

type CrudColumn = {
    key: string;
    label: string;
    render?: (v: any, row: any) => any;
};

type EditField = {
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "select" | "password" | "time";
    options?: string[];
    parseAs?: "text" | "number" | "date";
    multiline?: boolean;
    placeholder?: string;
    required?: boolean;
};

function formatFieldValue(value: any, type?: EditField["type"]) {
    if (value == null) return "";
    if (type === "date") {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return String(value);
}

function parseFieldValue(raw: string, type?: EditField["type"], parseAs?: EditField["parseAs"]) {
    const targetType = parseAs || type;
    if (targetType === "number") {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        const n = Number(trimmed);
        return Number.isNaN(n) ? NaN : n;
    }
    if (targetType === "date") {
        const trimmed = raw.trim();
        return trimmed ? trimmed : null;
    }
    return raw;
}

function buildInitialValues(fields: EditField[], source?: any) {
    const nextValues: Record<string, string> = {};

    for (const field of fields) {
        if (source) {
            let value = source[field.key];

            if (field.type === "select") {
                value = value ?? "";
                nextValues[field.key] = String(value);
            } else {
                nextValues[field.key] = formatFieldValue(value, field.type);
            }

        } else if (field.type === "select") {
            nextValues[field.key] = field.options?.[0] ?? "";
        } else {
            nextValues[field.key] = "";
        }
    }

    return nextValues;
}

function buildPayloadFromValues(fields: EditField[], values: Record<string, string>) {
    const payload: any = {};
    for (const field of fields) {
        const raw = values[field.key] ?? "";
        if (field.required && raw.trim() === "") {
            throw new Error(`กรุณากรอก ${field.label}`);
        }

        if (field.type === "password" && raw.trim() === "") {
            continue;
        }

        const parsed = parseFieldValue(raw, field.type, field.parseAs);
        if (typeof parsed === "number" && Number.isNaN(parsed)) {
            throw new Error(`ค่าของ ${field.label} ไม่ถูกต้อง`);
        }
        payload[field.key] = parsed;
    }
    return payload;
}

function EditModal({
    open,
    title,
    fields,
    values,
    saving,
    onClose,
    onChange,
    onSubmit,
    submitLabel,
}: {
    open: boolean;
    title: string;
    fields: EditField[];
    values: Record<string, string>;
    saving: boolean;
    onClose: () => void;
    onChange: (key: string, value: string) => void;
    onSubmit: () => void;
    submitLabel?: string;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    >
                        ×
                    </button>
                </div>
                <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((field) => (
                            <label key={field.key} className={`block ${field.multiline ? "md:col-span-2" : ""}`}>
                                <span className="text-sm font-medium text-slate-700">{field.label}</span>
                                {field.multiline ? (
                                    <textarea
                                        value={values[field.key] ?? ""}
                                        onChange={(e) => onChange(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        rows={4}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                ) : field.type === "select" ? (
                                    <select
                                        value={values[field.key] ?? ""}
                                        onChange={(e) => onChange(field.key, e.target.value)}
                                        required={field.required}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {(field.options || []).map((opt) => (
                                            <option key={`${field.key}-${opt || "empty"}`} value={opt}>
                                                {opt === "" ? "ทั้งหมด" : opt}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : field.type === "password" ? "password" : "text"}
                                        value={values[field.key] ?? ""}
                                        onChange={(e) => onChange(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                )}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {saving ? "กำลังบันทึก..." : (submitLabel || "บันทึก")}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CrudFeature({
    title,
    subtitle,
    color,
    fetchFn,
    deleteFn,
    columns,
    searchLabel,
    createFn,
    createFields,
    editFn,
    editFields,
    customFilters,
    badgeText,
    topContent,
    customSort,
}: {
    title: string;
    subtitle: string;
    color: string;
    fetchFn: (s?: string, filters?: Record<string, string>) => Promise<any[]>;
    deleteFn: (id: number) => Promise<any>;
    columns: CrudColumn[];
    searchLabel?: string;
    createFn?: (data: any) => Promise<any>;
    createFields?: EditField[] | ((items: any[]) => EditField[]);
    editFn?: (id: number, data: any) => Promise<any>;
    editFields?: EditField[] | ((items: any[]) => EditField[]);
    customFilters?: { key: string; label: string; options: (items: any[]) => string[] }[];
    badgeText?: string;
    topContent?: React.ReactNode;
    customSort?: (a: any, b: any) => number;
}) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [creatingItem, setCreatingItem] = useState(false);
    const [createValues, setCreateValues] = useState<Record<string, string>>({});
    const [savingCreate, setSavingCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [savingEdit, setSavingEdit] = useState(false);

    const resolvedCreateFields = typeof createFields === "function" ? createFields(items) : (createFields || []);
    const resolvedEditFields = typeof editFields === "function" ? editFields(items) : (editFields || []);

    const filteredItems = items.filter((item) => {
        if (!customFilters) return true;
        for (const filter of customFilters) {
            const expect = filterValues[filter.key];
            if (expect && expect !== "") {
                const actual = (item[filter.key] ?? "").toString().trim();
                if (actual !== expect) return false;
            }
        }
        return true;
    });

    if (customSort) {
        filteredItems.sort(customSort);
    }

    const load = () => {
        setLoading(true);
        fetchFn(search || undefined, Object.keys(filterValues).length > 0 ? filterValues : undefined)
            .then((d) => {
                setItems(d || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm("ลบรายการนี้?")) return;
        try {
            await deleteFn(id);
            load();
        } catch (e: any) {
            alert(e?.message || "ลบข้อมูลไม่สำเร็จ");
        }
    };

    const openCreateModal = () => {
        if (!resolvedCreateFields.length) return;
        setCreateValues(buildInitialValues(resolvedCreateFields));
        setCreatingItem(true);
    };

    const closeCreateModal = () => {
        if (savingCreate) return;
        setCreatingItem(false);
        setCreateValues({});
    };

    const submitCreate = async () => {
        if (!createFn || !resolvedCreateFields.length) return;

        let payload: any;
        try {
            payload = buildPayloadFromValues(resolvedCreateFields, createValues);
        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSavingCreate(true);
        try {
            await createFn(payload);
            setCreatingItem(false);
            setCreateValues({});
            load();
        } catch (e: any) {
            alert(e?.message || "เพิ่มข้อมูลไม่สำเร็จ");
        } finally {
            setSavingCreate(false);
        }
    };

    const openEditModal = (item: any) => {
        if (!resolvedEditFields.length) return;

        const mappedItem: any = { ...item };

        resolvedEditFields.forEach(field => {
            if (field.type === "select" && field.options) {
                const rawValue = item[field.key];

                if (rawValue == null) {
                    mappedItem[field.key] = "";
                } else {
                    mappedItem[field.key] = String(rawValue);
                }
            }
        });

        setEditingItem(item);
        setEditValues(buildInitialValues(resolvedEditFields, mappedItem));
    };

    const closeEditModal = () => {
        if (savingEdit) return;
        setEditingItem(null);
        setEditValues({});
    };

    const submitEdit = async () => {
        if (!editingItem || !editFn || !resolvedEditFields.length) return;

        let payload: any;
        try {
            payload = buildPayloadFromValues(resolvedEditFields, editValues);

            console.log("EDIT PAYLOAD:", payload); // ✅ debug

        } catch (e: any) {
            alert(e?.message || "ข้อมูลไม่ถูกต้อง");
            return;
        }

        setSavingEdit(true);
        try {
            await editFn(editingItem.id, payload);
            setEditingItem(null);
            setEditValues({});
            load();
        } catch (e: any) {
            console.error(e);
            alert(e?.message || "บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setSavingEdit(false);
        }
    };

    const hasCreate = !!createFn && resolvedCreateFields.length > 0;
    const hasEdit = !!editFn && resolvedEditFields.length > 0;

    return (
        <div className="space-y-6">
            <section className={`bg-gradient-to-br ${color} rounded-3xl p-8 text-white shadow-lg relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">{badgeText || title}</div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-white/70 mt-2">{subtitle} ({filteredItems.length} รายการ)</p>
                </div>
            </section>

            {topContent}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder={searchLabel || "ค้นหา..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && load()}
                    />
                    <button onClick={load} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                        ค้นหา
                    </button>
                    {hasCreate && (
                        <button onClick={openCreateModal} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap">
                            เพิ่ม
                        </button>
                    )}
                </div>
                {customFilters && customFilters.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        {customFilters.map((filter: { key: string; label: string; options: (items: any[]) => string[] }) => (
                            <div key={filter.key} className="flex-1">
                                <label className="text-xs text-slate-500 block mb-1">{filter.label}</label>
                                <select
                                    value={filterValues[filter.key] ?? ""}
                                    onChange={(e) => setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-700"
                                >
                                    <option value="">ทั้งหมด</option>
                                    {filter.options(items).map((opt: string) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">ไม่พบข้อมูล</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ลำดับ</th>
                                {columns.map((c, i) => (
                                    <th key={i} className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                                        {c.label}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item, i) => (
                                <tr key={item.id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                    {columns.map((c, j) => (
                                        <td key={j} className="px-4 py-3 text-sm text-slate-700">
                                            {c.render ? c.render(item[c.key], item) : (item[c.key] ?? "-")}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {hasEdit && (
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="text-xs text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                                                >
                                                    แก้ไข
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium"
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <EditModal
                open={creatingItem && hasCreate}
                title={`เพิ่ม${title}`}
                fields={resolvedCreateFields}
                values={createValues}
                saving={savingCreate}
                onClose={closeCreateModal}
                onChange={(key, value) => setCreateValues((prev) => ({ ...prev, [key]: value }))}
                onSubmit={submitCreate}
                submitLabel="เพิ่ม"
            />

            <EditModal
                open={!!editingItem && hasEdit}
                title={`แก้ไข${title}`}
                fields={resolvedEditFields}
                values={editValues}
                saving={savingEdit}
                onClose={closeEditModal}
                onChange={(key, value) => setEditValues((prev) => ({ ...prev, [key]: value }))}
                onSubmit={submitEdit}
                submitLabel="บันทึก"
            />
        </div>
    );
}
export function TeachersFeature() {
    const [positionOptions, setPositionOptions] = useState<{ id: number; title: string }[]>([]);
    const [subjectGroupOptions, setSubjectGroupOptions] = useState<{ id: number; group_name: string }[]>([]);
    const [gradeLevelOptions, setGradeLevelOptions] = useState<string[]>([]);
    const [roomOptions, setRoomOptions] = useState<string[]>([]);

    useEffect(() => {
        DirectorApiService.getTeacherPositions().then(setPositionOptions).catch(() => { });
        DirectorApiService.getLearningSubjectGroups().then(setSubjectGroupOptions).catch(() => { });
        DirectorApiService.getGradeLevels().then(setGradeLevelOptions).catch(() => { });
        DirectorApiService.getClassrooms().then(setRoomOptions).catch(() => { });
    }, []);

    const posSelectOptions = ["", ...positionOptions.map(p => p.title)];
    const groupSelectOptions = ["", ...subjectGroupOptions.map(g => g.group_name)];

    return (
        <CrudFeature
            title="จัดการครู"
            badgeText="Teachers"
            subtitle="ข้อมูลครูทั้งหมด"
            color="from-emerald-700 to-teal-800"
            fetchFn={(s) => DirectorApiService.getTeachers(s)}
            createFn={(data) => {
                const pos = positionOptions.find(p => p.title === data.position);
                const group = subjectGroupOptions.find(g => g.group_name === data.department);
                return DirectorApiService.createTeacher({
                    ...data,
                    position_id: pos?.id,
                    learning_subject_group_id: group?.id
                });
            }}
            editFn={(id, data) => {
                const pos = positionOptions.find(p => p.title === data.position);
                const group = subjectGroupOptions.find(g => g.group_name === data.department);
                return DirectorApiService.updateTeacher(id, {
                    ...data,
                    position_id: pos?.id,
                    learning_subject_group_id: group?.id
                });
            }}
            deleteFn={(id) => DirectorApiService.deleteTeacher(id)}
            customFilters={[
                {
                    key: "department",
                    label: "กลุ่มสาระ",
                    options: (items) => Array.from(new Set(items.map((t: any) => (t.department ?? "").toString().trim()).filter((v: string) => v.length > 0))).sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "position",
                    label: "ตำแหน่ง",
                    options: (items) => Array.from(new Set(items.map((t: any) => (t.position ?? "").toString().trim()).filter((v: string) => v.length > 0))).sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "advisor_level",
                    label: "ระดับชั้นที่ปรึกษา",
                    options: (items) => Array.from(new Set(items.map((t: any) => (t.advisor_level ?? "").toString().trim()).filter((v: string) => v.length > 0))).sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "advisor_room",
                    label: "ห้อง",
                    options: (items) => Array.from(new Set(items.map((t: any) => (t.advisor_room ?? "").toString().trim()).filter((v: string) => v.length > 0))).sort((a, b) => a.localeCompare(b, "th", { numeric: true })),
                }
            ]}
            createFields={() => {
                return [
                    { key: "teacher_code", label: "Username (รหัสครู)", required: true },
                    { key: "password", label: "Password", type: "password", placeholder: "เว้นว่างเพื่อใช้ค่าเริ่มต้น 1234" },
                    { key: "prefix", label: "คำนำหน้า", type: "select", options: ["เลือกคำนำหน้า", "นาย", "นาง", "นางสาว"] },
                    { key: "first_name", label: "ชื่อ" },
                    { key: "last_name", label: "นามสกุล" },
                    { key: "department", label: "กลุ่มสาระการเรียนรู้", type: "select", options: groupSelectOptions },
                    { key: "position", label: "ตำแหน่ง", type: "select", options: posSelectOptions },
                    { key: "phone", label: "เบอร์โทรศัพท์" },
                    { key: "status", label: "สถานะ", type: "select", options: ["เลือกสถานะ", "ปกติ", "เกษียน"] },
                ];
            }}
            editFields={() => {
                return [
                    { key: "teacher_code", label: "Username (รหัสครู)", required: true },
                    { key: "password", label: "Password", type: "password", placeholder: "เว้นว่างถ้าไม่เปลี่ยนรหัสผ่าน" },
                    { key: "prefix", label: "คำนำหน้า", type: "select", options: ["", "นาย", "นาง", "นางสาว"] },
                    { key: "first_name", label: "ชื่อ" },
                    { key: "last_name", label: "นามสกุล" },
                    { key: "department", label: "กลุ่มสาระการเรียนรู้", type: "select", options: groupSelectOptions },
                    { key: "position", label: "ตำแหน่ง", type: "select", options: posSelectOptions },
                    { key: "phone", label: "เบอร์โทรศัพท์" },
                    { key: "status", label: "สถานะ", type: "select", options: ["เลือกสถานะ", "ปกติ", "เกษียน"] },
                ];
            }}
            columns={[
                { key: "teacher_code", label: "รหัสครู" },
                { key: "first_name", label: "ชื่อ", render: (_, r) => `${r.prefix || ""}${r.first_name || ""} ${r.last_name || ""}` },
                { key: "department", label: "กลุ่มสาระการเรียนรู้" },
                { key: "position", label: "ตำแหน่ง" },
                { key: "advisor_class", label: "ระดับชั้น/ห้อง" },
                { key: "phone", label: "เบอร์โทรศัพท์" },
                { key: "status", label: "สถานะ" },
            ]}
        />
    );
}

export function StudentsFeature() {
    const [counts, setCounts] = useState<any[]>([]);
    const [loadingCounts, setLoadingCounts] = useState(true);
    const [gradeLevelOptions, setGradeLevelOptions] = useState<string[]>([]);
    const [roomOptions, setRoomOptions] = useState<string[]>([]);

    useEffect(() => {
        DirectorApiService.getStudentCount()
            .then(d => { setCounts(d || []); setLoadingCounts(false); })
            .catch(() => setLoadingCounts(false));
        DirectorApiService.getGradeLevels().then(setGradeLevelOptions).catch(() => { });
        DirectorApiService.getClassrooms().then(setRoomOptions).catch(() => { });
    }, []);

    const grouped = counts.reduce((acc: Record<string, { total: number; male: number; female: number }>, r: any) => {
        const key = (r.class_level || "-").toString().trim();
        if (!acc[key]) acc[key] = { total: 0, male: 0, female: 0 };
        acc[key].total += (r.total || 0);
        acc[key].male += (r.male || 0);
        acc[key].female += (r.female || 0);
        return acc;
    }, {});

    const totals = Object.values(grouped).reduce((a, b) => ({
        total: a.total + b.total,
        male: a.male + b.male,
        female: a.female + b.female
    }), { total: 0, male: 0, female: 0 });

    const countSummary = (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-2">
            {Object.entries(grouped).map(([level, data], i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-center">
                    <div className="text-xs text-slate-500 font-medium mb-1">{level}</div>
                    <div className="text-2xl font-bold text-emerald-700">{data.total}</div>
                    <div className="text-[10px] text-slate-400 mb-2">คน</div>
                    <div className="flex justify-center gap-3 text-[11px] border-t border-slate-100 pt-2 mt-1">
                        <div className="text-emerald-600">ชาย: <span className="font-bold">{data.male}</span></div>
                        <div className="text-teal-500">หญิง: <span className="font-bold">{data.female}</span></div>
                    </div>
                </div>
            ))}
            <div className="bg-emerald-600 rounded-2xl p-4 shadow-md text-center text-white">
                <div className="text-xs font-medium mb-1 opacity-80">ทั้งหมด</div>
                <div className="text-2xl font-bold">{totals.total}</div>
                <div className="text-[10px] opacity-80 mb-2">คน</div>
                <div className="flex justify-center gap-3 text-[11px] border-t border-white/20 pt-2 mt-1">
                    <div className="text-emerald-200">ชาย: <span className="font-bold text-white">{totals.male}</span></div>
                    <div className="text-teal-200">หญิง: <span className="font-bold text-white">{totals.female}</span></div>
                </div>
            </div>
        </div>
    );

    return (
        <CrudFeature
            title="ข้อมูลนักเรียน"
            subtitle="จัดการข้อมูลนักเรียนทั้งหมด"
            color="from-emerald-600 to-teal-700"
            topContent={!loadingCounts && countSummary}
            fetchFn={(s) => DirectorApiService.getStudents({ search: s })}
            createFn={(data) => DirectorApiService.createStudent(data)}
            editFn={(id, data) => DirectorApiService.updateStudent(id, data)}
            deleteFn={(id) => DirectorApiService.deleteStudent(id)}
            customFilters={[
                {
                    key: "class_level",
                    label: "ระดับชั้น",
                    options: () => gradeLevelOptions.sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "room",
                    label: "ห้อง",
                    options: () => roomOptions.sort((a, b) => {
                        const na = parseInt(a);
                        const nb = parseInt(b);
                        if (!isNaN(na) && !isNaN(nb)) return na - nb;
                        return a.localeCompare(b, "th");
                    }),
                }
            ]}
            createFields={(items) => {
                const uniqueValues = (key: string) =>
                    Array.from(new Set(
                        (items || [])
                            .map((x: any) => (x[key] ?? "").toString().trim())
                            .filter((v: string) => v.length > 0)
                    )).sort((a, b) => a.localeCompare(b, "th"));

                const classLevelOptions = uniqueValues("class_level");
                const roomOptions = uniqueValues("room");
                const genderOptions = uniqueValues("gender");
                const statusOptions = uniqueValues("status");
                const prefixFromData = uniqueValues("prefix");
                const prefixOptions = Array.from(new Set([
                    "",
                    ...prefixFromData,
                    "เด็กชาย",
                    "เด็กหญิง",
                    "นาย",
                    "นางสาว",
                ]));

                return [
                    { key: "student_code", label: "Username (รหัสนักเรียน)", required: true },
                    { key: "password", label: "Password", type: "password", placeholder: "เว้นว่างเพื่อใช้ค่าเริ่มต้น 1234" },
                    { key: "prefix", label: "คำนำหน้า", type: "select", options: prefixOptions },
                    { key: "first_name", label: "ชื่อ" },
                    { key: "last_name", label: "นามสกุล" },
                    { key: "class_level", label: "ระดับชั้น", type: "select", options: ["", ...classLevelOptions] },
                    { key: "room", label: "ห้อง", type: "select", options: ["", ...roomOptions] },
                    { key: "gender", label: "เพศ", type: "select", options: ["", ...(genderOptions.length ? genderOptions : ["ชาย", "หญิง"])] },
                    { key: "status", label: "สถานะ", type: "select", options: ["", ...statusOptions] },
                    { key: "phone", label: "เบอร์โทรศัพท์" },
                ];
            }}
            editFields={(items) => {
                const uniqueValues = (key: string) =>
                    Array.from(new Set(
                        (items || [])
                            .map((x: any) => (x[key] ?? "").toString().trim())
                            .filter((v: string) => v.length > 0)
                    )).sort((a, b) => a.localeCompare(b, "th"));

                const classLevelOptions = uniqueValues("class_level");
                const roomOptions = uniqueValues("room");
                const genderOptions = uniqueValues("gender");
                const statusOptions = uniqueValues("status");
                const prefixFromData = uniqueValues("prefix");
                const prefixOptions = Array.from(new Set([
                    "",
                    ...prefixFromData,
                    "เด็กชาย",
                    "เด็กหญิง",
                    "นาย",
                    "นางสาว",
                ]));

                return [
                    { key: "student_code", label: "Username (รหัสนักเรียน)", required: true },
                    { key: "password", label: "Password", type: "password", placeholder: "เว้นว่างถ้าไม่เปลี่ยนรหัสผ่าน" },
                    { key: "prefix", label: "คำนำหน้า", type: "select", options: prefixOptions },
                    { key: "first_name", label: "ชื่อ" },
                    { key: "last_name", label: "นามสกุล" },
                    { key: "class_level", label: "ชั้น", type: "select", options: ["", ...classLevelOptions] },
                    { key: "room", label: "ห้อง", type: "select", options: ["", ...roomOptions] },
                    { key: "gender", label: "เพศ", type: "select", options: ["", ...(genderOptions.length ? genderOptions : ["ชาย", "หญิง"])] },
                    { key: "status", label: "สถานะ", type: "select", options: ["", ...statusOptions] },
                    { key: "phone", label: "โทร" },
                ];
            }}
            columns={[
                { key: "student_code", label: "รหัส" },
                { key: "first_name", label: "ชื่อ-สกุล", render: (_, r) => `${r.prefix || ""}${r.first_name || ""} ${r.last_name || ""}` },
                { key: "class_level", label: "ชั้น" },
                { key: "room", label: "ห้อง" },
                { key: "gender", label: "เพศ" },
                { key: "phone", label: "โทร" },
            ]}
        />
    );
}

export function SubjectsFeature() {
    const [groupOptions, setGroupOptions] = useState<string[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [levelOptions, setLevelOptions] = useState<string[]>([]);

    useEffect(() => {
        DirectorApiService.getLearningSubjectGroups().then(rows => setGroupOptions(rows.map(r => r.group_name)));
        DirectorApiService.getSubjectCategories().then(rows => setCategoryOptions(rows.map(r => r.category_name)));
        DirectorApiService.getGradeLevels().then(setLevelOptions);
    }, []);

    return (
        <CrudFeature
            title="โครงสร้างและรายวิชา"
            subtitle="รายวิชาทั้งหมด"
            color="from-emerald-600 to-teal-700"
            fetchFn={(s, f) => DirectorApiService.getSubjects({
                search: s,
                level: f?.level,
                group: f?.group,
                category: f?.category
            })}
            createFn={(data) => DirectorApiService.createSubject(data)}
            editFn={(id, data) => DirectorApiService.updateSubject(id, data)}
            deleteFn={(id) => DirectorApiService.deleteSubject(id)}
            customFilters={[
                {
                    key: "group",
                    label: "กลุ่มสาระ",
                    options: () => groupOptions.sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "category",
                    label: "ประเภท",
                    options: () => categoryOptions.sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "level",
                    label: "ระดับชั้น",
                    options: () => levelOptions.sort((a, b) => a.localeCompare(b, "th")),
                },
            ]}
            createFields={(items) => {
                const uniqueValues = (key: string) =>
                    Array.from(new Set(
                        (items || [])
                            .map((x: any) => (x[key] ?? "").toString().trim())
                            .filter((v: string) => v.length > 0)
                    )).sort((a, b) => a.localeCompare(b, "th"));

                const subjectTypeOptions = uniqueValues("subject_type");
                const subjectGroupOptions = uniqueValues("subject_group");
                const levelOptionsLocal = uniqueValues("level");

                return [
                    { key: "subject_code", label: "รหัสวิชา" },
                    { key: "name", label: "ชื่อวิชา", required: true },
                    { key: "credit", label: "หน่วยกิต", type: "number" },
                    { key: "subject_type", label: "ประเภท", type: "select", options: ["", ...subjectTypeOptions] },
                    { key: "subject_group", label: "กลุ่มสาระการเรียนรู้", type: "select", options: ["", ...subjectGroupOptions] },
                    { key: "level", label: "ระดับชั้น", type: "select", options: ["", ...levelOptions] },
                ];
            }}
            editFields={(items) => {
                const uniqueValues = (key: string) =>
                    Array.from(new Set(
                        (items || [])
                            .map((x: any) => (x[key] ?? "").toString().trim())
                            .filter((v: string) => v.length > 0)
                    )).sort((a, b) => a.localeCompare(b, "th"));

                const subjectTypeOptions = uniqueValues("subject_type");
                const subjectGroupOptions = uniqueValues("subject_group");
                const levelOptionsLocal = uniqueValues("level");

                return [
                    { key: "subject_code", label: "รหัสวิชา" },
                    { key: "name", label: "ชื่อวิชา" },
                    { key: "credit", label: "หน่วยกิต", type: "number" },
                    { key: "subject_type", label: "ประเภท", type: "select", options: ["", ...subjectTypeOptions] },
                    { key: "subject_group", label: "กลุ่มสาระการเรียนรู้", type: "select", options: ["", ...subjectGroupOptions] },
                    { key: "level", label: "ระดับชั้น", type: "select", options: ["", ...levelOptions] },
                ];

            }}
            columns={[
                { key: "subject_code", label: "รหัสวิชา" },
                { key: "name", label: "ชื่อวิชา" },
                { key: "credit", label: "หน่วยกิต" },
                { key: "subject_type", label: "ประเภท" },
                { key: "subject_group", label: "กลุ่มสาระการเรียนรู้" },
                { key: "level", label: "ระดับชั้น" },
            ]}
            customSort={(a, b) => {
                // 1. Sort by Subject Code (ก-ฮ)
                const codeA = String(a.subject_code || "");
                const codeB = String(b.subject_code || "");
                if (codeA !== codeB) return codeA.localeCompare(codeB, "th");

                // 2. Sort by Credit (0, 0.5, 1, 1.5)
                const creditA = Number(a.credit || 0);
                const creditB = Number(b.credit || 0);
                if (creditA !== creditB) return creditA - creditB;

                // 3. Sort by Level (ม.1-ม.6)
                const levelA = String(a.level || "");
                const levelB = String(b.level || "");
                return levelA.localeCompare(levelB, "th");
            }}
        />
    );
}

export function ProjectsFeature() {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [projectTypes, setProjectTypes] = useState<any[]>([]);
    const [budgetTypes, setBudgetTypes] = useState<any[]>([]);

    useEffect(() => {
        DirectorApiService.getTeachers().then(setTeachers).catch(() => { });
        DirectorApiService.getProjectTypes().then(setProjectTypes).catch(() => { });
        DirectorApiService.getBudgetTypes().then(setBudgetTypes).catch(() => { });
    }, []);

    const teacherOptions = [
        { id: "", label: "-" },
        ...teachers.map(t => ({
            id: t.id,
            label: `${t.prefix || ""}${t.first_name || ""} ${t.last_name || ""}`
        }))
    ];

    const ptOptions = projectTypes.map(p => ({ id: p.id, label: p.name }));
    const btOptions = budgetTypes.map(b => ({ id: b.id, label: b.name }));

    return (
        <CrudFeature
            title="โครงการ"
            badgeText="Projects"
            subtitle="จัดการโครงการ"
            color="from-emerald-700 to-teal-800"
            fetchFn={() => DirectorApiService.getProjects()}
            createFn={(data) => {
                const teacher = teacherOptions.find(o => o.label === data.teacher_id);
                const pType = ptOptions.find(o => o.label === data.project_type);
                const bType = btOptions.find(o => o.label === data.budget_type);
                return DirectorApiService.createProject({
                    ...data,
                    teacher_id: teacher?.id,
                    project_type_id: pType?.id,
                    budget_type_id: bType?.id
                });
            }}
            editFn={(id, data) => {
                const teacher = teacherOptions.find(o => o.label === data.teacher_id);
                const pType = ptOptions.find(o => o.label === data.project_type);
                const bType = btOptions.find(o => o.label === data.budget_type);
                return DirectorApiService.updateProject(id, {
                    ...data,
                    teacher_id: teacher?.id,
                    project_type_id: pType?.id,
                    budget_type_id: bType?.id
                });
            }}
            deleteFn={(id) => DirectorApiService.deleteProject(id)}
            createFields={() => [
                { key: "name", label: "ชื่อโครงการ", required: true },
                { key: "project_type", label: "ประเภท", type: "select", options: ["", ...ptOptions.map(o => o.label)] },
                { key: "teacher_id", label: "ครูผู้รับผิดชอบ", type: "select", options: teacherOptions.map(o => o.label) },
                { key: "year", label: "ปี", type: "number" },
                { key: "description", label: "วัตถุประสงค์", multiline: true },
                { key: "budget_type", label: "ประเภทงบ", type: "select", options: ["", ...btOptions.map(o => o.label)] },
                { key: "budget_total", label: "งบประมาณรวม", type: "number" },
                { key: "budget_used_sem1", label: "ใช้ไป เทอม 1", type: "number" },
                { key: "budget_used_sem2", label: "ใช้ไป เทอม 2", type: "number" },
            ]}
            editFields={() => [
                { key: "name", label: "ชื่อโครงการ", required: true },
                { key: "project_type", label: "ประเภท", type: "select", options: ["", ...ptOptions.map(o => o.label)] },
                { key: "teacher_id", label: "ครูผู้รับผิดชอบ", type: "select", options: teacherOptions.map(o => o.label) },
                { key: "year", label: "ปี", type: "number" },
                { key: "description", label: "วัตถุประสงค์", multiline: true },
                { key: "budget_type", label: "ประเภทงบ", type: "select", options: ["", ...btOptions.map(o => o.label)] },
                { key: "budget_total", label: "งบประมาณรวม", type: "number" },
                { key: "budget_used_sem1", label: "ใช้ไป เทอม 1", type: "number" },
                { key: "budget_used_sem2", label: "ใช้ไป เทอม 2", type: "number" },
            ]}
            columns={[
                { key: "name", label: "ชื่อโครงการ" },
                { key: "project_type", label: "ประเภท" },
                { key: "teacher_name", label: "ผู้รับผิดชอบ" },
                {
                    key: "budget_total",
                    label: "งบ",
                    render: (v) => v ? Number(v).toLocaleString("th-TH") : "0"
                },
                {
                    key: "budget_used_sem1",
                    label: "ใช้ เทอม 1",
                    render: (v) => v ? Number(v).toLocaleString("th-TH") : "0"
                },
                {
                    key: "budget_used_sem2",
                    label: "ใช้ เทอม 2",
                    render: (v) => v ? Number(v).toLocaleString("th-TH") : "0"
                },
                {
                    key: "year",
                    label: "ปี",
                },
            ]}
        />
    );
}

export function FinanceFeature() {
    const [projects, setProjects] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        DirectorApiService.getProjects().then(setProjects).catch(() => { });
        DirectorApiService.getExpenseCategories().then(setCategories).catch(() => { });
    }, []);

    const projectOptions = projects.map(p => ({ id: p.id, label: p.name }));
    const categoryOptions = categories.map(c => ({ id: c.id, label: c.name }));

    return (
        <CrudFeature
            title="งบประมาณ"
            subtitle="บันทึกรายรับ-รายจ่ายโครงการ"
            color="from-blue-600 to-indigo-700"
            fetchFn={() => DirectorApiService.getFinanceRecords()}
            createFn={(data) => {
                const project = projectOptions.find(o => o.label === data.project_id);
                const category = categoryOptions.find(o => o.label === data.category_id);
                return DirectorApiService.createFinanceRecord({
                    ...data,
                    project_id: project?.id,
                    category_id: category?.id
                });
            }}
            editFn={(id, data) => {
                const project = projectOptions.find(o => o.label === data.project_id);
                const category = categoryOptions.find(o => o.label === data.category_id);
                return DirectorApiService.updateFinanceRecord(id, {
                    ...data,
                    project_id: project?.id,
                    category_id: category?.id
                });
            }}
            deleteFn={(id) => DirectorApiService.deleteFinanceRecord(id)}
            createFields={() => [
                { key: "project_id", label: "โครงการ", type: "select", options: ["", ...projectOptions.map(o => o.label)], required: true },
                { key: "title", label: "รายการ", required: true },
                { key: "category_id", label: "หมวดหมู่", type: "select", options: ["", ...categoryOptions.map(o => o.label)] },
                { key: "amount", label: "จำนวนเงิน", type: "number", required: true },
                { key: "date", label: "วันที่เบิกจ่าย", type: "date" },
                { key: "receipt_number", label: "เลขที่ใบเสร็จ" },
            ]}
            editFields={() => [
                { key: "project_id", label: "โครงการ", type: "select", options: ["", ...projectOptions.map(o => o.label)], required: true },
                { key: "title", label: "รายการ", required: true },
                { key: "category_id", label: "หมวดหมู่", type: "select", options: ["", ...categoryOptions.map(o => o.label)] },
                { key: "amount", label: "จำนวนเงิน", type: "number", required: true },
                { key: "date", label: "วันที่เบิกจ่าย", type: "date" },
                { key: "receipt_number", label: "เลขที่ใบเสร็จ" },
            ]}
            columns={[
                { key: "date", label: "วันที่", render: (v) => v ? new Date(v).toLocaleDateString('th-TH') : '-' },
                { key: "project_name", label: "โครงการ" },
                { key: "title", label: "รายการ" },
                { key: "category_name", label: "หมวดหมู่" },
                { key: "amount", label: "จำนวนเงิน", render: (v) => (v ? `${Number(v).toLocaleString('th-TH')} ฿` : '0 ฿') },
                { key: "receipt_number", label: "เลขที่ใบเสร็จ" },
            ]}
        />
    );
}

export function ActivitiesFeature() {
    const [teacherOptions, setTeacherOptions] = useState<{ id: number; label: string }[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<{ id: number; label: string }[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = useState<{ id: number; label: string }[]>([]);

    useEffect(() => {
        DirectorApiService.getTeachers().then(rows => {
            setTeacherOptions(rows.map(r => ({ 
                id: r.id, 
                label: `${r.prefix || ''}${r.first_name} ${r.last_name}` 
            })));
        });
        DirectorApiService.getDepartmentsLookup().then(rows => {
            setDepartmentOptions(rows.map(r => ({ id: r.id, label: r.department_name })));
        });
        DirectorApiService.getEventTypesLookup().then(rows => {
            setEventTypeOptions(rows.map(r => ({ id: r.id, label: r.name })));
        });
    }, []);

    return (
        <CrudFeature
            title="กิจกรรม"
            badgeText="Activities"
            subtitle="จัดการปฏิทินกิจกรรมโรงเรียน"
            color="from-purple-600 to-indigo-700"
            fetchFn={() => DirectorApiService.getActivities()}
            createFn={(data) => {
                const teacherObj = teacherOptions.find(o => o.label === data.teacher_name);
                const deptObj = departmentOptions.find(o => o.label === data.department_name);
                const typeObj = eventTypeOptions.find(o => o.label === data.event_type_name);
                return DirectorApiService.createActivity({
                    ...data,
                    teacher_id: teacherObj?.id,
                    department_id: deptObj?.id,
                    event_type_id: typeObj?.id
                });
            }}
            editFn={(id, data) => {
                const teacherObj = teacherOptions.find(o => o.label === data.teacher_name);
                const deptObj = departmentOptions.find(o => o.label === data.department_name);
                const typeObj = eventTypeOptions.find(o => o.label === data.event_type_name);
                return DirectorApiService.updateActivity(id, {
                    ...data,
                    teacher_id: teacherObj?.id,
                    department_id: deptObj?.id,
                    event_type_id: typeObj?.id
                });
            }}
            deleteFn={(id) => DirectorApiService.deleteActivity(id)}
            createFields={() => [
                { key: "name", label: "ชื่อกิจกรรม", required: true },
                { key: "event_type_name", label: "ประเภทกิจกรรม", type: "select", options: ["", ...eventTypeOptions.map(o => o.label)] },
                { key: "teacher_name", label: "ครูที่รับผิดชอบ", type: "select", options: ["", ...teacherOptions.map(o => o.label)] },
                { key: "department_name", label: "ฝ่ายที่รับผิดชอบ", type: "select", options: ["", ...departmentOptions.map(o => o.label)] },
                { key: "note", label: "รายละเอียด", multiline: true },
                { key: "start_date", label: "วันที่เริ่ม", type: "date", required: true },
                { key: "start_time", label: "เวลาเริ่ม", type: "time" },
                { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
                { key: "end_time", label: "เวลาสิ้นสุด", type: "time" },
                { key: "location", label: "สถานที่" },
                { key: "visibility", label: "การมองเห็น", type: "select", options: ["public", "internal", "private"] },
            ]}
            editFields={() => [
                { key: "name", label: "ชื่อกิจกรรม", required: true },
                { key: "event_type_name", label: "ประเภทกิจกรรม", type: "select", options: ["", ...eventTypeOptions.map(o => o.label)] },
                { key: "teacher_name", label: "ครูที่รับผิดชอบ", type: "select", options: ["", ...teacherOptions.map(o => o.label)] },
                { key: "department_name", label: "ฝ่ายที่รับผิดชอบ", type: "select", options: ["", ...departmentOptions.map(o => o.label)] },
                { key: "note", label: "รายละเอียด", multiline: true },
                { key: "start_date", label: "วันที่เริ่ม", type: "date", required: true },
                { key: "start_time", label: "เวลาเริ่ม", type: "time" },
                { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
                { key: "end_time", label: "เวลาสิ้นสุด", type: "time" },
                { key: "location", label: "สถานที่" },
                { key: "visibility", label: "การมองเห็น", type: "select", options: ["public", "internal", "private"] },
            ]}
            columns={[
                { 
                    key: "date", 
                    label: "วันที่", 
                    render: (v) => v ? new Date(v).toLocaleString('th-TH', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '-' 
                },
                { key: "name", label: "ชื่อกิจกรรม" },
                { key: "event_type_name", label: "ประเภท" },
                { key: "teacher_name", label: "ผู้รับผิดชอบ" },
                { key: "department_name", label: "ฝ่าย" },
                { key: "location", label: "สถานที่" },
                { key: "visibility", label: "การมองเห็น" },
            ]}
        />
    );
}

