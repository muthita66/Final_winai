"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";

interface ConductFeatureProps {
    session: any;
}

export function ConductFeature({ session }: ConductFeatureProps) {
    const student = session;

    // Data state
    // Queries
    const scoreQuery = useQuery({
        queryKey: ["student", "conduct", "score"],
        queryFn: () => StudentApiService.getConductScore(),
    });

    const historyQuery = useQuery({
        queryKey: ["student", "conduct", "history"],
        queryFn: () => StudentApiService.getConductHistory(),
    });

    const score = scoreQuery.data?.score || 0;
    const history = historyQuery.data || [];
    const isLoading = scoreQuery.isLoading || historyQuery.isLoading;
    const fetchError = (scoreQuery.error as any)?.message || (historyQuery.error as any)?.message;

    const formatThaiDate = (dateString: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <section className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="w-full md:w-1/2">
                        <Skeleton variant="rounded" className="h-4 w-20 mb-3 bg-white/20" />
                        <Skeleton variant="rounded" className="h-7 w-48 mb-1 bg-white/20" />
                        <Skeleton variant="rounded" className="h-4 w-72 bg-white/20" />
                    </div>
                    <div className="flex justify-center items-center">
                        <Skeleton variant="circular" className="w-40 h-40 bg-white/20" />
                    </div>
                </section>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <Skeleton variant="rounded" className="h-6 w-48 mb-6" />
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} variant="rounded" className="h-12 w-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-red-500">
                <p>{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
                <div className="relative z-10 w-full md:w-1/2">
                    <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-3 backdrop-blur-sm border border-white/20">
                        Conduct
                    </div>
                    <h1 className="text-2xl font-bold mb-1 text-white">คะแนนความประพฤติ</h1>
                    <p className="text-teal-100 text-sm mb-4">
                        ติดตามคะแนนและประวัติการปรับคะแนนตลอดปีการศึกษา
                    </p>
                    <div className="flex gap-4">
                        <div className="bg-black/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                            <div className="text-[10px] uppercase tracking-wider text-teal-200 mb-0.5 font-semibold">สถานะ</div>
                            <div className="text-sm font-medium text-white flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${score < 0 ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                {score < 0 ? 'ต้องปรับปรุง' : 'ปกติ'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex justify-center items-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                                className="text-white/20"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="42"
                                cx="50"
                                cy="50"
                            />
                            {/* Simple circle visualization, no actual progress calculation based on dynamic max since score can be infinite. Old code just had a static ring. */}
                            <circle
                                className={score <= 0 ? "text-red-400" : "text-white"}
                                strokeWidth="8"
                                strokeDasharray={264}
                                strokeDashoffset={264 - (Math.max(0, Math.min(100, score)) * 264 / 100)}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="42"
                                cx="50"
                                cy="50"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                            <span className="text-4xl font-bold tracking-tighter" style={{ color: score < 0 ? '#fca5a5' : 'white' }}>
                                {score}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-teal-100 mt-0.5">คะแนนปัจจุบัน</span>
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500 rounded-full blur-2xl opacity-50"></div>
            </section>

            {/* History Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">ประวัติการตัด/เพิ่มคะแนน</h3>
                        <p className="text-slate-500 text-sm">ย้อนหลัง</p>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-medium rounded-tl-xl whitespace-nowrap">วันที่</th>
                                <th className="px-6 py-4 font-medium w-full">รายการ</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">ผู้กรอก</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">ผู้อนุมัติ</th>
                                <th className="px-6 py-4 font-medium text-right rounded-tr-xl whitespace-nowrap">คะแนน</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        ยังไม่มีประวัติการตัด/เพิ่มคะแนนความประพฤติ
                                    </td>
                                </tr>
                            ) : (
                                history.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {formatThaiDate(row.log_date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${row.is_positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {row.is_positive ? 'เชิงบวก' : 'เชิงลบ'}
                                                </span>
                                                <span className="font-semibold text-slate-800">{row.event || "-"}</span>
                                            </div>
                                            {row.note && (
                                                <div className="text-xs text-slate-500 line-clamp-1 ml-1" title={row.note}>
                                                    {row.note}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {row.reporter_name || <span className="text-slate-400">-</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {row.approver_name || <span className="text-slate-400">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-lg text-sm ${row.point < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {row.point > 0 ? '+' : ''}{row.point}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
