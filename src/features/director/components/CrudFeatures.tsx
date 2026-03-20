"use client";
import React, { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";
import { ActivitiesCalendar } from "./ActivitiesCalendar";
import { List as ListIcon, Calendar as CalendarIcon } from "lucide-react";

export type CrudColumn = {
    key: string;
    label: string;
    render?: (v: any, row: any, extra: { toggleExpand: () => void; isExpanded: boolean }) => any;
};

export type EditField = {
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "select" | "password" | "time";
    options?: string[] | ((values: Record<string, string>) => string[]);
    labels?: string[] | ((values: Record<string, string>) => string[]);
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

export function buildInitialValues(fields: EditField[], source?: any) {
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
            const opts = typeof field.options === "function" ? field.options({}) : (field.options || []);
            nextValues[field.key] = opts[0] ?? "";
        } else {
            nextValues[field.key] = "";
        }
    }

    return nextValues;
}

export function buildPayloadFromValues(fields: EditField[], values: Record<string, string>) {
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

export function EditModal({
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
                        {fields.map((field) => {
                            const resolvedOptions = typeof field.options === "function" ? field.options(values) : (field.options || []);
                            return (
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
                                            {resolvedOptions.map((opt, idx) => {
                                                const resolvedLabels = typeof field.labels === "function" ? field.labels(values) : field.labels;
                                                return (
                                                    <option key={`${field.key}-${opt || "empty"}`} value={opt}>
                                                        {resolvedLabels && resolvedLabels[idx] !== undefined ? resolvedLabels[idx] : (opt === "" ? "ทั้งหมด" : opt)}
                                                    </option>
                                                );
                                            })}
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
                            );
                        })}
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
    renderDetail,
    searchRightContent,
    initialEditItem,
    onCloseModal,
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
    renderDetail?: (item: any) => React.ReactNode;
    searchRightContent?: React.ReactNode;
    initialEditItem?: any;
    onCloseModal?: () => void;
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
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        if (initialEditItem) {
            openEditModal(initialEditItem);
        }
    }, [initialEditItem]);

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

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
        onCloseModal?.();
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
            onCloseModal?.();
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
        onCloseModal?.();
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
            onCloseModal?.();
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
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                    <p className="text-white/70 mt-2">{subtitle} ({filteredItems.length} รายการ)</p>
                </div>
            </section>

            {topContent}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                    <div className="flex flex-1 w-full gap-3">
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
                    {searchRightContent && (
                        <div className="shrink-0">
                            {searchRightContent}
                        </div>
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
                            {filteredItems.map((item, i) => {
                                const isExpanded = expandedId === item.id;
                                return (
                                    <React.Fragment key={item.id || i}>
                                        <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isExpanded ? "bg-slate-50" : ""}`}>
                                            <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                            {columns.map((c, j) => (
                                                <td key={j} className="px-4 py-3 text-sm text-slate-700">
                                                    {c.render ? c.render(item[c.key], item, { toggleExpand: () => toggleExpand(item.id), isExpanded }) : (item[c.key] ?? "-")}
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
                                        {isExpanded && (
                                            <tr className="bg-slate-50/70">
                                                <td colSpan={columns.length + 2} className="p-0 border-b border-slate-200">
                                                    <div className="px-8 py-6 animate-in slide-in-from-top-2 duration-300">
                                                        {renderDetail ? renderDetail(item) : (
                                                            <div className="text-xs text-slate-500 bg-white p-4 rounded-xl border border-slate-100">
                                                                <pre className="overflow-auto max-w-full">
                                                                    {JSON.stringify(item, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
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
                    label: "กลุ่มสาระการเรียนรู้",
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
                { key: "advisor_class", label: "ครูที่ปรึกษา" },
                { key: "phone", label: "เบอร์โทรศัพท์" },
                { key: "status", label: "สถานะ" },
            ]}
            customSort={(a, b) => {
                // 0. Priority: Advisor vs Non-Advisor
                const isAdvisorA = !!a.advisor_level;
                const isAdvisorB = !!b.advisor_level;
                
                if (isAdvisorA !== isAdvisorB) {
                    return isAdvisorA ? -1 : 1; // Advisor comes first
                }

                // 1. Sort by Advisor Level
                const levelA = String(a.advisor_level || "");
                const levelB = String(b.advisor_level || "");
                if (levelA !== levelB) {
                    return levelA.localeCompare(levelB, "th", { numeric: true });
                }

                // 2. Sort by Advisor Room Numerically
                const roomA = parseInt(a.advisor_room || "0");
                const roomB = parseInt(b.advisor_room || "0");
                if (roomA !== roomB) return roomA - roomB;
                
                // 3. Fallback to teacher code
                return String(a.teacher_code || "").localeCompare(String(b.teacher_code || ""));
            }}
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
                group: f?.subject_group,
                category: f?.subject_type
            })}
            createFn={(data) => DirectorApiService.createSubject(data)}
            editFn={(id, data) => DirectorApiService.updateSubject(id, data)}
            deleteFn={(id) => DirectorApiService.deleteSubject(id)}
            customFilters={[
                {
                    key: "subject_group",
                    label: "กลุ่มสาระ",
                    options: () => groupOptions.sort((a, b) => a.localeCompare(b, "th")),
                },
                {
                    key: "subject_type",
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
    const [academicYears, setAcademicYears] = useState<{ id: number; year_name: string }[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        DirectorApiService.getTeachers().then(setTeachers).catch(() => { });
        DirectorApiService.getProjectTypes().then(setProjectTypes).catch(() => { });
        DirectorApiService.getBudgetTypes().then(setBudgetTypes).catch(() => { });
        DirectorApiService.getAcademicYears().then(setAcademicYears).catch(() => { });
        DirectorApiService.getDepartments().then(setDepartments).catch(() => { });
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
            fetchFn={(s, f) => DirectorApiService.getProjects(s, f?.year ? Number(f.year) : undefined)}
            createFn={(data) => {
                const pType = ptOptions.find(o => o.label === data.project_type);
                const bType = btOptions.find(o => o.label === data.budget_type);
                return DirectorApiService.createProject({
                    ...data,
                    teacher_id: data.teacher_id ? Number(data.teacher_id) : null,
                    department_id: data.department_id ? Number(data.department_id) : null,
                    project_type_id: pType?.id,
                    budget_type_id: bType?.id
                });
            }}
            editFn={(id, data) => {
                const pType = ptOptions.find(o => o.label === data.project_type);
                const bType = btOptions.find(o => o.label === data.budget_type);
                return DirectorApiService.updateProject(id, {
                    ...data,
                    teacher_id: data.teacher_id ? Number(data.teacher_id) : null,
                    department_id: data.department_id ? Number(data.department_id) : null,
                    project_type_id: pType?.id,
                    budget_type_id: bType?.id
                });
            }}
            deleteFn={(id) => DirectorApiService.deleteProject(id)}
            createFields={() => [
                { key: "name", label: "ชื่อโครงการ", required: true },
                { key: "project_type", label: "ประเภท", type: "select", options: ["", ...ptOptions.map(o => o.label)] },
                {
                    key: "department_id",
                    label: "ฝ่ายที่รับผิดชอบ",
                    type: "select",
                    options: ["", ...departments.map(d => d.id.toString())],
                    labels: ["ทั้งหมด", ...departments.map(d => d.department_name)]
                },
                {
                    key: "teacher_id",
                    label: "ครูผู้รับผิดชอบ",
                    type: "select",
                    options: (values: Record<string, string>) => {
                        const deptId = values.department_id;
                        const filtered = deptId
                            ? teachers.filter(t => String(t.department_id) === String(deptId))
                            : teachers;
                        return ["", ...filtered.map(t => t.id.toString())];
                    },
                    labels: (values: Record<string, string>) => {
                        const deptId = values.department_id;
                        const filtered = deptId
                            ? teachers.filter(t => String(t.department_id) === String(deptId))
                            : teachers;
                        return ["ทั้งหมด", ...filtered.map(t => `${t.prefix_id ? (t.name_prefixes?.prefix_name || '') : ''}${t.first_name} ${t.last_name}`)];
                    }
                },
                { key: "year", label: "ปีการศึกษา", type: "select", options: ["", ...academicYears.map(ay => ay.id.toString())], labels: ["ทั้งหมด", ...academicYears.map(ay => ay.year_name)] },
                { key: "start_date", label: "วันที่เริ่ม", type: "date" },
                { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
                { key: "description", label: "วัตถุประสงค์", multiline: true },
                { key: "budget_type", label: "ประเภทงบ", type: "select", options: ["", ...btOptions.map(o => o.label)] },
                { key: "budget_total", label: "งบประมาณรวมทั้งหมด", type: "number" },
                { key: "budget_used_sem1", label: "งบประมาณภาคเรียนที่ 1", type: "number" },
                { key: "budget_used_sem2", label: "งบประมาณภาคเรียนที่ 2", type: "number" },
            ]}
            editFields={() => [
                { key: "name", label: "ชื่อโครงการ", required: true },
                { key: "project_type", label: "ประเภท", type: "select", options: ["", ...ptOptions.map(o => o.label)] },
                {
                    key: "department_id",
                    label: "ฝ่ายที่รับผิดชอบ",
                    type: "select",
                    options: ["", ...departments.map(d => d.id.toString())],
                    labels: ["ทั้งหมด", ...departments.map(d => d.department_name)]
                },
                {
                    key: "teacher_id",
                    label: "ครูผู้รับผิดชอบ",
                    type: "select",
                    options: (values: Record<string, string>) => {
                        const deptId = values.department_id;
                        const filtered = deptId
                            ? teachers.filter(t => String(t.department_id) === String(deptId))
                            : teachers;
                        return ["", ...filtered.map(t => t.id.toString())];
                    },
                    labels: (values: Record<string, string>) => {
                        const deptId = values.department_id;
                        const filtered = deptId
                            ? teachers.filter(t => String(t.department_id) === String(deptId))
                            : teachers;
                        return ["ทั้งหมด", ...filtered.map(t => `${t.prefix_id ? (t.name_prefixes?.prefix_name || '') : ''}${t.first_name} ${t.last_name}`)];
                    }
                },
                { key: "year", label: "ปีการศึกษา", type: "select", options: ["", ...academicYears.map(ay => ay.id.toString())], labels: ["ทั้งหมด", ...academicYears.map(ay => ay.year_name)] },
                { key: "start_date", label: "วันที่เริ่ม", type: "date" },
                { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
                { key: "description", label: "วัตถุประสงค์", multiline: true },
                { key: "budget_type", label: "ประเภทงบ", type: "select", options: ["", ...btOptions.map(o => o.label)] },
                { key: "budget_total", label: "งบประมาณรวม", type: "number" },
                { key: "budget_used_sem1", label: "ใช้ไป เทอม 1", type: "number" },
                { key: "budget_used_sem2", label: "ใช้ไป เทอม 2", type: "number" },
            ]}
            columns={[
                {
                    key: "name",
                    label: "ชื่อโครงการ",
                    render: (v, _, { toggleExpand, isExpanded }) => (
                        <button
                            onClick={toggleExpand}
                            className="text-left font-semibold text-slate-800 hover:text-emerald-700 flex items-center gap-2 group transition-colors"
                        >
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                                ▾
                            </span>
                            <span className="group-hover:underline">{v}</span>
                        </button>
                    )
                },
                { key: "project_type", label: "ประเภท" },
                { key: "teacher_name", label: "ผู้รับผิดชอบ" },
                {
                    key: "budget_total",
                    label: "งบทั้งหมด",
                    render: (v) => v ? Number(v).toLocaleString("th-TH") : "0"
                },
                {
                    key: "year_label",
                    label: "ปีการศึกษา",
                },
            ]}
            renderDetail={(item) => (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white p-7 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 opacity-20 -mr-10 -mt-10 rounded-full"></div>

                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">ฝ่ายที่รับผิดชอบ</p>
                        <p className="text-base font-bold text-slate-800">{item.department || "-"}</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">ประเภทงบประมาณ</p>
                        <p className="text-base font-bold text-slate-800">{item.budget_type || "-"}</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">ระยะเวลาดำเนินงาน</p>
                        <p className="text-base font-bold text-slate-800">
                            {item.start_date ? new Date(item.start_date).toLocaleDateString("th-TH") : "-"}
                            <span className="mx-2 text-slate-300">-</span>
                            {item.end_date ? new Date(item.end_date).toLocaleDateString("th-TH") : "-"}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                        <p className="text-xs font-semibold text-slate-500">งบประมาณภาคเรียนที่ 1</p>
                        <p className="text-lg font-bold text-emerald-600">{(item.budget_used_sem1 || 0).toLocaleString("th-TH")} <span className="text-sm font-normal text-slate-500">บาท</span></p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                        <p className="text-xs font-semibold text-slate-500">งบประมาณภาคเรียนที่ 2</p>
                        <p className="text-lg font-bold text-emerald-600">{(item.budget_used_sem2 || 0).toLocaleString("th-TH")} <span className="text-sm font-normal text-slate-500">บาท</span></p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-600 text-white flex flex-col gap-1.5 shadow-md shadow-emerald-200">
                        <p className="text-xs font-semibold text-emerald-100">งบประมาณใช้ไปรวมทั้งสิ้น</p>
                        <p className="text-xl font-bold">{((Number(item.budget_used_sem1) || 0) + (Number(item.budget_used_sem2) || 0)).toLocaleString("th-TH")} <span className="text-sm font-normal text-emerald-100">บาท</span></p>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 space-y-3 pt-5 border-t border-slate-100 mt-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <p className="text-xs font-semibold text-slate-500">วัตถุประสงค์และรายละเอียดโครงการ</p>
                        </div>
                        <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-emerald-100 font-medium">
                            {item.description || "— ไม่ระบุวัตถุประสงค์โครงการ —"}
                        </p>
                    </div>
                </div>
            )}
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
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [teacherOptions, setTeacherOptions] = useState<{ id: number; label: string }[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<{ id: number; label: string }[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = useState<{ id: number; label: string }[]>([]);
    const [pendingEditItem, setPendingEditItem] = useState<any | null>(null);
    const [calendarDetailItem, setCalendarDetailItem] = useState<any | null>(null);
    const [calendarEditItem, setCalendarEditItem] = useState<any | null>(null);
    const [calendarEditValues, setCalendarEditValues] = useState<Record<string, string>>({});
    const [savingCalendarEdit, setSavingCalendarEdit] = useState(false);
    const [calendarKey, setCalendarKey] = useState(0); // For forcing refresh

    const activityFields: EditField[] = [
        { key: "name", label: "ชื่อกิจกรรม", required: true },
        { key: "event_type_name", label: "ประเภทกิจกรรม", type: "select", options: ["", ...eventTypeOptions.map(o => o.label)] },
        { key: "department_name", label: "ฝ่ายที่รับผิดชอบ", type: "select", options: ["", ...departmentOptions.map(o => o.label)] },
        { 
            key: "teacher_name", 
            label: "ครูที่รับผิดชอบ", 
            type: "select", 
            options: (values) => {
                const dept = values.department_name;
                const teachers = (teacherOptions as any[]);
                if (!dept) return ["", ...teachers.map(o => o.label)];
                const filtered = teachers.filter(o => o.dept === dept || o.dept === "" || !o.dept);
                return ["", ...filtered.map(o => o.label)];
            }
        },
        { key: "start_date", label: "วันที่เริ่ม", type: "date", required: true },
        { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
        { key: "start_time", label: "เวลาเริ่ม", type: "time" },
        { key: "end_time", label: "เวลาสิ้นสุด", type: "time" },
        { key: "location", label: "สถานที่" },
        { key: "visibility", label: "การเข้าร่วม", type: "select", options: ["public", "internal", "private"] },
        { key: "note", label: "รายละเอียด", multiline: true },
    ];

    const openCalendarDetail = (item: any) => {
        setCalendarDetailItem(item);
    };

    const openCalendarEdit = (item: any) => {
        const mappedItem: any = { ...item };
        activityFields.forEach(field => {
            if (field.type === "select") {
                mappedItem[field.key] = item[field.key] == null ? "" : String(item[field.key]);
            }
        });
        setCalendarDetailItem(null);
        setCalendarEditItem(item);
        setCalendarEditValues(buildInitialValues(activityFields, mappedItem));
    };

    const saveCalendarEdit = async () => {
        if (!calendarEditItem) return;
        try {
            const payload = buildPayloadFromValues(activityFields, calendarEditValues);
            const teacherObj = teacherOptions.find(o => o.label === calendarEditValues.teacher_name);
            const deptObj = departmentOptions.find(o => o.label === calendarEditValues.department_name);
            const typeObj = eventTypeOptions.find(o => o.label === calendarEditValues.event_type_name);

            setSavingCalendarEdit(true);
            await DirectorApiService.updateActivity(calendarEditItem.id, {
                ...payload,
                teacher_id: teacherObj?.id,
                department_id: deptObj?.id,
                event_type_id: typeObj?.id
            });
            setCalendarEditItem(null);
            setCalendarKey(prev => prev + 1); // Refresh calendar
        } catch (e: any) {
            alert(e?.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSavingCalendarEdit(false);
        }
    };

    useEffect(() => {
        DirectorApiService.getTeachers().then(rows => {
            setTeacherOptions(rows.map(r => ({
                id: r.id,
                label: `${r.prefix || ''}${r.first_name} ${r.last_name}`,
                dept: (r as any).departments?.department_name || ''
            })));
        });
        DirectorApiService.getDepartmentsLookup().then(rows => {
            setDepartmentOptions(rows.map(r => ({ id: r.id, label: r.department_name })));
        });
        DirectorApiService.getEventTypesLookup().then(rows => {
            setEventTypeOptions(rows.map(r => ({ id: r.id, label: r.name })));
        });
    }, []);

    const switcher = (
        <div className="flex justify-end p-1">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ListIcon size={16} />
                    รายการ
                </button>
                <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'calendar'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <CalendarIcon size={16} />
                    ปฏิทิน
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {viewMode === 'list' ? (
                <CrudFeature
                    title="กิจกรรม"
                    badgeText="Activities"
                    subtitle="จัดการปฏิทินกิจกรรมโรงเรียน"
                    color="from-purple-600 to-indigo-700"
                    searchRightContent={switcher}
                    initialEditItem={pendingEditItem}
                    onCloseModal={() => setPendingEditItem(null)}
                    fetchFn={(s) => DirectorApiService.getActivities(s)}
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
                    createFields={() => activityFields}
                    editFields={() => activityFields}
                    renderDetail={(item) => (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500">วันที่เริ่มกิจกรรม</p>
                                <p className="text-base font-bold text-slate-800">
                                    {item.date ? new Date(item.date).toLocaleDateString("th-TH") : "-"}
                                    {item.start_time && <span className="ml-2 text-indigo-600">({item.start_time})</span>}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500">วันที่สิ้นสุดกิจกรรม</p>
                                <p className="text-base font-bold text-slate-800">
                                    {item.end_date ? new Date(item.end_date).toLocaleDateString("th-TH") : "-"}
                                    {item.end_time && <span className="ml-2 text-indigo-600">({item.end_time})</span>}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500">ฝ่ายที่รับผิดชอบ</p>
                                <p className="text-base font-bold text-slate-800">{item.department_name || "-"}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500">สถานที่</p>
                                <p className="text-base font-bold text-slate-800">{item.location || "-"}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500">การเข้าร่วม</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.visibility === 'public' ? 'bg-emerald-100 text-emerald-700' :
                                        item.visibility === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    {item.visibility || "public"}
                                </span>
                            </div>

                            <div className="md:col-span-2 lg:col-span-3 space-y-3 pt-5 border-t border-slate-100 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    <p className="text-xs font-semibold text-slate-500">รายละเอียดกิจกรรม</p>
                                </div>
                                <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-indigo-100 font-medium">
                                    {item.note || "— ไม่ระบุรายละเอียดเพิ่มเติม —"}
                                </p>
                            </div>
                        </div>
                    )}
                    columns={[
                        {
                            key: "name",
                            label: "ชื่อกิจกรรม",
                            render: (v, _, { toggleExpand, isExpanded }) => (
                                <button
                                    onClick={toggleExpand}
                                    className="text-left font-semibold text-slate-800 hover:text-indigo-700 flex items-center gap-2 group transition-colors"
                                >
                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                                        ▾
                                    </span>
                                    <span className="group-hover:underline">{v}</span>
                                </button>
                            )
                        },
                        { key: "event_type_name", label: "ประเภท" },
                        { key: "teacher_name", label: "ผู้รับผิดชอบ" },
                        { key: "location", label: "สถานที่" },
                    ]}
                />
            ) : (
                <ActivitiesCalendar
                    key={calendarKey}
                    onAddClick={() => setViewMode('list')}
                    onBack={() => setViewMode('list')}
                    onEditClick={openCalendarDetail}
                />
            )}

            {/* Calendar Detail Modal (read-only) */}
            {calendarDetailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCalendarDetailItem(null)} />
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium bg-white/20 inline-block px-2 py-0.5 rounded-full mb-2">
                                        {calendarDetailItem.event_type_name || 'กิจกรรม'}
                                    </div>
                                    <h3 className="text-xl font-black text-white leading-tight">{calendarDetailItem.name}</h3>
                                </div>
                                <button onClick={() => setCalendarDetailItem(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">วันที่เริ่ม</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {calendarDetailItem.date ? new Date(calendarDetailItem.date).toLocaleDateString('th-TH', {day:'numeric',month:'long',year:'numeric'}) : '-'}
                                        {calendarDetailItem.start_time && <span className="ml-1 text-emerald-600">({calendarDetailItem.start_time})</span>}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">วันที่สิ้นสุด</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {calendarDetailItem.end_date ? new Date(calendarDetailItem.end_date).toLocaleDateString('th-TH', {day:'numeric',month:'long',year:'numeric'}) : '-'}
                                        {calendarDetailItem.end_time && <span className="ml-1 text-emerald-600">({calendarDetailItem.end_time})</span>}
                                    </p>
                                </div>
                                {calendarDetailItem.location && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">สถานที่</p>
                                        <p className="text-sm font-bold text-slate-800">{calendarDetailItem.location}</p>
                                    </div>
                                )}
                                {calendarDetailItem.department_name && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">ฝ่ายที่รับผิดชอบ</p>
                                        <p className="text-sm font-bold text-slate-800">{calendarDetailItem.department_name}</p>
                                    </div>
                                )}
                                {calendarDetailItem.teacher_name && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">ครูผู้รับผิดชอบ</p>
                                        <p className="text-sm font-bold text-slate-800">{calendarDetailItem.teacher_name}</p>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">การเข้าร่วม</p>
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                        calendarDetailItem.visibility === 'public' ? 'bg-emerald-100 text-emerald-700' :
                                        calendarDetailItem.visibility === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                    }`}>{calendarDetailItem.visibility || 'public'}</span>
                                </div>
                            </div>
                            {calendarDetailItem.note && (
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">รายละเอียด</p>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-emerald-200">{calendarDetailItem.note}</p>
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setCalendarDetailItem(null)}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                            >
                                ปิด
                            </button>
                            <button
                                onClick={() => openCalendarEdit(calendarDetailItem)}
                                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200"
                            >
                                แก้ไขกิจกรรม
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <EditModal
                open={!!calendarEditItem}
                title="แก้ไขกิจกรรม"
                fields={activityFields}
                values={calendarEditValues}
                saving={savingCalendarEdit}
                onClose={() => setCalendarEditItem(null)}
                onChange={(k, v) => setCalendarEditValues(prev => ({ ...prev, [k]: v }))}
                onSubmit={saveCalendarEdit}
            />
        </div>
    );
}

