"use client";
import { useState, useEffect } from "react";
import { DirectorApiService } from "@/services/director-api.service";

export function StudentCountFeature() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { DirectorApiService.getStudentCount().then(d => { setData(d || []); setLoading(false); }).catch(() => setLoading(false)); }, []);

    const grouped = data.reduce((acc: Record<string, number>, r: any) => {
        const key = r.class_level || "-";
        acc[key] = (acc[key] || 0) + (r.total || 0);
        return acc;
    }, {});

    const total = Object.values(grouped).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Student Count</div>
                    <h1 className="text-3xl font-bold">จำนวนนักเรียน</h1>
                    <p className="text-blue-100 mt-2">สรุปจำนวนนักเรียนแยกตามชั้น (ทั้งหมด {total} คน)</p>
                </div>
            </section>

            {loading ? <div className="bg-white rounded-2xl p-8 text-center text-slate-500">กำลังโหลด...</div> : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Object.entries(grouped).map(([level, count], i) => (
                            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 text-center hover:shadow-md transition-shadow">
                                <div className="text-sm text-slate-500 font-medium mb-1">{level}</div>
                                <div className="text-3xl font-bold text-indigo-700">{count}</div>
                                <div className="text-xs text-slate-400 mt-1">คน</div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200"><h3 className="font-bold text-slate-800">รายละเอียดแยกตามห้อง</h3></div>
                        <table className="w-full"><thead><tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ชั้น</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">ห้อง</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-slate-600">จำนวน</th>
                        </tr></thead><tbody>{data.map((r, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-6 py-3 text-sm text-slate-800 font-medium">{r.class_level || "-"}</td>
                                <td className="px-6 py-3 text-sm text-slate-600">{r.room || "-"}</td>
                                <td className="px-6 py-3 text-sm text-center"><span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{r.total}</span></td>
                            </tr>
                        ))}</tbody></table>
                    </div>
                </>
            )}
        </div>
    );
}
