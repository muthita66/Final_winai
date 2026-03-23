"use client";
import { useState, useEffect } from "react";
import Portal from "@/components/Portal";
import { DirectorApiService } from "@/services/director-api.service";
import { fetchApi } from "@/services/api-client";
import { MapPin, User, Bookmark, ChevronLeft, ChevronRight, Building2, DoorOpen, Users } from "lucide-react";

export type Target = {
    target_type: string;
    target_value?: string | null;
};

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function ActivitiesCalendar({ onBack }: { onBack?: () => void }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAdd, setShowAdd] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [eventTypes, setEventTypes] = useState<any[]>([]);
    const [buildings, setBuildings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [targetTypes, setTargetTypes] = useState<any[]>([]);
    const [targetOptions, setTargetOptions] = useState<any[]>([]);
    const [loadingTargets, setLoadingTargets] = useState(false);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [addFormYear, setAddFormYear] = useState<string>("");
    const [editFormYear, setEditFormYear] = useState<string>("");

    // Unified form state
    const initialForm = {
        title: "",
        description: "",
        event_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        responsible_teacher_id: "",
        location: "",
        building_id: "",
        room_id: "",
        visibility: "public",
        department_id: "",
        event_type_id: "",
        semester_id: "",
        targets: [] as Target[]
    };
    const [form, setForm] = useState(initialForm);
    const [editForm, setEditForm] = useState(initialForm);

    const loadData = async () => {
        setLoading(true);
        try {
            const [evs, tchs, depts, types, bldgs, tgtTypes, ayrs] = await Promise.all([
                DirectorApiService.getActivities(),
                DirectorApiService.getTeachers(),
                DirectorApiService.getDepartmentsLookup(),
                DirectorApiService.getEventTypesLookup(),
                fetchApi<any[]>("/api/options/buildings"),
                DirectorApiService.getTargetTypes(),
                DirectorApiService.getAcademicYears()
            ]);
            setEvents(evs || []);
            setTeachers(tchs || []);
            setDepartments(depts || []);
            setEventTypes(types || []);
            setBuildings(bldgs || []);
            setTargetTypes(tgtTypes || []);
            setAcademicYears(ayrs || []);
        } catch (e) {
            console.error('Failed to load calendar data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = async () => {
        if (!form.title || !form.event_date) return;
        await DirectorApiService.createActivity({
            name: form.title,
            note: form.description,
            start_date: form.event_date,
            start_time: form.start_time,
            end_date: form.end_date,
            end_time: form.end_time,
            teacher_id: form.responsible_teacher_id ? Number(form.responsible_teacher_id) : null,
            department_id: form.department_id ? Number(form.department_id) : null,
            event_type_id: form.event_type_id ? Number(form.event_type_id) : null,
            location: form.location || (rooms.find(r => String(r.id) === String(form.room_id))?.label) || "",
            visibility: form.visibility,
            semester_id: form.semester_id ? Number(form.semester_id) : null,
            targets: form.targets,
        });
        setForm(initialForm);
        setShowAdd(false);
        loadData();
    };

    const handleUpdate = async () => {
        if (!selectedEvent || !editForm.title || !editForm.event_date) return;
        await DirectorApiService.updateActivity(selectedEvent.id, {
            name: editForm.title,
            note: editForm.description,
            start_date: editForm.event_date,
            start_time: editForm.start_time,
            end_date: editForm.end_date,
            end_time: editForm.end_time,
            teacher_id: editForm.responsible_teacher_id ? Number(editForm.responsible_teacher_id) : null,
            department_id: editForm.department_id ? Number(editForm.department_id) : null,
            event_type_id: editForm.event_type_id ? Number(editForm.event_type_id) : null,
            location: editForm.location || (rooms.find(r => String(r.id) === String(editForm.room_id))?.label) || "",
            visibility: editForm.visibility,
            semester_id: editForm.semester_id ? Number(editForm.semester_id) : null,
            targets: editForm.targets,
        });
        setSelectedEvent(null);
        loadData();
    };

    const openEditModal = (ev: any) => {
        setSelectedEvent(ev);
        // Find the year for this event's semester
        const semId = ev.semester_id ? String(ev.semester_id) : "";
        const matchingYear = semId ? academicYears.find(y => y.semesters?.some((s: any) => String(s.id) === semId)) : null;
        setEditFormYear(matchingYear?.id ? String(matchingYear.id) : "");
        setEditForm({
            title: ev.name || ev.title || "",
            description: ev.note || ev.description || "",
            event_date: ev.date || ev.start_date || "",
            start_time: ev.start_time || "",
            end_date: ev.end_date || "",
            end_time: ev.end_time || "",
            responsible_teacher_id: ev.teacher_id ? String(ev.teacher_id) : "",
            location: ev.location || "",
            building_id: "",
            room_id: "",
            visibility: ev.visibility || "public",
            department_id: ev.department_id ? String(ev.department_id) : "",
            event_type_id: ev.event_type_id ? String(ev.event_type_id) : "",
            semester_id: ev.semester_id ? String(ev.semester_id) : "",
            targets: ev.targets || []
        });
        setShowAdd(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("ลบกิจกรรมนี้?")) return;
        await DirectorApiService.deleteActivity(id);
        setSelectedEvent(null);
        loadData();
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Group events by date (YYYY-MM-DD)
    const eventMap = new Map<string, any[]>();
    events.forEach(ev => {
        const dateStr = ev.date || ev.start_date;
        if (!dateStr) return;
        const [sY, sM, sD] = dateStr.split('-').map(Number);
        const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

        let end = new Date(start);
        if (ev.end_date) {
            const [eY, eM, eD] = ev.end_date.split('-').map(Number);
            end = new Date(eY, eM - 1, eD, 0, 0, 0, 0);
        }

        if (start > end) end = new Date(start);

        let current = new Date(start);
        let safeCounter = 0;
        while (current <= end && safeCounter < 365) {
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            if (!eventMap.has(key)) eventMap.set(key, []);
            if (!eventMap.get(key)!.some(e => e.id === ev.id)) {
                eventMap.get(key)!.push(ev);
            }
            current.setDate(current.getDate() + 1);
            safeCounter++;
        }
    });

    const renderGrid = () => {
        const weeks = [];
        let dayNum = 1;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let w = 0; w < 6; w++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                let display = 0, isCurrent = true, dateKey = "";
                if (w === 0 && i < firstDay) {
                    isCurrent = false;
                    display = new Date(year, month, 0).getDate() - firstDay + i + 1;
                } else if (dayNum > daysInMonth) {
                    isCurrent = false;
                    display = dayNum - daysInMonth;
                    dayNum++;
                } else {
                    display = dayNum;
                    dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    dayNum++;
                }

                const dayEvs = eventMap.get(dateKey) || [];
                const isToday = isCurrent && dateKey === todayStr;

                days.push(
                    <td
                        key={i}
                        className={`border border-slate-200 p-1 align-top h-24 transition-colors group ${
                            !isCurrent ? 'opacity-30 bg-slate-50/50 text-slate-300' : 'bg-white hover:bg-slate-50'
                        }`}
                    >
                        <div className={`text-right text-xs p-1 font-bold ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {display}
                        </div>
                        <div className="flex flex-col gap-1.5 px-1 overflow-hidden">
                            {dayEvs.slice(0, 3).map((ev: any, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => openEditModal(ev)}
                                    className="text-left text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 truncate hover:bg-emerald-100 font-bold transition-colors shadow-sm"
                                    title={`แก้ไข: ${ev.name || ev.title}`}
                                >
                                    {ev.name || ev.title}
                                </button>
                            ))}
                            {dayEvs.length > 3 && (
                                <div className="text-[10px] text-slate-400 px-1 font-bold italic">
                                    + {dayEvs.length - 3} รายการ
                                </div>
                            )}
                        </div>
                    </td>
                );
            }
            weeks.push(<tr key={w}>{days}</tr>);
            if (dayNum > daysInMonth) break;
        }
        return weeks;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Emerald Header Section */}
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl py-6 px-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10 flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white border border-white/30 group"
                        >
                            <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                    )}
                    <div className="text-left">
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium mb-2">Calendar</div>
                        <h1 className="text-2xl font-bold">ปฏิทินกิจกรรม</h1>
                        <p className="text-emerald-100 mt-0.5 text-sm">จัดการกิจกรรมและตารางนัดหมาย</p>
                    </div>
                </div>
            </section>

            {/* Navigation and Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm bg-white"
                    >
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm bg-white"
                    >
                        <ChevronRight size={20} className="text-slate-600" />
                    </button>
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                    {TH_MONTHS[month]} {year + 543}
                </h2>
                <button
                    onClick={() => { setShowAdd(!showAdd); setSelectedEvent(null); }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm shadow-md shadow-emerald-200 flex items-center gap-2"
                >
                    + เพิ่มกิจกรรม
                </button>
            </div>

            {/* Unified Activity Modal */}
            {(showAdd || selectedEvent) && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {selectedEvent ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
                                </h3>
                                <button
                                    onClick={() => { setShowAdd(false); setSelectedEvent(null); }}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Body - Scrollable */}
                            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Row 1 */}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ชื่อกิจกรรม</label>
                                        <input
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 placeholder:text-slate-400"
                                            placeholder="ระบุชื่อกิจกรรม..."
                                            value={showAdd ? form.title : editForm.title}
                                            onChange={e => showAdd ? setForm({...form, title: e.target.value}) : setEditForm({...editForm, title: e.target.value})}
                                        />
                                    </div>
                                     <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ปีการศึกษา</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? addFormYear : editFormYear}
                                            onChange={e => {
                                                const yearId = e.target.value;
                                                if (showAdd) {
                                                    setAddFormYear(yearId);
                                                    setForm({...form, semester_id: ""});
                                                } else {
                                                    setEditFormYear(yearId);
                                                    setEditForm({...editForm, semester_id: ""});
                                                }
                                            }}
                                        >
                                            <option value="">เลือกปีการศึกษา</option>
                                            {academicYears.map(y => <option key={y.id} value={String(y.id)}>{y.year_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ภาคเรียน</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.semester_id : editForm.semester_id}
                                            onChange={e => showAdd ? setForm({...form, semester_id: e.target.value}) : setEditForm({...editForm, semester_id: e.target.value})}
                                            disabled={!(showAdd ? addFormYear : editFormYear)}
                                        >
                                            <option value="">เลือกภาคเรียน</option>
                                            {(() => {
                                                const currentYearId = showAdd ? addFormYear : editFormYear;
                                                const year = academicYears.find(y => String(y.id) === String(currentYearId));
                                                return (year?.semesters || []).map((s: any) => (
                                                    <option key={s.id} value={String(s.id)}>ภาคเรียนที่ {s.semester_number}</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ประเภทกิจกรรม</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.event_type_id : editForm.event_type_id}
                                            onChange={e => showAdd ? setForm({...form, event_type_id: e.target.value}) : setEditForm({...editForm, event_type_id: e.target.value})}
                                        >
                                            <option value="">ทั้งหมด</option>
                                            {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ฝ่ายที่รับผิดชอบ</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.department_id : editForm.department_id}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (showAdd) {
                                                    setForm({ ...form, department_id: val, responsible_teacher_id: "" });
                                                } else {
                                                    setEditForm({ ...editForm, department_id: val, responsible_teacher_id: "" });
                                                }
                                            }}
                                        >
                                            <option value="">ทั้งหมด</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">ครูที่รับผิดชอบ</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.responsible_teacher_id : editForm.responsible_teacher_id}
                                            onChange={e => showAdd ? setForm({...form, responsible_teacher_id: e.target.value}) : setEditForm({...editForm, responsible_teacher_id: e.target.value})}
                                        >
                                            <option value="">ทั้งหมด</option>
                                            {(() => {
                                                const deptId = showAdd ? form.department_id : editForm.department_id;
                                                return teachers
                                                    .filter(t => !deptId || String(t.department_id) === String(deptId))
                                                    .map(t => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.first_name} {t.last_name}
                                                        </option>
                                                    ));
                                            })()}
                                        </select>
                                    </div>

                                    {/* Row 3 */}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">วันที่เริ่ม</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800"
                                            value={showAdd ? form.event_date : editForm.event_date}
                                            onChange={e => showAdd ? setForm({...form, event_date: e.target.value}) : setEditForm({...editForm, event_date: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">วันที่สิ้นสุด</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800"
                                            value={showAdd ? form.end_date : editForm.end_date}
                                            onChange={e => showAdd ? setForm({...form, end_date: e.target.value}) : setEditForm({...editForm, end_date: e.target.value})}
                                        />
                                    </div>

                                    {/* Row 4 */}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">เวลาเริ่ม</label>
                                        <input
                                            type="time"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800"
                                            value={showAdd ? form.start_time : editForm.start_time}
                                            onChange={e => showAdd ? setForm({...form, start_time: e.target.value}) : setEditForm({...editForm, start_time: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">เวลาสิ้นสุด</label>
                                        <input
                                            type="time"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800"
                                            value={showAdd ? form.end_time : editForm.end_time}
                                            onChange={e => showAdd ? setForm({...form, end_time: e.target.value}) : setEditForm({...editForm, end_time: e.target.value})}
                                        />
                                    </div>

                                    {/* Location Selection */}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                            <Building2 size={14} className="text-emerald-500" /> อาคาร
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.building_id : editForm.building_id}
                                            onChange={async (e) => {
                                                const bId = e.target.value;
                                                if (showAdd) setForm({...form, building_id: bId, room_id: ""});
                                                else setEditForm({...editForm, building_id: bId, room_id: ""});

                                                if (bId) {
                                                    const roomList = await fetchApi<any[]>(`/api/options/rooms?buildingId=${bId}`);
                                                    setRooms(roomList || []);
                                                } else {
                                                    setRooms([]);
                                                }
                                            }}
                                        >
                                            <option value="">เลือกอาคาร</option>
                                            {buildings.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                            <DoorOpen size={14} className="text-emerald-500" /> ห้อง
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 cursor-pointer"
                                            value={showAdd ? form.room_id : editForm.room_id}
                                            onChange={e => showAdd ? setForm({...form, room_id: e.target.value}) : setEditForm({...editForm, room_id: e.target.value})}
                                            disabled={!(showAdd ? form.building_id : editForm.building_id)}
                                        >
                                            <option value="">สมาคม / อื่นๆ</option>
                                            {rooms.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Dynamic Participation Scope */}
                                    <div className="md:col-span-2 space-y-3 border-t border-slate-100 pt-4">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Users size={16} className="text-emerald-600" /> กลุ่มเป้าหมายผู้เข้าร่วม
                                        </label>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ประเภทกลุ่มเป้าหมาย</label>
                                                <select
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                                    value={(showAdd ? form.targets[0]?.target_type : editForm.targets[0]?.target_type) || ""}
                                                    onChange={async (e) => {
                                                        const type = e.target.value;
                                                        const config = targetTypes.find(t => t.code === type);

                                                        const newTarget = { target_type: type, target_value: null };
                                                        if (showAdd) setForm({ ...form, targets: [newTarget] });
                                                        else setEditForm({ ...editForm, targets: [newTarget] });

                                                        if (config?.input_type === 'select') {
                                                            setLoadingTargets(true);
                                                            try {
                                                                const opts = await fetchApi<any[]>(`/api/options/targets?targetType=${type}`);
                                                                setTargetOptions(opts || []);
                                                            } finally {
                                                                setLoadingTargets(false);
                                                            }
                                                        } else {
                                                            setTargetOptions([]);
                                                        }
                                                    }}
                                                >
                                                    <option value="">เลือกกลุ่มเป้าหมาย</option>
                                                    {targetTypes.map(t => <option key={t.code} value={t.code}>{t.display_name}</option>)}
                                                </select>
                                            </div>

                                            {((showAdd ? form.targets[0]?.target_type : editForm.targets[0]?.target_type) &&
                                            targetTypes.find(t => t.code === (showAdd ? form.targets[0]?.target_type : editForm.targets[0]?.target_type))?.input_type === 'select') && (
                                                <div className="md:col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 pt-2 border-t border-slate-100 mt-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                            ระบุรายละเอียด <span className="text-emerald-600 font-normal normal-case">(เลือกได้มากกว่า 1)</span>
                                                        </label>
                                                        {targetOptions.length > 0 && (
                                                            <button
                                                                type="button"
                                                                className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                                                                onClick={() => {
                                                                    const currentTargets = showAdd ? form.targets : editForm.targets;
                                                                    const targetType = currentTargets[0]?.target_type;
                                                                    const selectedValues = currentTargets.map(t => t.target_value).filter(Boolean);
                                                                    const allSelected = selectedValues.length === targetOptions.length;

                                                                    if (allSelected) {
                                                                        const updated = [{ target_type: targetType, target_value: null }];
                                                                        if (showAdd) setForm({ ...form, targets: updated });
                                                                        else setEditForm({ ...editForm, targets: updated });
                                                                    } else {
                                                                        const updated = targetOptions.map(opt => ({
                                                                            target_type: targetType,
                                                                            target_value: String(opt.id)
                                                                        }));
                                                                        if (showAdd) setForm({ ...form, targets: updated });
                                                                        else setEditForm({ ...editForm, targets: updated });
                                                                    }
                                                                }}
                                                            >
                                                                {(() => {
                                                                    const currentTargets = showAdd ? form.targets : editForm.targets;
                                                                    const selectedValues = currentTargets.map(t => t.target_value).filter(Boolean);
                                                                    return selectedValues.length === targetOptions.length ? "ล้างการเลือกทั้งหมด" : "เลือกทั้งหมด";
                                                                })()}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {loadingTargets ? (
                                                        <div className="text-sm text-slate-500 p-4 bg-white border border-slate-200 rounded-lg text-center animate-pulse">กำลังโหลดข้อมูล...</div>
                                                    ) : targetOptions.length > 0 ? (
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-white shadow-inner">
                                                            {targetOptions.map(opt => {
                                                                const currentTargets = showAdd ? form.targets : editForm.targets;
                                                                const isChecked = currentTargets.some(t => t.target_value === String(opt.id));

                                                                return (
                                                                    <label key={opt.id} className={`flex items-start gap-2 text-sm cursor-pointer p-2 rounded-lg border transition-all ${isChecked ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-slate-50 border-transparent'}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const checked = e.target.checked;
                                                                                const targetType = currentTargets[0]?.target_type;

                                                                                let updated = [...currentTargets];
                                                                                if (checked) {
                                                                                    if (updated.length === 1 && !updated[0].target_value) {
                                                                                        updated[0] = { target_type: targetType, target_value: String(opt.id) };
                                                                                    } else if (!updated.some(t => t.target_value === String(opt.id))) {
                                                                                        updated.push({ target_type: targetType, target_value: String(opt.id) });
                                                                                    }
                                                                                } else {
                                                                                    updated = updated.filter(t => t.target_value !== String(opt.id));
                                                                                    if (updated.length === 0) {
                                                                                        updated = [{ target_type: targetType, target_value: null }];
                                                                                    }
                                                                                }

                                                                                if (showAdd) setForm({ ...form, targets: updated });
                                                                                else setEditForm({ ...editForm, targets: updated });
                                                                            }}
                                                                        />
                                                                        <span className={`text-sm select-none ${isChecked ? 'font-medium text-emerald-800' : 'text-slate-600'}`}>
                                                                            {opt.label}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-slate-500 p-4 bg-slate-100 border border-slate-200 rounded-lg text-center">ไม่พบข้อมูลตัวเลือก</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-sm font-medium text-slate-700">รายละเอียด</label>
                                        <textarea
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 placeholder:text-slate-400 min-h-[100px] resize-none pb-20"
                                            placeholder="..."
                                            value={showAdd ? form.description : editForm.description}
                                            onChange={e => showAdd ? setForm({...form, description: e.target.value}) : setEditForm({...editForm, description: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => { setShowAdd(false); setSelectedEvent(null); }}
                                    className="px-5 py-2 text-slate-600 font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition-all text-sm"
                                >
                                    ยกเลิก
                                </button>
                                {selectedEvent && (
                                    <button
                                        onClick={() => handleDelete(selectedEvent.id)}
                                        className="px-5 py-2 text-rose-500 font-bold rounded-xl border border-rose-200 hover:bg-rose-50 transition-all text-sm"
                                    >
                                        ลบ
                                    </button>
                                )}
                                <button
                                    onClick={showAdd ? handleAdd : handleUpdate}
                                    className="px-7 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95 text-sm"
                                >
                                    {selectedEvent ? "บันทึก" : "เพิ่ม"}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Calendar Grid Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse table-fixed min-w-[600px]">
                    <thead>
                        <tr className="bg-slate-50">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((d, i) => (
                                <th key={i} className={`py-3 px-2 text-center font-bold text-xs uppercase border-b border-slate-200 ${
                                    i === 0 ? 'text-red-500' : i === 6 ? 'text-teal-500' : 'text-slate-500'
                                }`}>
                                    {d}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                                        <p className="text-xs font-medium text-slate-400">กำลังโหลด...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : renderGrid()}
                    </tbody>
                </table>
            </div>

            {/* Upcoming List Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-emerald-100">
                        <Bookmark size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">รายการกิจกรรมทั้งหมด ({events.length})</h3>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {events.map((ev, i) => (
                        <button
                            key={i}
                            onClick={() => openEditModal(ev)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all hover:bg-white hover:shadow-md group text-left"
                        >
                            <div className="space-y-1.5 flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 transition-transform group-hover:scale-125"></span>
                                    {ev.name || ev.title}
                                </h4>
                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span>{(ev.date || ev.start_date) ? new Date(ev.date || ev.start_date).toLocaleDateString("th-TH") : "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>{ev.start_time} - {ev.end_time}</span>
                                    </div>
                                    {ev.location && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={14} className="text-rose-400" />
                                            <span className="truncate">{ev.location}</span>
                                        </div>
                                    )}
                                    {ev.teacher_name && (
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} className="text-emerald-500" />
                                            <span>{ev.teacher_name}</span>
                                        </div>
                                    )}
                                </div>
                                {(ev.note || ev.description) && (
                                    <p className="text-xs text-slate-400 italic line-clamp-1 mt-1 pl-3 border-l-2 border-slate-200">{ev.note || ev.description}</p>
                                )}
                            </div>
                        </button>
                    ))}
                    {events.length === 0 && !loading && (
                        <div className="py-20 text-center text-slate-400 italic font-medium">
                            ไม่พบข้อมูลกิจกรรม
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
