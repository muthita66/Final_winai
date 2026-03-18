"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import { MapPin, User, Bookmark } from "lucide-react";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function CalendarFeature({ session }: { session: any }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAdd, setShowAdd] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [filterTeacherId, setFilterTeacherId] = useState<string>("");
    const [teacherSearch, setTeacherSearch] = useState("");
    const [editTeacherSearch, setEditTeacherSearch] = useState("");
    const [showTeacherResults, setShowTeacherResults] = useState(false);
    const [showEditTeacherResults, setShowEditTeacherResults] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", event_date: "", responsible_teacher_id: "", location: "", start_time: "", end_time: "" });
    const [editForm, setEditForm] = useState({ title: "", description: "", event_date: "", responsible_teacher_id: "", location: "", start_time: "", end_time: "" });

    const loadData = async () => {
        setLoading(true);
        try {
            const evs = await TeacherApiService.getCalendarEvents();
            setEvents(evs || []);
        } catch (e) { console.error('Failed to load events:', e); }

        try {
            const tchs = await TeacherApiService.getAllTeachers();
            setTeachers(tchs || []);
            console.log('Loaded teachers:', tchs);
        } catch (e) { console.error('Failed to load teachers:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = async () => {
        if (!form.title || !form.event_date) return;
        await TeacherApiService.addCalendarEvent({
            ...form,
            responsible_teacher_id: form.responsible_teacher_id ? Number(form.responsible_teacher_id) : null
        });
        setForm({ title: "", description: "", event_date: "", responsible_teacher_id: "", location: "", start_time: "", end_time: "" });
        setTeacherSearch("");
        setShowAdd(false);
        loadData();
    };

    const handleUpdate = async () => {
        if (!selectedEvent || !editForm.title || !editForm.event_date) return;
        await TeacherApiService.updateCalendarEvent(selectedEvent.id, {
            ...editForm,
            responsible_teacher_id: editForm.responsible_teacher_id ? Number(editForm.responsible_teacher_id) : null
        });
        setSelectedEvent(null);
        loadData();
    };

    const openAddForm = (dateKey: string) => {
        setForm(prev => ({ ...prev, event_date: dateKey }));
        setTeacherSearch("");
        setShowAdd(true);
        setSelectedEvent(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openEditModal = (ev: any) => {
        setSelectedEvent(ev);
        setEditForm({
            title: ev.title,
            description: ev.description || "",
            event_date: new Date(ev.event_date).toISOString().slice(0, 10),
            responsible_teacher_id: ev.responsible_teacher_id ? String(ev.responsible_teacher_id) : "",
            location: ev.location || "",
            start_time: ev.start_datetime ? new Date(ev.start_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : "",
            end_time: ev.end_date ? new Date(ev.end_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : ""
        });
        setEditTeacherSearch(ev.responsible_teacher_name || "");
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
        const d = new Date(ev.event_date);
        const matchesDate = d.getFullYear() === year && d.getMonth() === month;
        const matchesTeacher = !filterTeacherId || String(ev.responsible_teacher_id) === filterTeacherId;
        return matchesDate && matchesTeacher;
    });

    const eventMap = new Map<string, any[]>();
    monthEvents.forEach(ev => {
        const d = new Date(ev.event_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!eventMap.has(key)) eventMap.set(key, []);
        eventMap.get(key)!.push(ev);
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
                                    className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 truncate hover:bg-emerald-100 w-fit max-w-full font-medium"
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
                </div>
                <h2 className="text-xl font-bold text-slate-800">{TH_MONTHS[month]} {year + 543}</h2>
                <button onClick={() => { setShowAdd(!showAdd); setSelectedEvent(null); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm">+ เพิ่มกิจกรรม</button>
            </div>

            {showAdd && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-800">เพิ่มกิจกรรมใหม่</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">ชื่อกิจกรรม</label>
                            <input className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="ชื่อกิจกรรม" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">เวลาเริ่ม</label>
                            <input type="time" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">เวลาสิ้นสุด</label>
                            <input type="time" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">วันที่</label>
                            <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 items-end">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">รายละเอียด</label>
                            <input className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="รายละเอียด" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">สถานที่</label>
                            <input className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="สถานที่" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-slate-500 px-1">ครูผู้รับผิดชอบ</label>
                            <div className="relative">
                                <input
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                    placeholder="ค้นหาครูผู้รับผิดชอบ..."
                                    value={teacherSearch}
                                    onChange={e => {
                                        setTeacherSearch(e.target.value);
                                        setShowTeacherResults(true);
                                    }}
                                    onFocus={() => setShowTeacherResults(true)}
                                />
                                {showTeacherResults && teacherSearch.trim() && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {(() => {
                                            const filtered = teachers.filter(t => {
                                                const fullName = `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase();
                                                return fullName.includes(teacherSearch.toLowerCase().trim());
                                            });
                                            if (filtered.length > 0) {
                                                return filtered.map(t => (
                                                    <div
                                                        key={t.id}
                                                        className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 hover:text-emerald-700 transition-colors"
                                                        onClick={() => {
                                                            setForm({ ...form, responsible_teacher_id: String(t.id) });
                                                            setTeacherSearch(`${t.first_name} ${t.last_name}`);
                                                            setShowTeacherResults(false);
                                                        }}
                                                    >
                                                        {t.first_name} {t.last_name}
                                                    </div>
                                                ));
                                            }
                                            return <div className="px-4 py-2 text-xs text-slate-400 text-center italic">ไม่พบรายชื่อครู</div>;
                                        })()}
                                    </div>
                                )}
                                {showTeacherResults && <div className="fixed inset-0 z-50" onClick={() => setShowTeacherResults(false)}></div>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">บันทึก</button>
                        <button onClick={() => setShowAdd(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors">ยกเลิก</button>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-emerald-600 py-4 px-6 text-white flex justify-between items-center">
                            <h3 className="text-lg font-bold">รายละเอียดกิจกรรม</h3>
                            <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-500 px-1">ชื่อกิจกรรม</label>
                                    <input className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-500 px-1">เวลาเริ่ม</label>
                                        <input type="time" className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={editForm.start_time} onChange={e => setEditForm(prev => ({ ...prev, start_time: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-500 px-1">เวลาสิ้นสุด</label>
                                        <input type="time" className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={editForm.end_time} onChange={e => setEditForm(prev => ({ ...prev, end_time: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-500 px-1">วันที่</label>
                                    <input type="date" className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={editForm.event_date} onChange={e => setEditForm(prev => ({ ...prev, event_date: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-500 px-1">รายละเอียด</label>
                                    <textarea className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[100px]" value={editForm.description} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-500 px-1">สถานที่</label>
                                        <input className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={editForm.location} onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-500 px-1">ครูผู้รับผิดชอบ</label>
                                        <div className="relative">
                                            <input
                                                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                                                placeholder="ค้นหาครูผู้รับผิดชอบ..."
                                                value={editTeacherSearch}
                                                onChange={e => {
                                                    setEditTeacherSearch(e.target.value);
                                                    setShowEditTeacherResults(true);
                                                }}
                                                onFocus={() => setShowEditTeacherResults(true)}
                                            />
                                            {showEditTeacherResults && (
                                                <div className="absolute z-[110] w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {teachers.filter(t => `${t.first_name} ${t.last_name}`.toLowerCase().includes(editTeacherSearch.toLowerCase())).length > 0 ? (
                                                        teachers.filter(t => `${t.first_name} ${t.last_name}`.toLowerCase().includes(editTeacherSearch.toLowerCase())).map(t => (
                                                            <div
                                                                key={t.id}
                                                                className="px-4 py-3 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 hover:text-emerald-700 transition-colors"
                                                                onClick={() => {
                                                                    setEditForm({ ...editForm, responsible_teacher_id: String(t.id) });
                                                                    setEditTeacherSearch(`${t.first_name} ${t.last_name}`);
                                                                    setShowEditTeacherResults(false);
                                                                }}
                                                            >
                                                                {t.first_name} {t.last_name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-3 text-xs text-slate-400 text-center italic">ไม่พบรายชื่อครู</div>
                                                    )}
                                                </div>
                                            )}
                                            {showEditTeacherResults && <div className="fixed inset-0 z-[105]" onClick={() => setShowEditTeacherResults(false)}></div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={handleUpdate} className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200">บันทึกการแก้ไข</button>
                                <button onClick={() => handleDelete(selectedEvent.id)} className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all text-sm">ลบกิจกรรม</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((d, i) => (
                                <th key={i} className={`py-3 px-2 text-center font-medium border-b border-slate-200 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'}`}>{d}</th>
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
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-1">
                                    <Bookmark size={14} className="opacity-70" />
                                    {ev.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span>{ev.event_date ? new Date(ev.event_date).toLocaleDateString("th-TH") : "-"}</span>
                                        {ev.start_datetime && (
                                            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                                                {new Date(ev.start_datetime).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })}
                                                {ev.end_date && ` - ${new Date(ev.end_date).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {ev.location && (
                                            <span className="text-slate-600 font-medium flex items-center gap-1">
                                                <MapPin size={12} className="text-rose-500" />
                                                {ev.location}
                                            </span>
                                        )}
                                        {ev.responsible_teacher_name && (
                                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                <User size={12} className="text-emerald-500" />
                                                ครู{ev.responsible_teacher_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-600 opacity-90">{ev.description || "-"}</div>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
}
