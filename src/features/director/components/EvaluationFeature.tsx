"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";

export function EvaluationFeature() {
    const [topics, setTopics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [semester, setSemester] = useState<number>(1);
    const [type, setType] = useState<'teaching' | 'advisor' | 'activity'>('teaching');

    // Fetch academic years on mount
    useEffect(() => {
        DirectorApiService.getAcademicYears().then(data => {
            setAcademicYears(data || []);
            // Set initial year/semester from active one if found
            const activeYear = data?.find((y: any) => y.is_active) || data?.[0];
            if (activeYear) {
                setYear(Number(activeYear.year_name));
                const activeSem = activeYear.semesters?.find((s: any) => s.is_active) || activeYear.semesters?.[0];
                if (activeSem) {
                    setSemester(Number(activeSem.semester_number));
                }
            }
        }).catch(err => console.error("Failed to load academic years", err));
    }, []);

    const load = () => {
        setLoading(true);
        DirectorApiService.getEvaluationSummary(year, semester, type)
            .then(async (rows) => {
                const list = rows || [];
                setTopics(list);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        if (year && semester) {
            load();
        }
    }, [year, semester, type]);

    const typeLabels = {
        teaching: "นักเรียนประเมินครู (การเรียนการสอน)",
        advisor: "ครูประเมินนักเรียน (ครูที่ปรึกษา)",
        activity: "การประเมินกิจกรรม",
    };

    const selectedYearData = academicYears.find(y => Number(y.year_name) === year);
    const availableSemesters = selectedYearData?.semesters || [];

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Evaluation</div>
                    <h1 className="text-3xl font-bold">ผลการประเมิน</h1>
                    <p className="text-emerald-50 mt-2">สรุปผลประเมิน ปี {year} / ภาค {semester}</p>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-slate-500 block mb-1">ประเภทการประเมิน</label>
                        <select 
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium" 
                            value={type} 
                            onChange={(e) => setType(e.target.value as any)}
                        >
                            <option value="teaching">นักเรียนประเมินครู (วิชาที่สอน)</option>
                            <option value="advisor">ครูประเมินนักเรียน (ในที่ปรึกษา)</option>
                            <option value="activity">ประเมินกิจกรรม / โครงการ</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">ปีการศึกษา</label>
                        <select 
                            className="px-3 py-2 border border-slate-200 rounded-xl w-32 bg-slate-50 font-medium" 
                            value={year} 
                            onChange={(e) => {
                                const newYear = Number(e.target.value);
                                setYear(newYear);
                                // Try to reset semester to active one for new year or first one
                                const yData = academicYears.find(y => Number(y.year_name) === newYear);
                                if (yData?.semesters?.length) {
                                    const activeSem = yData.semesters.find((s: any) => s.is_active) || yData.semesters[0];
                                    setSemester(Number(activeSem.semester_number));
                                }
                            }}
                        >
                            {academicYears.map(y => (
                                <option key={y.id} value={Number(y.year_name)}>{y.year_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">ภาคเรียน</label>
                        <select 
                            className="px-3 py-2 border border-slate-200 rounded-xl w-24 bg-slate-50 font-medium" 
                            value={semester} 
                            onChange={(e) => setSemester(Number(e.target.value))}
                        >
                            {availableSemesters.map((s: any) => (
                                <option key={s.id} value={Number(s.semester_number)}>{s.semester_number}</option>
                            ))}
                            {!availableSemesters.length && <option value={semester}>{semester}</option>}
                        </select>
                    </div>
                    <button onClick={load} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                        ดึงข้อมูล
                    </button>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex flex-col justify-center items-center text-center">
                    <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">รวมทั้งสิ้น</span>
                    <span className="text-3xl font-black text-emerald-700">{topics.length}</span>
                    <span className="text-xs text-emerald-500 mt-1">รายการที่พบ</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">{typeLabels[type]}</h3>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังประมวลผลข้อมูล...</span>
                    </div>
                ) : topics.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <div className="mb-2 text-4xl">empty</div>
                        <p>ยังไม่มีข้อมูลการประเมินในหมวดหมู่นี้</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {type === 'activity' ? 'ชื่อกิจกรรม' : type === 'teaching' ? 'ครูผู้สอน / รายวิชา' : 'นักเรียน'}
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">จำนวนผู้ตอบ</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">คะแนนเฉลี่ย</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">ระดับ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topics.map((t, i) => {
                                    const score = Number(t.avg_score || 0);
                                    let level = "ปรับปรุง";
                                    let color = "bg-red-100 text-red-700 border-red-200";
                                    if (score >= 4.5) { level = "ดีเยี่ยม"; color = "bg-emerald-100 text-emerald-700 border-emerald-200"; }
                                    else if (score >= 3.5) { level = "ดี"; color = "bg-blue-100 text-blue-700 border-blue-200"; }
                                    else if (score >= 2.5) { level = "พอใช้"; color = "bg-emerald-50 text-emerald-600 border-emerald-100"; }

                                    return (
                                        <tr key={t.id || i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-400">{i + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-800">{t.name}</div>
                                                {t.sub_name && <div className="text-xs text-slate-500 mt-0.5">{t.sub_name}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-medium text-slate-600">{t.responses_count || 0}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-lg font-black text-slate-800">{score.toFixed(2)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${color}`}>
                                                    {level}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
