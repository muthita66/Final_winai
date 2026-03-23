import React, { useState, useEffect } from 'react';
import { TeacherApiService } from '@/services/teacher-api.service';
import Portal from '@/components/Portal';

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

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentYear: number;
}

const COMPARISON_OPTIONS = [
    { value: '>=', label: 'มากกว่าหรือเท่ากับ (>=)' },
    { value: '<=', label: 'น้อยกว่าหรือเท่ากับ (<=)' },
    { value: '>', label: 'มากกว่า (>)' },
    { value: '<', label: 'น้อยกว่า (<)' },
    { value: '==', label: 'เท่ากับ (==)' },
];

const GENDER_OPTIONS = [
    { value: 'ชาย', label: 'ชาย' },
    { value: 'หญิง', label: 'หญิง' },
    { value: 'ทั้งหมด', label: 'ทั้งหมด' },
];

const GRADE_OPTIONS = [
    { value: 'มัธยมศึกษาปีที่ 1', label: 'ม.1' },
    { value: 'มัธยมศึกษาปีที่ 2', label: 'ม.2' },
    { value: 'มัธยมศึกษาปีที่ 3', label: 'ม.3' },
    { value: 'มัธยมศึกษาปีที่ 4', label: 'ม.4' },
    { value: 'มัธยมศึกษาปีที่ 5', label: 'ม.5' },
    { value: 'มัธยมศึกษาปีที่ 6', label: 'ม.6' },
];

export const FitnessCriteriaManagement: React.FC<Props> = ({ isOpen, onClose, currentYear }) => {
    const [criteria, setCriteria] = useState<FitnessCriteria[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGrade, setFilterGrade] = useState('ทั้งหมด');
    const [filterGender, setFilterGender] = useState('ทั้งหมด');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
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

    const [editingIds, setEditingIds] = useState<{ male?: number; female?: number; both?: number }>({});

    useEffect(() => {
        if (isOpen) {
            fetchCriteria();
        }
    }, [isOpen]);

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

    const handleEditGroup = (group: GroupedCriteria) => {
        const isSeparate = !!(group.male || group.female) && !group.both;
        setFormData({
            test_name: group.test_name,
            grade_level: group.grade_level || '',
            use_separate_gender: isSeparate,
            male_threshold: group.male?.passing_threshold?.toString() || '',
            female_threshold: group.female?.passing_threshold?.toString() || '',
            both_threshold: group.both?.passing_threshold?.toString() || '',
            unit: group.unit || '',
            comparison_type: group.comparison_type || '>=',
            academic_year: group.academic_year?.toString() || currentYear.toString()
        });
        setEditingIds({
            male: group.male?.id,
            female: group.female?.id,
            both: group.both?.id
        });
        setShowForm(true);
    };

    const handleDeleteGroup = async (group: GroupedCriteria) => {
        if (!confirm(`ยืนยันการลบทดสอบ "${group.test_name}" นี้หรือไม่?`)) return;
        try {
            const idsToDelete = [group.male?.id, group.female?.id, group.both?.id].filter(id => id != null);
            await Promise.all(idsToDelete.map(id => TeacherApiService.deleteFitnessCriteria(id!)));
            fetchCriteria();
        } catch (error) {
            alert('ลบไม่สำเร็จ');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.use_separate_gender) {
                // Upsert Male
                if (formData.male_threshold) {
                    await TeacherApiService.upsertFitnessCriteria({
                        id: editingIds.male,
                        test_name: formData.test_name,
                        grade_level: formData.grade_level,
                        gender: 'ชาย',
                        passing_threshold: formData.male_threshold,
                        unit: formData.unit,
                        comparison_type: formData.comparison_type,
                        academic_year: parseInt(formData.academic_year)
                    });
                }
                // Upsert Female
                if (formData.female_threshold) {
                    await TeacherApiService.upsertFitnessCriteria({
                        id: editingIds.female,
                        test_name: formData.test_name,
                        grade_level: formData.grade_level,
                        gender: 'หญิง',
                        passing_threshold: formData.female_threshold,
                        unit: formData.unit,
                        comparison_type: formData.comparison_type,
                        academic_year: parseInt(formData.academic_year)
                    });
                }
                // Delete "Both" if it existed
                if (editingIds.both) {
                    await TeacherApiService.deleteFitnessCriteria(editingIds.both);
                }
            } else {
                // Upsert "Both"
                await TeacherApiService.upsertFitnessCriteria({
                    id: editingIds.both,
                    test_name: formData.test_name,
                    grade_level: formData.grade_level,
                    gender: 'ทั้งหมด',
                    passing_threshold: formData.both_threshold,
                    unit: formData.unit,
                    comparison_type: formData.comparison_type,
                    academic_year: parseInt(formData.academic_year)
                });
                // Delete Male/Female if they existed
                if (editingIds.male) await TeacherApiService.deleteFitnessCriteria(editingIds.male);
                if (editingIds.female) await TeacherApiService.deleteFitnessCriteria(editingIds.female);
            }
            
            setShowForm(false);
            setEditingIds({});
            setFormData({
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
            fetchCriteria();
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

    // Grouping Logic
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

    const groups: Record<string, GroupedCriteria> = {};
    filteredCriteria.forEach(c => {
        const key = `${c.test_name}-${c.grade_level}-${c.academic_year}`;
        if (!groups[key]) {
            groups[key] = {
                groupKey: key,
                test_name: c.test_name,
                grade_level: c.grade_level || '',
                academic_year: c.academic_year || currentYear,
                unit: c.unit || '',
                comparison_type: c.comparison_type || '>=',
            };
        }
        if (c.gender === 'ชาย') groups[key].male = c;
        else if (c.gender === 'หญิง') groups[key].female = c;
        else groups[key].both = c;
    });

    const groupedList = Object.values(groups);

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md transition-all duration-500">
                <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-[98vw] xl:max-w-[1550px] overflow-hidden flex flex-col h-[94vh] max-h-[94vh] border border-white/20 animate-in zoom-in-95 duration-300">
                    {/* Modern Header */}
                    <div className="px-10 py-8 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200 border border-white/20">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">จัดการเกณฑ์มาตรฐาน</h2>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Fitness Assessment Standards Center</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {!showForm && (
                                <button 
                                    onClick={() => setShowForm(true)}
                                    className="px-8 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-black shadow-xl shadow-slate-200 hover:bg-slate-800 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    เพิ่มรายการใหม่
                                </button>
                            )}
                            <button onClick={onClose} className="p-3.5 rounded-2xl bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row relative">
                        {/* Integrated Form Sidebar */}
                        <div 
                            className={`absolute lg:relative z-20 top-0 left-0 h-full max-h-full bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-500 transform ${
                                showForm ? 'translate-x-0 w-full lg:w-[450px] opacity-100' : '-translate-x-full lg:w-0 opacity-0'
                            }`}
                        >
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                    {Object.keys(editingIds).length > 0 ? 'แก้ไขข้อมูลเกณฑ์' : 'เพิ่มข้อมูลใหม่'}
                                </h3>
                                <button onClick={() => { setShowForm(false); setEditingIds({}); }} className="lg:hidden text-slate-400">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <form id="criteria-form" onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อรายการทดสอบ</label>
                                        <input 
                                            required 
                                            value={formData.test_name}
                                            onChange={e => setFormData({...formData, test_name: e.target.value})}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="เช่น วิ่ง 50 เมตร, ลุก-นั่ง"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ระดับชั้น</label>
                                            <select 
                                                required
                                                value={formData.grade_level}
                                                onChange={e => setFormData({...formData, grade_level: e.target.value})}
                                                className="w-full px-4 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="">เลือกชั้น...</option>
                                                {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        
                                        <div className="p-1 bg-slate-100 rounded-2xl flex gap-1">
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, use_separate_gender: false})}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${!formData.use_separate_gender ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                                            >ใช้เกณฑ์เดียวกัน</button>
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, use_separate_gender: true})}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${formData.use_separate_gender ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                                            >แยกตามเพศ</button>
                                        </div>
                                    </div>

                                    {formData.use_separate_gender ? (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-teal-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />เกณฑ์ผ่าน (ชาย)
                                                </label>
                                                <input 
                                                    type="number" step="0.01" required
                                                    value={formData.male_threshold}
                                                    onChange={e => setFormData({...formData, male_threshold: e.target.value})}
                                                    className="w-full px-5 py-4 rounded-2xl border-2 border-teal-50 bg-teal-50/30 text-sm font-bold outline-none focus:border-teal-400 focus:bg-white transition-all shadow-sm shadow-teal-500/5 placeholder:text-teal-200"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-emerald-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />เกณฑ์ผ่าน (หญิง)
                                                </label>
                                                <input 
                                                    type="number" step="0.01" required
                                                    value={formData.female_threshold}
                                                    onChange={e => setFormData({...formData, female_threshold: e.target.value})}
                                                    className="w-full px-5 py-4 rounded-2xl border-2 border-emerald-50 bg-emerald-50/30 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm shadow-emerald-500/5 placeholder:text-emerald-200"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">เกณฑ์ผ่าน (ชาย/หญิง)</label>
                                            <input 
                                                type="number" step="0.01" required
                                                value={formData.both_threshold}
                                                onChange={e => setFormData({...formData, both_threshold: e.target.value})}
                                                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm placeholder:text-slate-300"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    )}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">หน่วยข้อมูล</label>
                                            <input 
                                                value={formData.unit}
                                                onChange={e => setFormData({...formData, unit: e.target.value})}
                                                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all"
                                                placeholder="วินาที, ครั้ง..."
                                            />
                                        </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ตัวดำเนินการเปรียบเทียบ</label>
                                        <select 
                                            value={formData.comparison_type}
                                            onChange={e => setFormData({...formData, comparison_type: e.target.value})}
                                            className="w-full px-4 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer"
                                        >
                                            {COMPARISON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </form>
                            </div>

                            {/* Sticky Footer */}
                            <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex gap-4 shrink-0">
                                <button 
                                    type="button" 
                                    onClick={() => { setShowForm(false); setEditingIds({}); }}
                                    className="flex-1 py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 text-sm font-black hover:bg-slate-50 transition-all uppercase tracking-widest"
                                >ยกเลิก</button>
                                <button 
                                    type="submit" 
                                    form="criteria-form"
                                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-black shadow-xl shadow-emerald-200 hover:from-emerald-600 hover:to-teal-700 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest"
                                >บันทึกข้อมูล</button>
                            </div>
                        </div>


                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
                            {/* Filters Bar */}
                            <div className="p-6 bg-white/50 backdrop-blur-sm border-b border-slate-200 shrink-0">
                                <div className="flex flex-col xl:flex-row gap-4">
                                    <div className="relative flex-1 min-w-[200px] group">
                                        <svg className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input 
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="ค้นหาชื่อการทดสอบ..."
                                            className="w-full bg-white border-2 border-transparent rounded-[1.25rem] pl-14 pr-6 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm focus:border-emerald-200 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-[1.25rem] overflow-x-auto no-scrollbar">
                                        <button 
                                            onClick={() => setFilterGrade('ทั้งหมด')}
                                            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${filterGrade === 'ทั้งหมด' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >ระดับชั้น: ทั้งหมด</button>
                                        {GRADE_OPTIONS.map(o => (
                                            <button 
                                                key={o.value}
                                                onClick={() => setFilterGrade(o.value)}
                                                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${filterGrade === o.value ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >{o.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.25rem] overflow-x-auto no-scrollbar">
                                        {['ทั้งหมด', 'ชาย', 'หญิง'].map(g => (
                                            <button 
                                                key={g}
                                                onClick={() => setFilterGender(g)}
                                                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${filterGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >เพศ: {g}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Scrolling Table Area */}
                            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar pt-6">
                                {loading ? (
                                    <div className="h-full flex flex-col items-center justify-center p-20">
                                        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-6" />
                                        <p className="font-black text-slate-400 uppercase tracking-widest animate-pulse">กำลังโหลดข้อมูลระบบ...</p>
                                    </div>
                                ) : filteredCriteria.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 m-4">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                            <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 14h.01M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <h4 className="text-xl font-black text-slate-800 mb-2">ไม่พบเกณฑ์มาตรฐานที่ค้นหา</h4>
                                        <p className="text-slate-400 font-medium max-w-xs">ลองใช้คำค้นหาอื่น หรือเลือกหมวดหมู่อื่นจากแถบเมนูด้านบน</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {groupedList.map((group) => (
                                            <div key={group.groupKey} className="group bg-white hover:bg-white p-6 rounded-[2.25rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:border-emerald-300 transition-all duration-500 flex flex-col md:flex-row items-center gap-6">
                                                {/* Left Info */}
                                                <div className="flex items-center gap-6 flex-1 min-w-0 w-full">
                                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-emerald-50 flex flex-col items-center justify-center shrink-0 border border-slate-100 transition-colors">
                                                        <span className="text-[10px] font-black text-slate-300 uppercase leading-none mb-0.5">ชั้น</span>
                                                        <span className="text-xl font-black text-slate-800 group-hover:text-emerald-600">
                                                            {group.grade_level?.match(/\d+/)?.[0] || 'A'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <h3 className="text-xl font-black text-slate-800 line-clamp-1">{group.test_name}</h3>
                                                            <div className="flex gap-1.5">
                                                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">ปี {group.academic_year}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                            <span className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-lg">{group.grade_level}</span>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                                            <span className="flex items-center gap-2">เกณฑ์ {group.comparison_type}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Center/Thresholds Area */}
                                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/50 p-2 rounded-[1.75rem] border border-slate-100 group-hover:bg-white transition-colors w-full md:w-auto">
                                                    {group.both ? (
                                                        <div className="px-8 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-center min-w-[200px]">
                                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">ชาย และ หญิง</div>
                                                            <div className="flex items-baseline justify-center gap-2">
                                                                <span className="text-3xl font-black text-slate-800 tracking-tighter">{group.both.passing_threshold}</span>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.unit}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-3 w-full sm:w-auto">
                                                            <div className="flex-1 sm:flex-none px-6 py-3 bg-white rounded-2xl shadow-sm border-l-4 border-teal-400 border-t border-b border-r border-slate-100 text-center min-w-[120px]">
                                                                <div className="text-[9px] font-black text-teal-500/60 uppercase tracking-widest mb-0.5">ชาย</div>
                                                                <div className="flex items-baseline justify-center gap-1.5">
                                                                    <span className="text-2xl font-black text-teal-600 tracking-tighter">{group.male?.passing_threshold || '-'}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{group.unit}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 sm:flex-none px-6 py-3 bg-white rounded-2xl shadow-sm border-l-4 border-emerald-400 border-t border-b border-r border-slate-100 text-center min-w-[120px]">
                                                                <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-0.5">หญิง</div>
                                                                <div className="flex items-baseline justify-center gap-1.5">
                                                                    <span className="text-2xl font-black text-emerald-600 tracking-tighter">{group.female?.passing_threshold || '-'}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{group.unit}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right Actions */}
                                                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 pl-0 md:pl-6">
                                                    <button 
                                                        onClick={() => handleEditGroup(group)}
                                                        className="flex-1 md:flex-none h-11 px-4 flex items-center justify-center gap-2 rounded-xl text-slate-400 bg-white border border-slate-200 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all font-black text-[10px] uppercase tracking-widest"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        <span>แก้ไข</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteGroup(group)}
                                                        className="flex-1 md:flex-none h-11 px-4 flex items-center justify-center gap-2 rounded-xl text-slate-400 bg-white border border-slate-200 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h.01" /></svg>
                                                        <span>ลบ</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <style jsx>{`
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                `}</style>
            </div>
        </Portal>
    );
};
