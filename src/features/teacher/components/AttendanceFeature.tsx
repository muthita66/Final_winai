"use client";
import { useState, useEffect, useMemo } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";

const txt = (v: any) => String(v ?? "").trim();

function getAcademicYearValue(section: any) {
    return txt(section?.semesters?.academic_years?.year_name) || txt(section?.year);
}

function formatTermLabel(section: any) {
    return `ปี ${getAcademicYearValue(section) || "-"} ภาค ${txt(section?.semester) || "-"}`;
}

function formatRoomLabel(classLevel?: string | null, room?: string | null) {
    const level = String(classLevel || "").trim();
    const roomValue = String(room || "").trim();
    if (!level && !roomValue) return "-";
    if (!roomValue) return level || "-";
    if (!level) return roomValue;
    if (roomValue === level || roomValue.startsWith(`${level}/`)) return roomValue;
    return `${level}/${roomValue}`;
}

export function AttendanceFeature({ session }: { session: any }) {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const [selectedRoom, setSelectedRoom] = useState<string>("");
    const [selectedSection, setSelectedSection] = useState<number | null>(null);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [students, setStudents] = useState<any[]>([]);
    const [statusMap, setStatusMap] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        TeacherApiService.getTeacherSubjects(session.id).then(d => { setSubjects(d || []); setLoading(false); }).catch(() => setLoading(false));
    }, [session.id]);

    const activeSections = useMemo(() => (subjects || []).map((s: any) => ({
        ...s,
        roomLabel: formatRoomLabel(s.class_level, s.classroom || s.room),
        subjectCode: s.subjects?.subject_code || s.subject_code || "-",
        subjectName: s.subjects?.name || s.subject_name || "-",
        subjectKey: txt(s.subjects?.id) || `${txt(s.subjects?.subject_code)}|${txt(s.subjects?.name)}`
    })), [subjects]);

    const filterOptions = useMemo(() => {
        const subjs = Array.from(new Set(activeSections.map(s => s.subjectKey))).map(key => {
            const match = activeSections.find(s => s.subjectKey === key);
            return { key, label: `${match?.subjectCode} ${match?.subjectName}` };
        });
        
        // Filter rooms based on selected subject
        const filteredForRooms = selectedSubject 
            ? activeSections.filter(s => s.subjectKey === selectedSubject)
            : activeSections;

        const rooms = Array.from(new Set(filteredForRooms.map(s => s.roomLabel))).map(label => ({ key: label, label }));
        return { subjs, rooms };
    }, [activeSections, selectedSubject]);

    useEffect(() => {
        const match = activeSections.find(s => s.subjectKey === selectedSubject && s.roomLabel === selectedRoom);
        setSelectedSection(match?.id || null);
    }, [selectedSubject, selectedRoom, activeSections]);

    // Reset room if it's no longer valid for the selected subject
    useEffect(() => {
        if (selectedSubject && selectedRoom) {
            const isValid = activeSections.some(s => s.subjectKey === selectedSubject && s.roomLabel === selectedRoom);
            if (!isValid) setSelectedRoom("");
        }
    }, [selectedSubject, activeSections, selectedRoom]);

    const isComplete = useMemo(() => {
        return students.length > 0 && students.every(s => !!statusMap[s.student_id]);
    }, [students, statusMap]);

    const remainingCount = useMemo(() => {
        return students.length - Object.keys(statusMap).length;
    }, [students, statusMap]);

    const sectionInfo = useMemo(() => activeSections.find(s => s.id === selectedSection), [selectedSection, activeSections]);

    const loadAttendance = async () => {
        if (!selectedSection) return;
        setLoading(true);
        const data = await TeacherApiService.getAttendanceStudents(session.id, selectedSection, date);
        setStudents(data || []);
        const map: Record<number, string> = {};
        (data || []).forEach((s: any) => { if (s.status) map[s.student_id] = s.status; });
        setStatusMap(map);
        setLoading(false);
    };

    useEffect(() => { if (selectedSection) loadAttendance(); }, [selectedSection, date]);

    const handleSave = async () => {
        if (!isComplete) {
            alert(`กรุณาเช็คชื่อให้ครบทุกคน (ยังเหลืออีก ${remainingCount} คน)`);
            return;
        }
        setSaving(true);
        const records = students.map(s => ({
            student_id: s.student_id, section_id: selectedSection!, date,
            status: statusMap[s.student_id]
        }));
        await TeacherApiService.saveAttendance(records);
        setSaving(false);
        alert("บันทึกเช็คชื่อเรียบร้อย!");
    };

    const handleClearAttendance = () => {
        if (Object.keys(statusMap).length > 0 && confirm("ล้างการเช็คชื่อที่เลือกไว้ทั้งหมดในวิชานี้?")) {
            setStatusMap({});
        }
    };

    const handleClearFilters = () => {
        setSelectedSubject("");
        setSelectedRoom("");
        setSelectedSection(null);
        setStudents([]);
        setStatusMap({});
    };

    const statusOptions = [
        { value: "present", label: "มา", color: "bg-green-100 text-green-700 border-green-300" },
        { value: "absent", label: "ขาด", color: "bg-red-100 text-red-700 border-red-300" },
        { value: "late", label: "สาย", color: "bg-amber-100 text-amber-700 border-amber-300" },
        { value: "leave", label: "ลา", color: "bg-sky-100 text-sky-700 border-sky-300" },
    ];

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Attendance</div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        เช็คชื่อนักเรียน
                    </h1>
                    {sectionInfo ? (
                        <div className="mt-2 text-emerald-100 text-sm opacity-90 leading-relaxed">
                            <div>{sectionInfo.subjectCode} {sectionInfo.subjectName}</div>
                            <div>{sectionInfo.roomLabel} {formatTermLabel(sectionInfo)}</div>
                        </div>
                    ) : (
                        <p className="text-emerald-100 mt-2">เช็คชื่อรายห้องและบันทึกสถานะการเข้าเรียน</p>
                    )}
                </div>
            </section>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-slate-500 font-medium block mb-1">เลือกวิชา</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                        <option value="">เลือกวิชา</option>
                        {filterOptions.subjs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-slate-500 font-medium block mb-1">เลือกระดับชั้น</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
                        <option value="">เลือกระดับชั้น</option>
                        {filterOptions.rooms.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">วันที่</label>
                    <input type="date" className="px-4 py-2 border border-slate-200 rounded-xl outline-none" value={date} onChange={e => setDate(e.target.value)} />
                </div>
            </div>

            {selectedSection && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-8 text-center text-slate-500">กำลังโหลด...</div> : (
                        <>
                            <table className="w-full">
                                <thead><tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">เลขที่</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">รหัส</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">ชื่อ-นามสกุล</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">สถานะ</th>
                                </tr></thead>
                                <tbody>{students.map((s, i) => {
                                    const isMarked = !!statusMap[s.student_id];
                                    return (
                                        <tr key={i} className={`border-b border-slate-100 transition-colors ${!isMarked ? 'bg-rose-50/20' : 'hover:bg-slate-50'}`}>
                                            <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 tracking-tight">{s.student_code}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{s.first_name} {s.last_name}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5 justify-center flex-wrap">
                                                    {statusOptions.map(opt => (
                                                        <button key={opt.value} onClick={() => setStatusMap({ ...statusMap, [s.student_id]: opt.value })} className={`px-4 py-1.5 rounded-lg text-sm transition-all border ${statusMap[s.student_id] === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-slate-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>{opt.label}</button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                            <div className="p-4 border-t border-slate-200 flex flex-wrap gap-4 justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-slate-600 font-medium">นักเรียนทั้งหมด {students.length} คน</span>
                                    {remainingCount > 0 ? (
                                        <span className="text-xs font-bold text-rose-500 px-2 py-1 bg-rose-50 rounded-lg">ยังขาดอีก {remainingCount} คน</span>
                                    ) : (
                                        <span className="text-xs font-bold text-emerald-600 px-2 py-1 bg-emerald-50 rounded-lg">เช็คชื่อครบแล้ว</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleClearAttendance} className="px-4 py-2.5 text-slate-500 hover:text-rose-600 font-bold text-sm transition-colors">
                                        ล้างรายการเช็คชื่อ
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !isComplete}
                                        className={`px-8 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center ${isComplete ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                    >
                                        {saving ? (
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                        ) : null}
                                        {saving ? "กำลังบันทึก..." : "บันทึกเช็คชื่อ"}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
