import React, { useState, useEffect } from 'react';
import { TeacherApiService } from '@/services/teacher-api.service';
import Portal from '@/components/Portal';

// Dynamic dropdown options loaded from DB
type DropdownOption = { test_name: string; unit: string };
type LevelOption = { id: number; name: string };

interface FitnessCriteria {
    id: number;
    test_name: string;
    grade_level: string | null;
    gender: string | null;
    passing_threshold: number | null;
    unit: string | null;
    comparison_type: string | null;
    academic_year: number | null;
}

interface GroupedCriteria {
    groupKey: string;
    test_name: string;
    grade_level: string;
    academic_year: number;
    unit: string;
    comparison_type: string;
    male?: FitnessCriteria;
    female?: FitnessCriteria;
    both?: FitnessCriteria;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentYear: number;
    onRefresh?: () => void;
}

const COMPARISON_OPTIONS = [
    { value: '>=', label: 'มากกว่าหรือเท่ากับ (>=)' },
    { value: '<=', label: 'น้อยกว่าหรือเท่ากับ (<=)' },
    { value: '>', label: 'มากกว่า (>)' },
    { value: '<', label: 'น้อยกว่า (<)' },
    { value: '==', label: 'เท่ากับ (==)' },
];

const TEST_TYPES = [
    { id: 'run_50', test_name: 'วิ่ง 50 เมตร', unit: 'วินาที' },
    { id: 'run_1000', test_name: 'วิ่ง 1000 เมตร', unit: 'นาที:วินาที' },
    { id: 'sit_up_60', test_name: 'ลุก-นั่ง 60 วินาที', unit: 'ครั้ง' },
    { id: 'push_up', test_name: 'ดันพื้น', unit: 'ครั้ง' },
    { id: 'sit_reach_flex', test_name: 'นั่งงอตัว', unit: 'เซนติเมตร' },
    { id: 'standing_jump', test_name: 'ยืนกระโดดไกล', unit: 'เซนติเมตร' },
];

const EMPTY_FORM = (currentYear: number) => ({
    test_name: '',
    grade_level: '',
    use_separate_gender: false,
    male_threshold: '',
    female_threshold: '',
    both_threshold: '',
    unit: '',
    comparison_type: '>=',
    academic_year: currentYear.toString()
});

export const FitnessCriteriaManagement: React.FC<Props> = ({ isOpen, onClose, currentYear, onRefresh }) => {
    const [criteria, setCriteria] = useState<FitnessCriteria[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGrade, setFilterGrade] = useState('ทั้งหมด');
    const [filterGender, setFilterGender] = useState('ทั้งหมด');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM(currentYear));
    const [editingIds, setEditingIds] = useState<{ male?: number; female?: number; both?: number }>({});
    const [dropdownTestNames, setDropdownTestNames] = useState<DropdownOption[]>([]);
    const [dropdownLevels, setDropdownLevels] = useState<LevelOption[]>([]);
    const [ddLoading, setDdLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCriteria();
            fetchDropdownOptions();
        }
    }, [isOpen]);

    const fetchDropdownOptions = async () => {
        setDdLoading(true);
        try {
            const res = await fetch('/api/teacher/fitness?action=dropdown-options');
            const json = await res.json();
            if (json?.data) {
                setDropdownTestNames(json.data.testNames || []);
                setDropdownLevels(json.data.levels || []);
            }
        } catch (e) {
            console.error('Failed to fetch dropdown options', e);
        } finally {
            setDdLoading(false);
        }
    };

    const fetchCriteria = async () => {
        setLoading(true);
        try {
            const data = await TeacherApiService.getAllFitnessCriteria();
            setCriteria(data || []);
        } catch (error) {
            console.error('Failed to fetch criteria', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingIds({});
        setFormData(EMPTY_FORM(currentYear));
    };

    const handleEditGroup = (group: GroupedCriteria) => {
        const isSeparate = !!(group.male || group.female) && !group.both;
        setFormData({
            test_name: group.test_name,
            grade_level: group.grade_level || '',
            use_separate_gender: isSeparate,
            male_threshold: (group.male?.passing_threshold && group.male.passing_threshold !== 0) ? group.male.passing_threshold.toString() : '',
            female_threshold: (group.female?.passing_threshold && group.female.passing_threshold !== 0) ? group.female.passing_threshold.toString() : '',
            both_threshold: (group.both?.passing_threshold && group.both.passing_threshold !== 0) ? group.both.passing_threshold.toString() : '',
            unit: group.unit || '',
            comparison_type: group.comparison_type || '>=',
            academic_year: group.academic_year?.toString() || currentYear.toString()
        });
        setEditingIds({ male: group.male?.id, female: group.female?.id, both: group.both?.id });
        setShowForm(true);
    };

    const handleDeleteGroup = async (group: GroupedCriteria) => {
        if (!confirm(`ยืนยันการลบทดสอบ "${group.test_name}" นี้หรือไม่?`)) return;
        try {
            const idsToDelete = [group.male?.id, group.female?.id, group.both?.id].filter(id => id != null);
            await Promise.all(idsToDelete.map(id => TeacherApiService.deleteFitnessCriteria(id!)));
            fetchCriteria();
            onRefresh?.();
        } catch (error) {
            alert('ลบไม่สำเร็จ');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.use_separate_gender) {
                if (formData.male_threshold) {
                    await TeacherApiService.upsertFitnessCriteria({
                        id: editingIds.male, test_name: formData.test_name, grade_level: formData.grade_level,
                        gender: 'ชาย', passing_threshold: formData.male_threshold, unit: formData.unit,
                        comparison_type: formData.comparison_type, academic_year: parseInt(formData.academic_year)
                    });
                }
                if (formData.female_threshold) {
                    await TeacherApiService.upsertFitnessCriteria({
                        id: editingIds.female, test_name: formData.test_name, grade_level: formData.grade_level,
                        gender: 'หญิง', passing_threshold: formData.female_threshold, unit: formData.unit,
                        comparison_type: formData.comparison_type, academic_year: parseInt(formData.academic_year)
                    });
                }
                if (editingIds.both) await TeacherApiService.deleteFitnessCriteria(editingIds.both);
            } else {
                await TeacherApiService.upsertFitnessCriteria({
                    id: editingIds.both, test_name: formData.test_name, grade_level: formData.grade_level,
                    gender: 'ทั้งหมด', passing_threshold: formData.both_threshold, unit: formData.unit,
                    comparison_type: formData.comparison_type, academic_year: parseInt(formData.academic_year)
                });
                if (editingIds.male) await TeacherApiService.deleteFitnessCriteria(editingIds.male);
                if (editingIds.female) await TeacherApiService.deleteFitnessCriteria(editingIds.female);
            }
            resetForm();
            fetchCriteria();
            onRefresh?.();
        } catch (error) {
            alert('บันทึกไม่สำเร็จ');
        }
    };

    if (!isOpen) return null;

    const filteredCriteria = criteria.filter(c => {
        const matchesSearch = c.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.grade_level || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGrade = filterGrade === 'ทั้งหมด' || c.grade_level === filterGrade;
        const matchesGender = filterGender === 'ทั้งหมด' || c.gender === filterGender;
        return matchesSearch && matchesGrade && matchesGender;
    });

    const groups: Record<string, GroupedCriteria> = {};
    filteredCriteria.forEach(c => {
        const key = `${c.test_name}-${c.grade_level}-${c.academic_year}`;
        if (!groups[key]) {
            groups[key] = {
                groupKey: key, test_name: c.test_name, grade_level: c.grade_level || '',
                academic_year: c.academic_year || currentYear, unit: c.unit || '', comparison_type: c.comparison_type || '>=',
            };
        }
        if (c.gender === 'ชาย') groups[key].male = c;
        else if (c.gender === 'หญิง') groups[key].female = c;
        else groups[key].both = c;
    });

    const groupedList = Object.values(groups);
    const isEditing = Object.values(editingIds).some(v => v != null);

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-md">

                {/* ════ MAIN PANEL ════ */}
                <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-[1200px] overflow-hidden flex flex-col h-[90vh] border border-white/10">

                    {/* Header */}
                    <div className="px-7 py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">จัดการเกณฑ์มาตรฐาน</h2>
                                <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Fitness Assessment Standards Center</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { resetForm(); setShowForm(true); }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 transition-all hover:scale-105 active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                เพิ่มรายการ
                            </button>
                            <button onClick={onClose} className="p-2.5 rounded-xl bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all border border-slate-200">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="px-7 py-3 bg-white border-b border-slate-100 shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative group flex-1 min-w-[180px]">
                                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ค้นหาชื่อการทดสอบ..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-300 focus:bg-white transition-all" />
                            </div>
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                                <button onClick={() => setFilterGrade('ทั้งหมด')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterGrade === 'ทั้งหมด' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ทั้งหมด</button>
                                {dropdownLevels.map(l => (
                                    <button key={l.id} onClick={() => setFilterGrade(l.name)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterGrade === l.name ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{l.name}</button>
                                ))}
                            </div>
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                {['ทั้งหมด', 'ชาย', 'หญิง'].map(g => (
                                    <button key={g} onClick={() => setFilterGender(g)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{g}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Criteria List */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
                                <p className="text-sm font-bold text-slate-400 animate-pulse">กำลังโหลดข้อมูล...</p>
                            </div>
                        ) : groupedList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <h4 className="text-lg font-black text-slate-700 mb-1">ไม่พบเกณฑ์มาตรฐาน</h4>
                                <p className="text-sm text-slate-400 mb-5">กดปุ่ม "เพิ่มรายการ" เพื่อสร้างเกณฑ์ใหม่</p>
                                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    เพิ่มรายการ
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {groupedList.map((group) => (
                                    <div key={group.groupKey} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        {/* Grade Badge */}
                                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase leading-none">ชั้น</span>
                                            <span className="text-xl font-black text-emerald-600">{group.grade_level?.match(/\d+/)?.[0] || '—'}</span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className="text-base font-extrabold text-slate-800">{group.test_name}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">ปี {group.academic_year}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 flex-wrap">
                                                <span className="px-2 py-0.5 bg-slate-50 rounded-lg border border-slate-100">{group.grade_level}</span>
                                                <span>เกณฑ์ {group.comparison_type}</span>
                                            </div>
                                        </div>

                                        {/* Threshold */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {group.both ? (
                                                <div className="px-5 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[140px]">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">ชาย & หญิง</div>
                                                    <div className="text-2xl font-black text-slate-800">{group.both.passing_threshold} <span className="text-xs font-bold text-slate-400">{group.unit}</span></div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <div className="px-4 py-2 bg-white rounded-xl border-l-4 border-teal-400 border border-slate-100 text-center min-w-[90px]">
                                                        <div className="text-[9px] font-bold text-teal-500 uppercase mb-0.5">ชาย</div>
                                                        <div className="text-lg font-black text-teal-600">{group.male?.passing_threshold ?? '—'} <span className="text-xs font-bold text-slate-400">{group.unit}</span></div>
                                                    </div>
                                                    <div className="px-4 py-2 bg-white rounded-xl border-l-4 border-emerald-400 border border-slate-100 text-center min-w-[90px]">
                                                        <div className="text-[9px] font-bold text-emerald-500 uppercase mb-0.5">หญิง</div>
                                                        <div className="text-lg font-black text-emerald-600">{group.female?.passing_threshold ?? '—'} <span className="text-xs font-bold text-slate-400">{group.unit}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => handleEditGroup(group)} className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-slate-400 bg-white border border-slate-200 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-xs font-bold">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                แก้ไข
                                            </button>
                                            <button onClick={() => handleDeleteGroup(group)} className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-slate-400 bg-white border border-slate-200 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all text-xs font-bold">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2" /></svg>
                                                ลบ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ════ POPUP FORM MODAL ════ */}
                {showForm && (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={e => { if (e.target === e.currentTarget) resetForm(); }}
                    >
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            {isEditing
                                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                            }
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">{isEditing ? 'แก้ไขเกณฑ์มาตรฐาน' : 'เพิ่มเกณฑ์ใหม่'}</h3>
                                        <p className="text-[11px] text-slate-400 font-medium">กรอกข้อมูลด้านล่างแล้วกดบันทึก</p>
                                    </div>
                                </div>
                                <button onClick={resetForm} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Form Body */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <form id="criteria-form" onSubmit={handleSubmit} className="space-y-5">
                                    {/* Test Name */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">ชื่อรายการทดสอบ</label>
                                        <select required value={formData.test_name}
                                            onChange={e => {
                                                const selected = TEST_TYPES.find(t => t.test_name === e.target.value);
                                                setFormData({ ...formData, test_name: e.target.value, unit: selected?.unit || formData.unit });
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-800 text-sm font-medium outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer">
                                            <option value="">เลือกรายการทดสอบ...</option>
                                            {TEST_TYPES.map((t, i) => (
                                                <option key={i} value={t.test_name}>{t.test_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Grade Level */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">ระดับชั้น</label>
                                        <select required value={formData.grade_level}
                                            onChange={e => setFormData({ ...formData, grade_level: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-medium outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer">
                                            <option value="">เลือกชั้น...</option>
                                            {ddLoading ? <option disabled>กำลังโหลด...</option> : dropdownLevels.map(l => (
                                                <option key={l.id} value={l.name}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Gender Toggle */}
                                    <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                                        <button type="button" onClick={() => setFormData({ ...formData, use_separate_gender: false })}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${!formData.use_separate_gender ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                                            ใช้เกณฑ์เดียวกัน
                                        </button>
                                        <button type="button" onClick={() => setFormData({ ...formData, use_separate_gender: true })}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${formData.use_separate_gender ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                                            แยกตามเพศ
                                        </button>
                                    </div>

                                    {/* Threshold Inputs */}
                                    {formData.use_separate_gender ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-teal-500 uppercase tracking-wide flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />เกณฑ์ผ่าน (ชาย)
                                                </label>
                                                <input type="number" step="0.01" required value={formData.male_threshold}
                                                    onChange={e => setFormData({ ...formData, male_threshold: e.target.value })}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-teal-100 bg-teal-50/30 text-sm font-medium outline-none focus:border-teal-400 transition-all"
                                                    placeholder="0.00" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />เกณฑ์ผ่าน (หญิง)
                                                </label>
                                                <input type="number" step="0.01" required value={formData.female_threshold}
                                                    onChange={e => setFormData({ ...formData, female_threshold: e.target.value })}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-100 bg-emerald-50/30 text-sm font-medium outline-none focus:border-emerald-400 transition-all"
                                                    placeholder="0.00" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">เกณฑ์ผ่าน (ชาย/หญิง)</label>
                                            <input type="number" step="0.01" required value={formData.both_threshold}
                                                onChange={e => setFormData({ ...formData, both_threshold: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-medium outline-none focus:border-emerald-400 transition-all"
                                                placeholder="0.00" />
                                        </div>
                                    )}

                                    {/* Unit & Comparison */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">หน่วยข้อมูล</label>
                                            <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-medium outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer">
                                                <option value="">เลือกหน่วย...</option>
                                                {[...new Map(dropdownTestNames.filter(t => t.unit).map(t => [t.unit, t])).values()].map((t, i) => (
                                                    <option key={i} value={t.unit}>{t.unit}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">เปรียบเทียบ</label>
                                            <select value={formData.comparison_type} onChange={e => setFormData({ ...formData, comparison_type: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-medium outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer">
                                                {COMPARISON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                                <button type="button" onClick={resetForm}
                                    className="flex-1 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-100 transition-all">
                                    ยกเลิก
                                </button>
                                <button type="submit" form="criteria-form"
                                    className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 transition-all hover:scale-[1.02] active:scale-95">
                                    บันทึกข้อมูล
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </Portal>
    );
};
