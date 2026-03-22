"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeacherApiService } from "@/services/teacher-api.service";
import { getCurrentAcademicYearBE } from "@/features/student/academic-term";

function currentAcademicYearGuess() {
    return getCurrentAcademicYearBE();
}

function formatClassRoomDisplay(classLevel?: string | null, room?: string | null) {
    const level = String(classLevel || "").trim();
    const roomValue = String(room || "").trim();

    if (!level && !roomValue) return "-";
    if (!roomValue) return level || "-";
    if (!level) return roomValue;
    if (roomValue === level || roomValue.startsWith(`${level}/`)) return roomValue;

    return `${level}/${roomValue}`;
}

export function StudentsFeature({ session }: { session: any }) {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(currentAcademicYearGuess());
    const [semester, setSemester] = useState(1);
    const [search, setSearch] = useState("");
    const [notice, setNotice] = useState("");

    const loadStudents = async () => {
        setLoading(true);
        setNotice("");
        try {
            let rows = (await TeacherApiService.getAdvisoryStudents(session.id, year, semester).catch(() => [])) || [];

            if (rows.length === 0 && year < 2400) {
                const beYear = year + 543;
                const beRows = (await TeacherApiService.getAdvisoryStudents(session.id, beYear, semester).catch(() => [])) || [];
                if (beRows.length > 0) {
                    setYear(beYear);
                    setStudents(beRows);
                    setNotice(`แสดงข้อมูลปี ${beYear} ภาค ${semester} (ปรับจากปี ค.ศ. อัตโนมัติ)`);
                    setLoading(false);
                    return;
                }
            }

            if (rows.length === 0) {
                const latestRows = (await TeacherApiService.getAdvisoryStudents(session.id).catch(() => [])) || [];
                if (latestRows.length > 0) {
                    setStudents(latestRows);
                    setNotice("ไม่พบข้อมูลตามปี/ภาคที่เลือก จึงแสดงข้อมูลที่ปรึกษาล่าสุดให้แทน");
                    setLoading(false);
                    return;
                }
            }

            setStudents(rows);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStudents();
    }, [session.id, year, semester]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) => {
            const text = `${s.student_code || ""} ${s.prefix || ""} ${s.first_name || ""} ${s.last_name || ""} ${s.class_level || ""} ${s.room || ""}`.toLowerCase();
            return text.includes(q);
        });
    }, [students, search]);

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Student List</div>
                    <h1 className="text-3xl font-bold">รายชื่อนักเรียน</h1>
                    <p className="text-emerald-100 mt-2">รายชื่อนักเรียนในความดูแล จำนวน {students.length} คน</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 md:items-end">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ปีการศึกษา</label>
                    <input
                        type="number"
                        className="px-3 py-2 border border-slate-200 rounded-xl w-28"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ภาค</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <button onClick={loadStudents} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                    ดึงข้อมูลนักเรียน
                </button>
                <input
                    className="md:ml-auto w-full md:w-96 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="ค้นหานักเรียน..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {notice && <div className="bg-emerald-50 border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-sm">{notice}</div>}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        {students.length === 0 ? "ไม่ได้เป็นครูที่ปรึกษาในปีการศึกษานี้" : "ไม่พบนักเรียน"}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">เลขที่</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">รหัสนักเรียน</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ชื่อ-นามสกุล</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ชั้น/ห้อง</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-600">ดูข้อมูล</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s, i) => (
                                <tr key={s.id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-500">{s.roll_number || "-"}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800 tracking-tight">{s.student_code}</td>
                                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{`${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim()}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{formatClassRoomDisplay(s.class_level, s.room)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <Link href={`/teacher/student_profile?id=${s.id}`} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">ดูโปรไฟล์</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
