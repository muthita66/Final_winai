"use client";

import React, { useState, useEffect } from 'react';
import { TeacherApiService } from '@/services/teacher-api.service';
import { getCurrentAcademicYearBE, getAcademicSemesterDefault } from '@/features/student/academic-term';
import { History, X, CheckCircle2, AlertCircle, Clock, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Portal from "@/components/Portal";

interface BehaviorFeatureProps {
    session: any;
}

export function BehaviorFeature({ session }: BehaviorFeatureProps) {
    const isApprover = session.role === 'director' ||
        session.position?.includes('ปกครอง') ||
        session.department?.includes('ปกครอง') ||
        session.department?.includes('กิจการนักเรียน');
    const [students, setStudents] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());
    const [availableYears, setAvailableYears] = useState<any[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
    const [levels, setLevels] = useState<any[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<number | string>('');
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | string>('');

    // Behavior Recording
    const [behaviorTypes, setBehaviorTypes] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isPositive, setIsPositive] = useState(true);
    const [selectedType, setSelectedType] = useState<number | string>('');
    const [points, setPoints] = useState(0);
    const [note, setNote] = useState('');
    const [activeTab, setActiveTab] = useState<'students' | 'pending'>('students');
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isPendingLoading, setIsPendingLoading] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any>(null);
    const [behaviorHistory, setBehaviorHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const fetchPendingRecords = async () => {
        setIsPendingLoading(true);
        try {
            const data = await TeacherApiService.getBehaviorPendingRecords();
            setPendingRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch pending records:', error);
            toast.error('ไม่สามารถโหลดรายการรอนุมัติได้');
        } finally {
            setIsPendingLoading(false);
        }
    };

    const fetchHistory = async (student: any) => {
        setSelectedStudentForHistory(student);
        setIsHistoryModalOpen(true);
        setIsHistoryLoading(true);
        try {
            const data = await TeacherApiService.getBehaviorHistory(student.id);
            setBehaviorHistory(data || []);
        } catch (error) {
            console.error('Failed to fetch history:', error);
            toast.error('ไม่สามารถโหลดประวัติได้');
        } finally {
            setIsHistoryLoading(false);
        }
    };

    useEffect(() => {
        initData();
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [session.id, year, semester, selectedLevel, selectedRoom]);

    // Filter classrooms based on selected level
    const filteredClassrooms = React.useMemo(() => {
        if (!selectedLevel) return [];
        return classrooms.filter(c => c.grade_level_id === Number(selectedLevel));
    }, [classrooms, selectedLevel]);

    useEffect(() => {
        if (selectedLevel && filteredClassrooms.length === 0) {
            // If no rooms found for this level in the pre-fetched list, 
            // maybe try one more API call or just clear the room selection
            setSelectedRoom('');
        }
    }, [selectedLevel, filteredClassrooms]);

    const initData = async () => {
        try {
            const [metaData, classroomsData] = await Promise.all([
                TeacherApiService.getBehaviorMetadata(),
                TeacherApiService.getBehaviorClassrooms() // Fetch all classrooms
            ]);

            setLevels(metaData.levels || []);
            setBehaviorTypes(metaData.behaviorTypes || []);
            setAvailableYears(metaData.academicYears || []);
            setAvailableSemesters(metaData.semesters || []);
            setClassrooms(classroomsData || []);

            // If user is an approver, fetch initial pending records count for the badge
            if (isApprover) {
                fetchPendingRecords();
            }

            // Optionally update initial year/semester if data available
            if (metaData.academicYears?.length > 0) {
                const activeYear = metaData.academicYears.find((y: any) => y.is_active);
                if (activeYear) setYear(Number(activeYear.year_name));
            }
        } catch (error) {
            console.error('Error initializing behavior data:', error);
        }
    };

    const fetchClassrooms = async (levelId: number) => {
        try {
            const data = await TeacherApiService.getBehaviorClassrooms(levelId);
            setClassrooms(data || []);
        } catch (error) {
            console.error('Error fetching classrooms:', error);
        }
    };

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const data = await TeacherApiService.getBehaviorFilteredStudents({
                teacher_id: (session.role === 'teacher' && !isApprover) ? session.id : undefined,
                year,
                semester,
                level_id: selectedLevel ? Number(selectedLevel) : undefined,
                classroom_id: selectedRoom ? Number(selectedRoom) : undefined
            });
            setStudents(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching students:', error);
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (student: any) => {
        setSelectedStudent(student);
        setSelectedType('');
        setPoints(0);
        setNote('');
        setIsModalOpen(true);
    };

    const handleTypeChange = (typeId: string) => {
        setSelectedType(typeId);
        const type = behaviorTypes.find(t => t.id === Number(typeId));
        if (type) {
            setPoints(type.default_points || 0);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await TeacherApiService.approveBehaviorRecord(id);
            fetchPendingRecords();
            // Also refresh students to update scores
            fetchStudents();
        } catch (error) {
            console.error('Error approving record:', error);
        }
    };

    const handleReject = async (id: number) => {
        const reason = window.prompt('ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี)');
        if (reason === null) return;
        try {
            await TeacherApiService.rejectBehaviorRecord(id, reason);
            fetchPendingRecords();
        } catch (error) {
            console.error('Error rejecting record:', error);
        }
    };

    const handleSaveBehavior = async () => {
        if (!selectedStudent || !selectedType || points === 0) return;

        setIsRecording(true);
        try {
            const res = await TeacherApiService.recordBehavior({
                student_id: selectedStudent.id,
                behavior_type_id: Number(selectedType),
                points: isPositive ? Number(points) : -Math.abs(Number(points)),
                note,
                year,
                semester
            });
            setIsModalOpen(false);

            // If director recorded, it's auto-approved, so refresh students
            // If teacher recorded, it's pending, so score won't change yet but we can refresh anyway
            fetchStudents();

            if (isApprover) {
                fetchPendingRecords();
            }

            if (res.status === 'PENDING') {
                toast.success('บันทึกเรียบร้อย (รอการอนุมัติ)');
            } else {
                toast.success('บันทึกพฤติกรรมเรียบร้อย');
            }
        } catch (error) {
            console.error('Error recording behavior:', error);
            toast.error('ไม่สามารถบันทึกพฤติกรรมได้');
        } finally {
            setIsRecording(false);
        }
    };

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        String(s.student_code || "").includes(search)
    );

    const renderStatus = (status: string | null, reason: string | null) => {
        if (!status) return <span className="text-slate-300 font-bold text-center">-</span>;

        const s = status.toUpperCase();
        switch (s) {
            case 'APPROVED':
                return <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg font-bold text-xs whitespace-nowrap">อนุมัติแล้ว</span>;
            case 'PENDING':
                return <span className="px-3 py-1 bg-teal-100 text-teal-600 rounded-lg font-bold text-xs whitespace-nowrap">รอนุมัติ</span>;
            case 'REJECTED':
                return (
                    <div className="flex flex-col items-center gap-1">
                        <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg font-bold text-xs whitespace-nowrap">ไม่อนุมัติ</span>
                        {reason && <span className="text-[10px] text-rose-400 font-bold max-w-[120px] truncate text-center" title={reason}>{reason}</span>}
                    </div>
                );
            default:
                return <span className="text-slate-400 font-bold text-xs">{status}</span>;
        }
    };

    return (
        <>
            <div className="space-y-6 p-4 pb-20">
                {/* Header */}
                <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden mb-6">
                    <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                    <div className="relative z-10">
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 uppercase tracking-wider">Behavior Records</div>
                        <h1 className="text-3xl font-bold">บันทึกพฤติกรรม</h1>
                        <p className="text-emerald-100 mt-2">จัดการพฤติกรรมและความประพฤติของนักเรียน</p>
                    </div>
                </section>

                {/* Tabs (Approver only) */}
                {isApprover && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'students' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            รายชื่อนักเรียน
                        </button>
                        <button
                            onClick={() => { setActiveTab('pending'); fetchPendingRecords(); }}
                            className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all relative ${activeTab === 'pending' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            รายการรอนุมัติ
                            {pendingRecords.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                    {pendingRecords.length}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Filters Area (Only for students tab) */}
                {activeTab === 'students' && (
                    <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 flex flex-wrap items-center gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-2 block">ปีการศึกษา</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                            >
                                {availableYears.map(y => (
                                    <option key={y.id} value={y.year_name}>{y.year_name}</option>
                                ))}
                                {availableYears.length === 0 && <option value={2567}>2567</option>}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-2 block">ภาคเรียน</label>
                            <select
                                value={semester}
                                onChange={(e) => setSemester(Number(e.target.value))}
                                className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                            >
                                {availableSemesters.map(s => (
                                    <option key={s} value={s}> {s}</option>
                                ))}
                                {availableSemesters.length === 0 && (
                                    <>
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-2 block">ระดับชั้น</label>
                            <select
                                value={selectedLevel}
                                onChange={(e) => setSelectedLevel(e.target.value)}
                                className="w-52 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                            >
                                <option value="">ทั้งหมด</option>
                                {levels.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-2 block">ห้อง</label>
                            <select
                                value={selectedRoom}
                                onChange={(e) => setSelectedRoom(e.target.value)}
                                disabled={!selectedLevel}
                                className="w-44 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 disabled:opacity-50"
                            >
                                <option value="">ทั้งหมด</option>
                                {filteredClassrooms.map(c => {
                                    const levelName = levels.find(l => l.id === Number(selectedLevel))?.name || "";
                                    let displayName = c.room_name;
                                    if (levelName && displayName.startsWith(levelName + "/")) {
                                        displayName = displayName.substring(levelName.length + 1);
                                    } else if (displayName.includes("/")) {
                                        displayName = displayName.split("/").pop();
                                    }

                                    return (
                                        <option key={c.id} value={c.id}>{displayName}</option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="flex-1" />

                        <div className="relative group min-w-[300px]">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                placeholder="ชื่อ หรือรหัสประจำตัว..."
                                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Content Table */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div>
                        {activeTab === 'students' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">เลขที่</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">รหัสประจำตัว</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase">ระดับชั้น/ห้อง</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap text-center">คะแนนความประพฤติ</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap text-center">การจัดการ</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap text-center">สถานะ</th>
                                        <th className="px-3 py-5 text-sm font-bold text-slate-500 uppercase whitespace-nowrap text-center">ประวัติ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-slate-400 font-bold text-base tracking-tight">กำลังโหลดข้อมูล...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-20">
                                                <div className="text-slate-300 font-bold text-lg italic tracking-tight uppercase">ไม่พบข้อมูลนักเรียน</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((s) => (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                                                <td className="px-3 py-5">
                                                    <span className="text-slate-900 font-medium text-base">{s.roll_number || '-'}</span>
                                                </td>
                                                <td className="px-3 py-5">
                                                    <span className="text-slate-600 text-sm font-medium tracking-tight">{s.student_code}</span>
                                                </td>
                                                <td className="px-3 py-5">
                                                    <div className="font-normal text-slate-800 text-base group-hover:text-emerald-600 transition-colors tracking-tight">
                                                        {s.prefix}{s.first_name} {s.last_name}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5">
                                                    <div className="text-sm font-medium text-slate-700 tracking-tight">
                                                        {s.class_level}/{s.room.includes('/') ? s.room.split('/')[1] : s.room}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5 text-center">
                                                    <div
                                                        className={`text-base font-bold ${s.behavior_score > 100 ? 'text-emerald-600' :
                                                            s.behavior_score < 100 ? 'text-rose-600' : 'text-slate-600'
                                                            }`}
                                                    >
                                                        {s.behavior_score}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5">
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            onClick={() => handleOpenModal(s)}
                                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/10 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all"
                                                        >
                                                            บันทึกพฤติกรรม
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5 text-center">
                                                    <div className="flex justify-center">
                                                        {renderStatus(s.latest_status, s.latest_reason)}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-5 text-center">
                                                    <button
                                                        onClick={() => fetchHistory(s)}
                                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-emerald-600 group/history"
                                                        title="ดูประวัติ"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest">วันที่</th>
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest">นักเรียน</th>
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest text-center">ระดับชั้น/ห้อง</th>
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest">พฤติกรรม</th>
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest text-center">คะแนน</th>
                                        <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-widest text-right">การจัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isPendingLoading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-20">
                                                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                            </td>
                                        </tr>
                                    ) : pendingRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-20">
                                                <div className="text-slate-300 font-bold text-lg tracking-tight uppercase">ไม่มีรายการรอนุมัติ</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingRecords.map((r) => {
                                            const student = r.students;
                                            const cs = student?.classroom_students?.[0];
                                            const classroom = cs?.classrooms;
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50/50 transition-all group">
                                                    <td className="px-6 py-5 text-sm font-bold text-slate-600">
                                                        {new Date(r.incident_date).toLocaleDateString('th-TH')}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="font-bold text-slate-800 text-base">
                                                            {student?.name_prefixes?.prefix_name}{student?.first_name} {student?.last_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-bold">{student?.student_code}</div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center text-sm font-bold text-slate-700">
                                                        {classroom?.levels?.name}/{classroom?.room_name.split('/')[1] || classroom?.room_name}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col">
                                                            <span className={`text-xs font-black uppercase ${r.behavior_types?.is_positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {r.behavior_types?.is_positive ? 'เชิงบวก' : 'เชิงลบ'}
                                                            </span>
                                                            <span className="font-bold text-slate-700 text-sm mt-0.5">{r.behavior_types?.name}</span>
                                                            {r.note && <span className="text-[10px] text-slate-400 mt-0.5">{r.note}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`font-black text-base ${r.points_awarded > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {r.points_awarded > 0 ? `+${r.points_awarded}` : r.points_awarded}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleReject(r.id)}
                                                                className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg font-bold text-xs hover:bg-rose-100 transition-all"
                                                            >
                                                                ไม่อนุมัติ
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprove(r.id)}
                                                                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-emerald-500/10 hover:bg-emerald-700 transition-all"
                                                            >
                                                                อนุมัติ
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>

            {/* Behavior Modal */}
            {isModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-10 p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />

                        <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Record Behavior</h3>
                                    <p className="text-slate-500 font-medium text-base mt-1">บันทึกพฤติกรรม {selectedStudent?.prefix}{selectedStudent?.first_name} {selectedStudent?.last_name}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-colors border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {/* Toggle Positive/Negative */}
                                <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1.5 rounded-2xl">
                                    <button
                                        onClick={() => { setIsPositive(true); setSelectedType(''); setPoints(0); }}
                                        className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isPositive ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        เชิงบวก (บวกแต้ม)
                                    </button>
                                    <button
                                        onClick={() => { setIsPositive(false); setSelectedType(''); setPoints(0); }}
                                        className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${!isPositive ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${!isPositive ? 'bg-rose-500' : 'bg-slate-300'}`} />
                                        เชิงลบ (หักแต้ม)
                                    </button>
                                </div>

                                {/* Behavior Type Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">หัวข้อพฤติกรรม</label>
                                    <select
                                        value={selectedType}
                                        onChange={(e) => handleTypeChange(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium text-base text-slate-700"
                                    >
                                        <option value="">เลือกหัวข้อการบันทึก...</option>
                                        {behaviorTypes
                                            .filter(t => t.is_positive === isPositive)
                                            .map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div className="grid grid-cols-3 gap-6">
                                    <div className="col-span-1 space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">คะแนน</label>
                                        <input
                                            type="number"
                                            value={points}
                                            onChange={(e) => setPoints(Number(e.target.value))}
                                            className={`w-full px-6 py-4 border rounded-2xl outline-none transition-all font-black text-xl text-center shadow-inner ${isPositive ? 'bg-emerald-50 border-emerald-100 text-emerald-600 focus:ring-4 focus:ring-emerald-500/10' : 'bg-rose-50 border-rose-100 text-rose-600 focus:ring-4 focus:ring-rose-500/10'}`}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">หมายเหตุ (ถ้ามี)</label>
                                        <input
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 bg-white text-slate-500 rounded-xl font-medium text-sm hover:bg-slate-100 transition-all border border-slate-200 active:scale-[0.98]"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleSaveBehavior}
                                    disabled={!selectedType || points === 0 || isRecording}
                                    className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 ${isPositive ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
                                >
                                    {isRecording ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            ยืนยันการบันทึก
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
            {/* History Modal */}
            {isHistoryModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryModalOpen(false)} />

                        <div className="relative bg-white w-full max-w-7xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                        <History className="w-7 h-7 text-emerald-600" />
                                        Behavior History
                                    </h3>
                                    <p className="text-slate-500 font-bold text-sm mt-1">
                                        ประวัติพฤติกรรม: {selectedStudentForHistory?.prefix}{selectedStudentForHistory?.first_name} {selectedStudentForHistory?.last_name}
                                        <span className="ml-2 px-2 py-0.5 bg-emerald-200 text-emerald-700 rounded-lg text-xs font-black">
                                            รหัสประจำตัว: {selectedStudentForHistory?.student_code}
                                        </span>
                                    </p>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-colors border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {isHistoryLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-slate-400 font-bold animate-pulse">กำลังโหลดประวัติ...</p>
                                </div>
                            ) : behaviorHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                    <History className="w-16 h-16 text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-black text-xl uppercase tracking-widest">ไม่พบประวัติการบันทึก</p>
                                    <p className="text-slate-400 font-bold text-sm mt-2">ยังไม่มีการบันทึกพฤติกรรมสำหรับนักเรียนคนนี้</p>
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-100 rounded-[2rem] overflow-x-auto shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">วันที่ - เวลา</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">พฤติกรรม</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">คะแนน</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">หมายเหตุ</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">ครูที่กรอก</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">คนที่อนุมัติ</th>
                                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase whitespace-nowrap">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {behaviorHistory.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base font-normal text-slate-700">
                                                            {new Date(h.created_at).toLocaleDateString('th-TH', {
                                                                day: '2-digit', month: 'short', year: '2-digit'
                                                            })}
                                                        </div>
                                                        <div className="text-xs font-normal text-slate-400">
                                                            {new Date(h.created_at).toLocaleTimeString('th-TH', {
                                                                hour: '2-digit', minute: '2-digit'
                                                            })} น.
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base font-normal text-slate-800">
                                                            {h.behavior_types?.name}
                                                        </div>
                                                        <div className={`text-xs font-medium uppercase ${h.behavior_types?.is_positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {h.behavior_types?.is_positive ? 'เชิงบวก' : 'เชิงลบ'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`text-base font-bold ${h.points_awarded > 0 ? 'text-emerald-600' : h.points_awarded < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                            {h.points_awarded > 0 ? `+${h.points_awarded}` : h.points_awarded}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base font-normal text-slate-500" title={h.note}>
                                                            {h.note || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base font-normal text-slate-600">
                                                            {h.reporter_name || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base font-normal text-slate-600">
                                                            {h.status !== 'PENDING' ? (h.approver_name || '-') : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {renderStatus(h.status, h.reject_reason)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Portal>
        )}
    </>
);
}
