'use client';

import { useState, useEffect } from 'react';
import { StudentApiService } from '@/services/student-api.service';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/Skeleton';
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from '@/features/student/academic-term';

interface UserSession {
    id: number;
    code: string;
    role: string;
    name: string;
    [key: string]: any;
}

export function RegistrationFeature({ session }: { session: UserSession }) {
    const queryClient = useQueryClient();
    const academicYearsQuery = useQuery({
        queryKey: ["student", "lookups", "academic-years"],
        queryFn: () => StudentApiService.getAcademicYears(),
    });

    const yearOptionsData = (academicYearsQuery.data as any[]) || [];
    const yearOptions = yearOptionsData.map((y: any) => Number(y.year_name));

    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());

    const selectedYearData = yearOptionsData.find((y: any) => Number(y.year_name) === Number(year));
    const semesterOptions = selectedYearData?.semesters || [];


    // Sync year state if data is loaded
    useEffect(() => {
        if (!year && yearOptions.length > 0) {
            setYear(yearOptions[0]);
        }
    }, [year, yearOptions]);

    const [hasManualTermSelection, setHasManualTermSelection] = useState(false);
    const [didAutoFallback, setDidAutoFallback] = useState(false);

    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Helper to group items
    const groupItemsBySubject = (items: any[]) => {
        if (!Array.isArray(items)) return [];
        const grouped: Record<string, any> = {};
        items.forEach(item => {
            const key = item.subject_code || `item-${item.enrollment_id ?? item.id ?? Math.random()}`;
            const rowId = item.enrollment_id ?? item.id;
            const scheduleTimes = Array.isArray(item.schedules)
                ? item.schedules
                    .map((sch: any) => `${sch?.day_of_week || sch?.day || ''} ${sch?.time_range || sch?.period || ''}`.trim())
                    .filter((v: string) => v.length > 0)
                : [];
            const singleTime = `${item.day_of_week || ''} ${item.time_range || ''}`.trim();
            if (!grouped[key]) {
                grouped[key] = {
                    ...item,
                    ids: rowId != null ? [rowId] : [],
                    times: []
                };
            } else {
                if (rowId != null) grouped[key].ids.push(rowId);
            }
            if (scheduleTimes.length > 0) grouped[key].times.push(...scheduleTimes);
            else if (singleTime) grouped[key].times.push(singleTime);
        });
        return Object.values(grouped).map((g: any) => ({
            ...g,
            ids: Array.from(new Set((g.ids || []).filter((id: any) => id != null))),
            times: Array.from(new Set((g.times || []).filter((t: string) => String(t || '').trim().length > 0))),
        }));
    };

    // Queries
    const advisorLatestQuery = useQuery({
        queryKey: ["student", "advisor", "latest"],
        queryFn: () => StudentApiService.getAdvisor(),
    });

    const advisorQuery = useQuery({
        queryKey: ["student", "advisor", year, semester],
        queryFn: () => StudentApiService.getAdvisor(year, semester),
    });

    const cartQuery = useQuery({
        queryKey: ["student", "cart", year, semester],
        queryFn: () => StudentApiService.getCart(year, semester),
        select: groupItemsBySubject,
    });

    const registeredQuery = useQuery({
        queryKey: ["student", "registered", year, semester],
        queryFn: () => StudentApiService.getRegistered(year, semester),
        select: groupItemsBySubject,
    });

    const advisors = advisorQuery.data?.advisors || [];
    const latestAdvisors = advisorLatestQuery.data?.advisors || [];
    const cartItems = cartQuery.data || [];
    const registeredItems = registeredQuery.data || [];
    const isInitLoading = advisorQuery.isLoading || cartQuery.isLoading || registeredQuery.isLoading || academicYearsQuery.isLoading;
    const getSubjectKey = (item: any) =>
        item?.subject_id != null && String(item.subject_id) !== ''
            ? `subject:${item.subject_id}`
            : `code:${String(item?.subject_code || '').trim()}`;
    const getSectionId = (item: any) => {
        const raw = item?.section_id ?? item?.id;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : null;
    };
    const cartSubjectKeys = new Set((cartItems || []).map((item: any) => getSubjectKey(item)));
    const registeredSubjectKeys = new Set((registeredItems || []).map((item: any) => getSubjectKey(item)));
    const cartSectionIds = new Set((cartItems || []).map((item: any) => getSectionId(item)).filter((v: number | null) => v != null));
    const registeredSectionIds = new Set((registeredItems || []).map((item: any) => getSectionId(item)).filter((v: number | null) => v != null));

    // Mutations
    const addToCartMutation = useMutation({
        mutationFn: (section_id: number) => StudentApiService.addToCart(section_id, year, semester),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student", "cart", year, semester] });
            toast.success('เพิ่มลงตะกร้าสำเร็จ');
        },
        onError: (error: any) => {
            toast.error(error.message || 'เกิดข้อผิดพลาด หรือคุณอาจมีวิชานี้ในตะกร้าแล้ว');
        }
    });

    const removeCartItemMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            await Promise.all(ids.map((id) => StudentApiService.removeCartItem(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student", "cart", year, semester] });
            queryClient.invalidateQueries({ queryKey: ["student", "registered", year, semester] });
        },
        onError: () => toast.error('เกิดข้อผิดพลาดในการลบ')
    });

    const confirmCartMutation = useMutation({
        mutationFn: () => StudentApiService.confirmCart(year, semester),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student", "cart", year, semester] });
            queryClient.invalidateQueries({ queryKey: ["student", "registered", year, semester] });
            toast.success('บันทึกสำเร็จ');
        },
        onError: () => toast.error('เกิดข้อผิดพลาดในการบันทึก')
    });

    const isActionLoading = addToCartMutation.isPending || removeCartItemMutation.isPending || confirmCartMutation.isPending;

    useEffect(() => {
        if (hasManualTermSelection || didAutoFallback) return;
        if (advisorQuery.isLoading) return;
        if (advisors.length > 0) return;
        const latest = latestAdvisors[0];
        if (!latest?.year || !latest?.semester) return;
        if (latest.year === year && latest.semester === semester) return;

        setDidAutoFallback(true);
        setYear(latest.year);
        setSemester(latest.semester);
    }, [
        advisorQuery.isLoading,
        advisors.length,
        didAutoFallback,
        hasManualTermSelection,
        latestAdvisors,
        semester,
        year
    ]);

    const handleSearch = async () => {
        if (!searchKeyword.trim()) return;
        setIsSearching(true);
        try {
            const class_level = session.class_level ? String(session.class_level) : '';
            const room = session.room ? String(session.room) : '';
            const results = await StudentApiService.searchSubjects(searchKeyword, year, semester, class_level, room);
            setSearchResults(results);
            setIsModalOpen(true);
        } catch (error) {
            console.error('Search error:', error);
            toast.error('เกิดข้อผิดพลาดในการค้นหา');
        } finally {
            setIsSearching(false);
        }
    };

    const handleBrowse = async () => {
        setIsSearching(true);
        try {
            // Assume session has class_level and room or default to 1 for demo
            const class_level = session.class_level ? String(session.class_level) : '1';
            const room = session.room ? String(session.room) : '';
            const results = await StudentApiService.browseSubjects(year, semester, class_level, room);
            setSearchResults(results);
            setIsModalOpen(true);
        } catch (error) {
            console.error('Browse error:', error);
            toast.error('เกิดข้อผิดพลาดในการดึงข้อมูลวิชา');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSubject = (section_id: number) => {
        addToCartMutation.mutate(section_id);
    };

    const handleRemoveCartItem = (ids: number[]) => {
        if (!confirm('ต้องการลบวิชานี้ออกจากตะกร้าหรือไม่?')) return;
        removeCartItemMutation.mutate(ids);
    };

    const handleRemoveRegisteredItem = (ids: number[]) => {
        if (!confirm('ต้องการลบวิชานี้ออกจากรายการที่ลงทะเบียนแล้วหรือไม่? (สำหรับการทดสอบ)')) return;
        removeCartItemMutation.mutate(ids);
    };

    const handleConfirmCart = () => {
        if (cartItems.length === 0) {
            toast.error('ตะกร้าว่างเปล่า');
            return;
        }
        if (!confirm('ยืนยันบันทึกรายวิชาที่เลือกทั้งหมดหรือไม่?')) return;
        confirmCartMutation.mutate();
    };

    if (isInitLoading) {
        return (
            <div className="space-y-6">
                <Skeleton variant="rounded" className="h-10 w-64" />
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="space-y-2">
                        <Skeleton variant="rounded" className="h-4 w-32" />
                        <Skeleton variant="rounded" className="h-4 w-64" />
                    </div>
                    <div className="flex space-x-4">
                        <Skeleton variant="rounded" className="h-20 w-40" />
                        <Skeleton variant="rounded" className="h-20 w-40" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <Skeleton variant="rounded" className="h-8 w-64 mb-4" />
                    <div className="flex space-x-4">
                        <Skeleton variant="rounded" className="h-10 w-32" />
                        <Skeleton variant="rounded" className="h-10 w-32" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                    <div className="text-emerald-600 font-semibold text-xs mb-1">Registration</div>
                    <div className="text-slate-600 text-sm">ค้นหาและจัดการตะกร้ารายวิชาในที่เดียว</div>
                </div>
                <div className="flex space-x-4">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm min-w-[150px]">
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">ครูที่ปรึกษา</div>
                        <div className="text-base font-bold text-slate-800 mt-1">
                            {advisors.length > 0
                                ? advisors.map(a => <div key={a.id} className="whitespace-nowrap">{a.teacher_code} {a.first_name}</div>)
                                : '-'
                            }
                        </div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm min-w-[120px]">
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">วิชาในตะกร้า</div>
                        <div className="text-xl font-bold text-slate-800 mt-1 tracking-tight">{cartItems.length}</div>
                    </div>
                </div>
            </div>

            {/* Selection Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <span className="bg-slate-100 p-2 rounded-lg mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </span>
                    เลือกปีการศึกษาและภาคเรียน
                </h3>
                <div className="flex space-x-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ปีการศึกษา</label>
                        <select
                            value={year}
                            onChange={(e) => {
                                setHasManualTermSelection(true);
                                setYear(Number(e.target.value));
                            }}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5"
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ภาคเรียน</label>
                        <select
                            value={semester}
                            onChange={(e) => {
                                setHasManualTermSelection(true);
                                setSemester(Number(e.target.value));
                            }}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5"
                        >
                            {semesterOptions.length > 0 ? (
                                semesterOptions.map((s: any) => (
                                    <option key={s.semester_number} value={s.semester_number}>
                                        {s.semester_number}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            {/* Search Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <span className="bg-slate-100 p-2 rounded-lg mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </span>
                    ค้นหารายวิชาที่เปิดสอน
                </h3>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="ค้นหารหัส หรือชื่อวิชา..."
                        className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5 flex-1"
                        disabled={isSearching}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="text-white bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
                    </button>
                    <button
                        onClick={handleBrowse}
                        disabled={isSearching}
                        className="text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-300 font-medium rounded-lg text-sm px-5 py-2.5 border border-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ดูวิชาทั้งหมด
                    </button>
                </div>

                {isSearching && (
                    <div className="mt-4 text-center text-slate-500 flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        กำลังโหลด...
                    </div>
                )}
            </div>

            {/* Modal for Search / Browse Results */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">รายวิชาที่เปิดสอน</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    พบ {searchResults.length} รายวิชาที่เปิดให้ลงทะเบียน
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {searchResults.length > 0 ? (
                                <div className="space-y-4">
                                    {searchResults.map((subj, idx) => {
                                        const sectionId = Number(subj?.schedules?.[0]?.section_id || subj?.section_id || subj?.id || 0);
                                        const subjectKey = getSubjectKey(subj);
                                        const isRegistered =
                                            registeredSubjectKeys.has(subjectKey)
                                            || (Number.isFinite(sectionId) && sectionId > 0 && registeredSectionIds.has(sectionId));
                                        const isInCart =
                                            !isRegistered
                                            && (
                                                cartSubjectKeys.has(subjectKey)
                                                || (Number.isFinite(sectionId) && sectionId > 0 && cartSectionIds.has(sectionId))
                                            );

                                        return (
                                            <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
                                                <div className="mb-4 sm:mb-0">
                                                    <div className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm font-mono">{subj.subject_code}</span>
                                                        {subj.subject_name || subj.name}
                                                    </div>
                                                    <div className="text-sm text-slate-600 mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                            หน่วยกิต: <span className="font-medium text-slate-800">{subj.credit}</span>
                                                        </span>
                                                        {subj.teacher_name && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-emerald-500">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147L12 14.63l7.74-4.483m-15.48 0L12 5.63l7.74 4.517m-15.48 0L12 14.63m-7.74-4.483L12 5.63m7.74 4.517L12 14.63m7.74-4.483L12 14.63m0 0v7.5" />
                                                                </svg>
                                                                {subj.teacher_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {subj.schedules && subj.schedules.length > 0 ? (
                                                            subj.schedules.map((sch: any, sIdx: number) => (
                                                                <span key={sIdx} className="inline-flex items-center bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm leading-none min-h-[32px]">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-18 0h18" />
                                                                    </svg>
                                                                    <span className="mr-2">{sch.day_of_week}</span>
                                                                    <span className="w-px h-3 bg-emerald-200 mr-2"></span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    <span>{sch.time_range}</span>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">ยังไม่กำหนดเวลา</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="w-full sm:w-auto mt-2 sm:mt-0">
                                                    {isRegistered ? (
                                                        <div className="w-full sm:w-auto text-center text-sm font-medium text-emerald-700 bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-200 cursor-not-allowed">
                                                            ลงทะเบียนแล้ว
                                                        </div>
                                                    ) : isInCart ? (
                                                        <div className="w-full sm:w-auto text-center text-sm font-medium text-amber-700 bg-amber-50 px-6 py-3 rounded-xl border border-amber-200 cursor-not-allowed">
                                                            อยู่ในตะกร้าแล้ว
                                                        </div>
                                                    ) : ((subj.schedules && subj.schedules.length > 0) ? (
                                                        <button
                                                            onClick={() => handleSelectSubject(subj.schedules[0].section_id || subj.section_id)}
                                                            disabled={isActionLoading}
                                                            className="w-full sm:w-auto text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-300 font-medium rounded-xl text-sm px-6 py-3 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isActionLoading ? 'กำลังจัดเก็บ...' : '+ เลือกลงตะกร้า'}
                                                        </button>
                                                    ) : (
                                                        <div className="w-full sm:w-auto text-center text-sm text-slate-500 bg-slate-100 px-6 py-3 rounded-xl border border-dashed border-slate-300 cursor-not-allowed">
                                                            ลงทะเบียนไม่ได้
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="text-6xl mb-4 flex justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-slate-300">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800">ไม่พบรายวิชา</h3>
                                    <p className="text-slate-500 mt-2">อาจจะไม่มีวิชาเปิดสอนในช่วงเวลานี้ หรือลองเปลี่ยนคำค้นหาใหม่</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* Cart Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                        <span className="bg-slate-100 p-2 rounded-lg mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                            </svg>
                        </span>
                        รายวิชาที่เลือกไว้ (ตะกร้า)
                    </h3>
                    <button
                        onClick={handleConfirmCart}
                        disabled={isActionLoading || cartItems.length === 0}
                        className="text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isActionLoading ? 'กำลังบันทึก...' : (
                            <span className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                บันทึกรายวิชาที่เลือก
                            </span>
                        )}
                    </button>
                </div>

                <div className="relative overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">รหัสวิชา</th>
                                <th className="px-6 py-3">ชื่อรายวิชา</th>
                                <th className="px-6 py-3 text-center">หน่วยกิต</th>
                                <th className="px-6 py-3">วัน/เวลา</th>
                                <th className="px-6 py-3 text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cartItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                                        ยังไม่มีรายวิชาในตะกร้า
                                    </td>
                                </tr>
                            ) : cartItems.map((item, idx) => (
                                <tr key={idx} className="bg-white border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.subject_code}</td>
                                    <td className="px-6 py-4">{item.subject_name}</td>
                                    <td className="px-6 py-4 text-center">{item.credit}</td>
                                    <td className="px-6 py-4">
                                        {item.times.map((t: string, i: number) => <div key={i}>{t}</div>)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleRemoveCartItem(item.ids)}
                                            disabled={isActionLoading}
                                            className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Registered Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <span className="bg-slate-100 p-2 rounded-lg mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                    รายวิชาที่บันทึกแล้ว
                </h3>

                <div className="relative overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">รหัสวิชา</th>
                                <th className="px-6 py-3">ชื่อรายวิชา</th>
                                <th className="px-6 py-3 text-center">หน่วยกิต</th>
                                <th className="px-6 py-3">วัน/เวลา</th>
                                <th className="px-6 py-3 text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registeredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                                        ยังไม่มีรายวิชาที่บันทึกแล้ว
                                    </td>
                                </tr>
                            ) : registeredItems.map((item, idx) => (
                                <tr key={idx} className="bg-white border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.subject_code}</td>
                                    <td className="px-6 py-4">{item.subject_name}</td>
                                    <td className="px-6 py-4 text-center">{item.credit}</td>
                                    <td className="px-6 py-4">
                                        {item.times.map((t: string, i: number) => <div key={i}>{t}</div>)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleRemoveRegisteredItem(item.ids)}
                                            disabled={isActionLoading}
                                            className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="ทดสอบลบ"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
