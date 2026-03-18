"use client";
import { useEffect, useState } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";

export function ExamCalendarFeature({ session }: { session: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await TeacherApiService.getExamSchedule(session.id);
            setExams(data || []);
        } catch (e: any) {
            setError(e?.message || "โหลดตารางสอบไม่สำเร็จ");
            setExams([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [session.id]);

    const isFallbackAll = exams.length > 0 && exams.some((e) => e.is_fallback_all);

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Exam Schedule</div>
                    <h1 className="text-3xl font-bold">ตารางสอบ</h1>
                    <p className="text-emerald-100 mt-2">ตารางสอบของวิชาที่สอน</p>
                </div>
            </section>

            {isFallbackAll && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm">
                    ไม่พบตารางสอบที่ผูกกับวิชาที่คุณสอน จึงแสดงตารางสอบทั้งหมดของโรงเรียนให้แทน
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-600">{error}</div>
                ) : exams.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">ยังไม่มีตารางสอบ</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">วิชา / Section</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ชั้น/ห้อง</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ผู้สอน</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ประเภท</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">วันที่สอบ</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">เวลา</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ห้องสอบ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((ex, i) => (
                                <tr key={ex.id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-800">
                                        <div className="font-medium">{ex.subject_name || "-"}</div>
                                        <div className="text-xs text-slate-500">{ex.subject_code || "-"} • Section #{ex.section_id ?? "-"}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{(ex.class_level || "-")}/{(ex.classroom || "-")}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{ex.teacher_name || "-"}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${ex.exam_type === "midterm" ? "bg-blue-50 text-blue-700 border border-blue-200" : ex.exam_type === "final" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                                            {ex.exam_type === "midterm" ? "กลางภาค" : ex.exam_type === "final" ? "ปลายภาค" : (ex.exam_type || "-")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{ex.exam_date ? new Date(ex.exam_date).toLocaleDateString("th-TH") : "-"}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{ex.time_range || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{ex.room || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
