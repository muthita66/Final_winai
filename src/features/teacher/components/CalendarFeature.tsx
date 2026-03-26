"use client";
import { useState, useEffect } from "react";
import Portal from "@/components/Portal";
import { TeacherApiService } from "@/services/teacher-api.service";
import { fetchApi } from "@/services/api-client";
import { MapPin, User, Bookmark, ChevronDown, Building2, DoorOpen, Users } from "lucide-react";

export type Target = {
    target_type: string;
    target_value?: string | null;
};

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const EVENT_COLORS = [
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", hover: "hover:bg-emerald-100/80" },
    { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", hover: "hover:bg-blue-100/80" },
    { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", hover: "hover:bg-amber-100/80" },
    { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", hover: "hover:bg-rose-100/80" },
    { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", hover: "hover:bg-indigo-100/80" },
    { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", hover: "hover:bg-orange-100/80" },
    { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", hover: "hover:bg-teal-100/80" },
    { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200", hover: "hover:bg-fuchsia-100/80" },
];

const getEventColor = (ev: any) => {
    const id = Number(ev.id || 0);
    const color = EVENT_COLORS[id % EVENT_COLORS.length];
    return `${color.bg} ${color.text} ${color.border} ${color.hover}`;
};

const getEventTextOnlyColor = (ev: any) => {
    const id = Number(ev.id || 0);
    return EVENT_COLORS[id % EVENT_COLORS.length].text;
};

export function CalendarFeature({ session }: { session: any }) {
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
    const [filterTeacherId, setFilterTeacherId] = useState<string>("");
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
                TeacherApiService.getCalendarEvents(),
                TeacherApiService.getAllTeachers(),
                TeacherApiService.getDepartments(),
                TeacherApiService.getEventTypes(),
                fetchApi<any[]>("/api/options/buildings"),
                TeacherApiService.getTargetTypes(),
                TeacherApiService.getAcademicYears()
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
        await TeacherApiService.addCalendarEvent({
            ...form,
            responsible_teacher_id: form.responsible_teacher_id ? Number(form.responsible_teacher_id) : null,
            department_id: form.department_id ? Number(form.department_id) : null,
            event_type_id: form.event_type_id ? Number(form.event_type_id) : null,
            semester_id: form.semester_id ? Number(form.semester_id) : null,
            location: form.location || (rooms.find(r => String(r.id) === String(form.room_id))?.label) || "",
        });
        setForm(initialForm);
        setShowAdd(false);
        loadData();
    };

    const handleUpdate = async () => {
        if (!selectedEvent || !editForm.title || !editForm.event_date) return;
        await TeacherApiService.updateCalendarEvent(selectedEvent.id, {
            ...editForm,
            responsible_teacher_id: editForm.responsible_teacher_id ? Number(editForm.responsible_teacher_id) : null,
            department_id: editForm.department_id ? Number(editForm.department_id) : null,
            event_type_id: editForm.event_type_id ? Number(editForm.event_type_id) : null,
            semester_id: editForm.semester_id ? Number(editForm.semester_id) : null,
            location: editForm.location || (rooms.find(r => String(r.id) === String(editForm.room_id))?.label) || "",
        });
        setSelectedEvent(null);
        loadData();
    };

    const openAddForm = (dateKey: string) => {
        setForm({ ...initialForm, event_date: dateKey });
        setAddFormYear("");
        setShowAdd(true);
        setSelectedEvent(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openEditModal = (ev: any) => {
        setSelectedEvent(ev);
        // Find the year for this event's semester
        const semId = ev.semester_id ? String(ev.semester_id) : "";
        const matchingYear = semId ? academicYears.find(y => y.semesters?.some((s: any) => String(s.id) === semId)) : null;
        setEditFormYear(matchingYear?.id ? String(matchingYear.id) : "");
        setEditForm({
            title: ev.title,
            description: ev.description || "",
            event_date: ev.start_date || (ev.event_date ? new Date(ev.event_date).toISOString().slice(0, 10) : ""),
            start_time: ev.start_time || "",
            end_date: ev.end_date || "",
            end_time: ev.end_time || "",
            responsible_teacher_id: ev.responsible_teacher_id ? String(ev.responsible_teacher_id) : "",
            location: ev.location || "",
            building_id: "", // Reset on edit until manually selected
            room_id: "",     // Reset on edit
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
        await TeacherApiService.deleteCalendarEvent(id);
        setSelectedEvent(null);
        loadData();
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthEvents = events.filter(ev => {
        if (!ev.event_date) return false;
        const [sY, sM, sD] = ev.event_date.split('-').map(Number);
        const startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
        
        let endDate = new Date(startDate);
        if (ev.end_date) {
            const [eY, eM, eD] = ev.end_date.split('-').map(Number);
            endDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
        }
        
        const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const matchesDate = startDate <= monthEnd && endDate >= monthStart;
        const matchesTeacher = !filterTeacherId || String(ev.responsible_teacher_id) === filterTeacherId;
        return matchesDate && matchesTeacher;
    });

    const eventMap = new Map<string, any[]>();
    monthEvents.forEach(ev => {
        const [sY, sM, sD] = ev.event_date.split('-').map(Number);
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
            // only push if not already added to this day (in case of duplicated data)
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
        for (let w = 0; w < 6; w++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                let display = 0, isCurrent = true, dateKey = "";
                if (w === 0 && i < firstDay) { isCurrent = false; display = new Date(year, month, 0).getDate() - firstDay + i + 1; }
                else if (dayNum > daysInMonth) { isCurrent = false; display = dayNum - daysInMonth; dayNum++; }
                else {
                    display = dayNum;
                    dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    dayNum++;
                }
                const dayEvs = eventMap.get(dateKey) || [];
                const isToday = isCurrent && display === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                days.push(
                    <td
                        key={i}
                        className={`border border-slate-200 p-1 align-top h-20 cursor-pointer ${!isCurrent ? 'opacity-30 bg-slate-50/50' : 'bg-white hover:bg-slate-50'} transition-colors group`}
                        onClick={() => isCurrent && dateKey && openAddForm(dateKey)}
                    >
                        <div className={`text-right text-xs p-1 ${isToday ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>{display}</div>
                        <div className="flex flex-col gap-1 px-1">
                            {dayEvs.slice(0, 2).map((ev: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-md border truncate w-full font-bold transition-colors ${getEventColor(ev)}`}
                                    title={ev.title}
                                    onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}
                                >
                                    {ev.title}
                                </div>
                            ))}
                            {dayEvs.length > 2 && <div className="text-[10px] text-slate-400 px-1 font-medium">+{dayEvs.length - 2}</div>}
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
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl py-6 px-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium mb-3">Calendar</div>
                    <h1 className="text-2xl font-bold">ปฏิทินกิจกรรม</h1>
                    <p className="text-emerald-100 mt-1 text-sm">จัดการกิจกรรมและตารางนัดหมาย</p>
                </div>
            </section>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                    <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                    <span className="text-lg font-bold text-slate-700 min-w-[140px] text-center">
                        {TH_MONTHS[month]} {year + 543}
                    </span>
                </div>
                <button onClick={() => { setShowAdd(!showAdd); setSelectedEvent(null); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm">+ เพิ่มกิจกรรม</button>
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
                                                                const opts = await TeacherApiService.getTargetOptions(type);
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

                                    {/* Row 6 */}
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((d, i) => (
                                <th key={i} className={`py-3 px-2 text-center font-medium border-b border-slate-200 ${i === 0 ? 'text-emerald-500' : i === 6 ? 'text-teal-500' : 'text-slate-600'}`}>{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-500">กำลังโหลด...</td></tr> : renderGrid()}</tbody>
                </table>
            </div>

            {/* Upcoming list */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">รายการกิจกรรมทั้งหมด ({events.length})</h3>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {events.map((ev, i) => (
                        <div 
                            key={i} 
                            onClick={() => openEditModal(ev)}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer hover:bg-white hover:shadow-sm active:scale-[0.99] group"
                        >
                            <div>
                                <div className={`text-sm font-bold flex items-center gap-2 mb-1 transition-colors ${getEventTextOnlyColor(ev)}`}>
                                    <Bookmark size={14} className="opacity-70" />
                                    {ev.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 space-y-1">
                                    <div className="flex items-center gap-2 font-medium">
                                        <span className="text-slate-700">{ev.event_date ? new Date(ev.event_date).toLocaleDateString("th-TH") : "-"}</span>
                                        {ev.start_time && (
                                            <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-800 shadow-sm text-[10px]">
                                                {ev.start_time} - {ev.end_time || '?'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {ev.event_type_name && (
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                {ev.event_type_name}
                                            </span>
                                        )}
                                        {ev.department_name && (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                {ev.department_name}
                                            </span>
                                        )}
                                        {ev.location && (
                                            <span className="text-slate-600 font-medium flex items-center gap-1">
                                                <MapPin size={12} className="text-emerald-500" />
                                                {ev.location}
                                            </span>
                                        )}
                                        {ev.responsible_teacher_name && (
                                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                <User size={12} className="text-emerald-500" />
                                                {ev.responsible_teacher_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-600 opacity-90">{ev.description || "-"}</div>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }} 
                                className="text-xs text-rose-500 hover:text-rose-700 px-3 py-1 rounded-lg hover:bg-rose-50 transition-colors font-bold"
                            >
                                ลบ
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
}
