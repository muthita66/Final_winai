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
        const rooms = Array.from(new Set(activeSections.map(s => s.roomLabel))).map(label => ({ key: label, label }));
        return { subjs, rooms };
    }, [activeSections]);

    useEffect(() => {
        const match = activeSections.find(s => s.subjectKey === selectedSubject && s.roomLabel === selectedRoom);
        setSelectedSection(match?.id || null);
    }, [selectedSubject, selectedRoom, activeSections]);

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
        setSaving(true);
        const records = students.map(s => ({
            student_id: s.student_id, section_id: selectedSection!, date,
            status: statusMap[s.student_id] || "present"
        }));
        await TeacherApiService.saveAttendance(records);
        setSaving(false);
        alert("บันทึกเช็คชื่อเรียบร้อย!");
    };

    const statusOptions = [
        { value: "present", label: "มา", color: "bg-green-100 text-green-700 border-green-300" },
        { value: "absent", label: "ขาด", color: "bg-red-100 text-red-700 border-red-300" },
        { value: "late", label: "สาย", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
        { value: "leave", label: "ลา", color: "bg-blue-100 text-blue-700 border-blue-300" },
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
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">#</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">รหัส</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชื่อ-นามสกุล</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">สถานะ</th>
                                </tr></thead>
                                <tbody>{students.map((s, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-800 tracking-tight">{s.student_code}</td>
                                        <td className="px-4 py-3 text-sm text-slate-800 font-medium">{s.first_name} {s.last_name}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5 justify-center flex-wrap">
                                                {statusOptions.map(opt => (
                                                    <button key={opt.value} onClick={() => setStatusMap({ ...statusMap, [s.student_id]: opt.value })} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${statusMap[s.student_id] === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-slate-300 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>{opt.label}</button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                            <div className="p-4 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-sm text-slate-500">นักเรียนทั้งหมด {students.length} คน</span>
                                <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center">
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                    ) : null}
                                    {saving ? "กำลังบันทึก..." : "บันทึกเช็คชื่อ"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
