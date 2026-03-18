"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";

export function EvaluationFeature() {
    const [topics, setTopics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());
    const [semester, setSemester] = useState(1);

    const load = () => {
        setLoading(true);
        DirectorApiService.getEvaluationSummary(year, semester)
            .then(async (rows) => {
                const list = rows || [];

                if (list.length === 0 && year < 2400) {
                    const beYear = year + 543;
                    const beRows = (await DirectorApiService.getEvaluationSummary(beYear, semester).catch(() => [])) || [];
                    if (beRows.length > 0) {
                        setYear(beYear);
                        setTopics(beRows);
                        setLoading(false);
                        return;
                    }
                }

                if (list.length === 0) {
                    const allRows = (await DirectorApiService.getEvaluationSummary().catch(() => [])) || [];
                    if (allRows.length > 0) {
                        const latest = allRows.find((t: any) => t?.year != null && t?.semester != null) || allRows[0];
                        const latestYear = Number(latest.year) || year;
                        const latestSemester = Number(latest.semester) || semester;
                        const latestRows = allRows.filter((t: any) => Number(t.year) === latestYear && Number(t.semester) === latestSemester);
                        if (latestRows.length > 0) {
                            setYear(latestYear);
                            setSemester(latestSemester);
                            setTopics(latestRows);
                            setLoading(false);
                            return;
                        }
                    }
                }

                setTopics(list);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [year, semester]);

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Evaluation</div>
                    <h1 className="text-3xl font-bold">ผลการประเมิน</h1>
                    <p className="text-amber-100 mt-2">สรุปผลประเมินสมรรถนะ ปี {year} / ภาค {semester}</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex gap-3 items-end">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ปีการศึกษา</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-xl w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">ภาคเรียน</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <button onClick={load} className="px-5 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors">
                    ดึงข้อมูล
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
                ) : topics.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">ยังไม่มีข้อมูลประเมิน</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ลำดับที่</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">หัวข้อ</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-600">คะแนนเฉลี่ย</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topics.map((t, i) => (
                                <tr key={t.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-6 py-4 text-sm text-slate-500">{i + 1}</td>
                                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{t.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            {t.avg_score ? Number(t.avg_score).toFixed(1) : "-"}
                                        </span>
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
