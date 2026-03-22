"use client";
import { useState, useEffect } from "react";
import { DirectorApiService } from "@/services/director-api.service";
import { MapPin, User, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function ActivitiesCalendar({ onAddClick, onBack, onEditClick }: { onAddClick?: () => void; onBack?: () => void; onEditClick?: (ev: any) => void }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    const loadData = async () => {
        setLoading(true);
        try {
            const evs = await DirectorApiService.getActivities();
            setEvents(evs || []);
        } catch (e) {
            console.error('Failed to load events:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Group events by date (YYYY-MM-DD)
    const eventMap = new Map<string, any[]>();
    events.forEach(ev => {
        if (!ev.date) return;
        const [sY, sM, sD] = ev.date.split('-').map(Number);
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
                                    onClick={() => onEditClick?.(ev)}
                                    className="text-left text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 truncate hover:bg-emerald-100 font-bold transition-colors shadow-sm"
                                    title={`แก้ไข: ${ev.name}`}
                                >
                                    {ev.name}
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
                    onClick={onAddClick}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm shadow-md shadow-emerald-200 flex items-center gap-2"
                >
                    + เพิ่มกิจกรรม
                </button>
            </div>

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

            {/* Upcoming List Section Section */}
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
                            onClick={() => onEditClick?.(ev)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all hover:bg-white hover:shadow-md group text-left"
                        >                            <div className="space-y-1.5 flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 transition-transform group-hover:scale-125"></span>
                                    {ev.name}
                                </h4>
                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span>{ev.date ? new Date(ev.date).toLocaleDateString("th-TH") : "-"}</span>
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
                                {ev.note && (
                                    <p className="text-xs text-slate-400 italic line-clamp-1 mt-1 pl-3 border-l-2 border-slate-200">{ev.note}</p>
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
