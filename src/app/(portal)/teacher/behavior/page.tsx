'use client';

import React, { useState, useEffect } from 'react';

export default function BehaviorPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAdvisoryStudents();
    }, []);

    const fetchAdvisoryStudents = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/teacher/students/advisory');
            const data = await res.json();
            setStudents(data);
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        s.student_code.includes(search)
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800">บันทึกพฤติกรรม</h1>
                    <p className="text-slate-500 mt-1">จัดการพฤติกรรมและความประพฤติของนักเรียนในที่ปรึกษา</p>
                </div>
                <button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg shadow-blue-100 transition-all active:scale-95">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    บันทึกใหม่
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-slate-50/30">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        รายชื่อนักเรียนในที่ปรึกษา
                    </h3>
                    <div className="flex items-center gap-4 pt-6">
                        <div className="relative flex-1 group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                placeholder="ค้นหาชื่อ หรือรหัสประจำตัวนักเรียน..."
                                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={search}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                            />
                        </div>
                        <button className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm hover:border-slate-300">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">รหัสประจำตัว</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">ห้อง</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">พฤติกรรม</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">สถานะ</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-slate-400 font-medium">กำลังโหลดข้อมูล...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-20">
                                        <div className="text-slate-400 font-medium italic">ไม่พบข้อมูลนักเรียน</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((s) => (
                                    <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-8 py-6 font-mono text-sm text-slate-500">{s.student_code}</td>
                                        <td className="px-8 py-6 font-bold text-slate-700">{s.prefix}{s.first_name} {s.last_name}</td>
                                        <td className="px-8 py-6 text-center text-slate-600 font-medium">{s.class_level}/{s.room}</td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="inline-flex items-center gap-1.5 font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                100
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-bold">
                                                ปกติ
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all">รายละเอียด</button>
                                                <button className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all">หักคะแนน</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
