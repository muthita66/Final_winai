"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import { getCurrentAcademicYearBE, getAcademicYearOptions } from "@/features/student/academic-term";
import { FitnessCriteriaManagement } from "./FitnessCriteriaManagement";

const TEST_TYPES = [
    { id: 'run_50', name: 'วิ่ง 50 เมตร', unit: 'วินาที', direction: 'lower' },
    { id: 'run_1000', name: 'วิ่ง 1000 เมตร', unit: 'นาที:วินาที', direction: 'lower' },
    { id: 'sit_up_60', name: 'ลุก-นั่ง 60 วินาที', unit: 'ครั้ง', direction: 'higher' },
    { id: 'push_up', name: 'ดันพื้น', unit: 'ครั้ง', direction: 'higher' },
    { id: 'sit_reach_flex', name: 'นั่งงอตัว', unit: 'เซนติเมตร', direction: 'higher' },
    { id: 'standing_jump', name: 'ยืนกระโดดไกล', unit: 'เซนติเมตร', direction: 'higher' },
];

export function FitnessFeature({ session }: { session: any }) {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [classLevel, setClassLevel] = useState("มัธยมศึกษาปีที่ 1");
    const [room, setRoom] = useState("1");
    const [recordType, setRecordType] = useState<"weight_height" | "fitness" | "all">("weight_height");
    const [testName, setTestName] = useState("วิ่ง 50 เมตร");
    const [year, setYear] = useState(getCurrentAcademicYearBE());
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [semester, setSemester] = useState<string | number>(1);
    const [results, setResults] = useState<Record<number, any>>({});
    const [advisorClasses, setAdvisorClasses] = useState<any[]>([]);
    const [isAdvisor, setIsAdvisor] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const [yearsData, classes] = await Promise.all([
                    TeacherApiService.getAcademicYears(),
                    TeacherApiService.getAdvisorClasses(session.id)
                ]);

                setAdvisorClasses(classes || []);
                setIsAdvisor((classes || []).length > 0);
                if ((classes || []).length > 0) {
                    setClassLevel(classes[0].class_level);
                    setRoom(classes[0].room);
                }

                const dbYearNums = (yearsData || []).map((y: any) => parseInt(y.year_name));
                const defaultYears = getAcademicYearOptions(getCurrentAcademicYearBE(), 5);
                const combined = Array.from(new Set([...dbYearNums, ...defaultYears])).sort((a, b) => b - a);
                const merged = combined.map(yNum => {
                    const dbMatch = yearsData?.find((dy: any) => parseInt(dy.year_name) === yNum);
                    return {
                        id: dbMatch?.id || `fallback-${yNum}`,
                        year_name: yNum.toString(),
                        is_active: dbMatch?.is_active || false
                    };
                });
                setAcademicYears(merged);
                const active = merged.find((y: any) => y.is_active);
                if (active) setYear(parseInt(active.year_name));
            } catch (e) {
                console.error("Failed to fetch initial data", e);
                setIsAdvisor(false);
            }
        };
        fetchData();
    }, [session.id]);


    useEffect(() => {
        const fetchCriteria = async () => {
            if (!testName || !classLevel) return;
            try {
                // Fetch all criteria for this test and grade level
                const criteriaList = await TeacherApiService.getFitnessCriteria(testName, classLevel, year);
                
                if (Array.isArray(criteriaList) && criteriaList.length > 0) {
                    setResults(prev => {
                        const next = { ...prev };
                        students.forEach(s => {
                            if (!next[s.id]) next[s.id] = {};
                            
                            // Find matching criteria by gender and grade level
                            const genderMatch = criteriaList.find(c => {
                                const cGender = (c.gender || '').toLowerCase();
                                const sGender = (s.gender || '').toLowerCase();
                                const cGrade = (c.grade_level || '').toLowerCase();
                                const sGrade = (s.grade_level || classLevel || '').toLowerCase();
                                
                                const matchesGender = cGender === 'ทั้งหมด' || cGender.includes(sGender) || sGender.includes(cGender);
                                const matchesGrade = cGrade.includes(sGrade) || sGrade.includes(cGrade);
                                
                                return matchesGender && matchesGrade;
                            }) || criteriaList.find(c => {
                                // Fallback matching if precise fails
                                const cGender = (c.gender || '').toLowerCase();
                                const sGender = (s.gender || '').toLowerCase();
                                return cGender === 'ทั้งหมด' || cGender.includes(sGender) || sGender.includes(cGender);
                            }) || criteriaList[0];

                            if (genderMatch && genderMatch.passing_threshold) {
                                next[s.id].standard = parseFloat(genderMatch.passing_threshold).toString();
                                next[s.id].criteriaSource = `${genderMatch.gender} / ${genderMatch.grade_level}`;
                                // Recalculate status if result exists
                                if (next[s.id].result) {
                                    next[s.id].status = calculateStatus(next[s.id].result, next[s.id].standard, testName);
                                }
                            }
                        });
                        return next;
                    });
                }
            } catch (e) {
                console.error("Failed to fetch criteria", e);
            }
        };
        fetchCriteria();
    }, [testName, classLevel, year, students]);


    const loadStudents = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            const data = await TeacherApiService.getFitnessStudents(session.id, classLevel, room, year, semester);
            setStudents(data || []);

            // Initialize results from existing data
            const initialResults: Record<number, any> = {};
            (data || []).forEach((s: any) => {
                const res: any = {};
                (s.fitness_tests || []).forEach((t: any) => {
                    if (t.test_name === "น้ำหนัก (Weight)") {
                        res.weight = String(t.test_result);
                    } else if (t.test_name === "ส่วนสูง (Height)") {
                        res.height = String(t.test_result);
                    } else if (recordType === "fitness" && t.test_name === testName) {
                        res.result = String(t.test_result);
                        res.standard = t.standard_value || ""; // Standard value might not be in fitness_tests, will be updated by fetchCriteria
                        res.status = t.status || "";
                    } else if (recordType === "all") {
                        // In "all" mode, if we are looking at a specific testName, or just want to show weight/height
                        if (t.test_name === testName) {
                            res.result = String(t.test_result);
                            res.status = t.status || "";
                        }
                    }
                });
                if (Object.keys(res).length > 0) {
                    initialResults[s.id] = res;
                }
            });
            setResults(initialResults);
        } catch (e: any) {
            alert(e?.message || "โหลดข้อมูลนักเรียนไม่สำเร็จ");
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setHasSearched(false);
        setStudents([]);
        setResults({});
    };

    const handleSaveAll = async () => {
        if (!Number.isFinite(year) || year <= 0) {
            alert("ปีการศึกษาไม่ถูกต้อง");
            return;
        }
        if (semester !== "all" && !([1, 2] as any[]).includes(semester)) {
            alert("ภาคเรียนไม่ถูกต้อง");
            return;
        }

        const payloads: any[] = [];

        students.forEach(s => {
            const res = results[s.id];
            if (!res) return;

            // Save weight/height if present in weight_height OR all mode
            if (recordType === "weight_height" || recordType === "all") {
                if (res.weight) {
                    payloads.push({
                        student_id: s.id,
                        teacher_id: session.id,
                        test_name: "น้ำหนัก (Weight)",
                        result_value: res.weight,
                        standard_value: "-",
                        status: "บันทึกข้อมูล",
                        year,
                        semester: typeof semester === "number" ? semester : 1,
                    });
                }
                if (res.height) {
                    payloads.push({
                        student_id: s.id,
                        teacher_id: session.id,
                        test_name: "ส่วนสูง (Height)",
                        result_value: res.height,
                        standard_value: "-",
                        status: "บันทึกข้อมูล",
                        year,
                        semester: typeof semester === "number" ? semester : 1,
                    });
                }
            }

            // Save fitness if present in fitness OR all mode
            if (recordType === "fitness" || recordType === "all") {
                if ((res.result || "").trim()) {
                    payloads.push({
                        student_id: s.id,
                        teacher_id: session.id,
                        test_name: testName,
                        result_value: res.result.trim(),
                        standard_value: (res.standard || "-").trim(),
                        status: (res.status || "ผ่าน").trim(),
                        year,
                        semester: typeof semester === "number" ? semester : 1,
                    });
                }
            }
        });

        if (payloads.length === 0) {
            alert("กรุณากรอกข้อมูลอย่างน้อย 1 รายการก่อนบันทึก");
            return;
        }

        setSaving(true);
        try {
            await Promise.all(payloads.map((p) => TeacherApiService.saveFitnessTest(p)));
            alert(`บันทึกเรียบร้อย ${payloads.length} รายการ`);
        } catch (e: any) {
            alert(e?.message || "บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const testOptions = ["วิ่ง 50 เมตร", "วิ่ง 1000 เมตร", "ลุก-นั่ง 60 วินาที", "ดันพื้น", "นั่งงอตัว", "ยืนกระโดดไกล"];

    const calculateStatus = (result: string, standard: string, test: string) => {
        const r = parseFloat(result);
        const s = parseFloat(standard);
        if (isNaN(r) || isNaN(s)) return "";

        // Higher or equal is better (Result >= Standard)
        return r >= s ? "ผ่าน" : "ไม่ผ่าน";
    };

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Fitness Test</div>
                    <h1 className="text-3xl font-bold">บันทึกสุขภาพและสมรรถภาพ</h1>
                    <p className="text-emerald-100 mt-2">บันทึกผลทดสอบสมรรถภาพทางกายนักเรียน</p>
                </div>
            </section>

            <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end transition-opacity ${!isAdvisor ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ชั้น</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[140px]" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                        {advisorClasses.map(c => c.class_level).filter((v, i, a) => a.indexOf(v) === i).map(l => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ห้อง</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[100px]" value={room} onChange={(e) => setRoom(e.target.value)}>
                        {advisorClasses.filter(c => c.class_level === classLevel).map(c => c.room).map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ปีการศึกษา</label>
                    <select
                        className="px-4 py-2 border border-slate-200 rounded-xl outline-none w-32"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                    >
                        {academicYears.length > 0 ? (
                            academicYears.map((y: any) => (
                                <option key={y.id} value={parseInt(y.year_name)}>{y.year_name}</option>
                            ))
                        ) : (
                            <option value={year}>{year}</option>
                        )}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ภาค</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none" value={semester} onChange={(e) => setSemester(e.target.value === "all" ? "all" : Number(e.target.value))}>
                        <option value="all">ทั้งหมด</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ชื่อรายการ</label>
                    <select
                        className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[180px]"
                        value={recordType}
                        onChange={(e) => {
                            setRecordType(e.target.value as any);
                            setResults({}); // Reset results when switching type
                            setHasSearched(false);
                        }}
                    >
                        <option value="all">ทั้งหมด</option>
                        <option value="weight_height">บันทึกน้ำหนักส่วนสูง</option>
                        <option value="fitness">บันทึกสมรรถภาพ</option>
                    </select>
                </div>
                {recordType === "fitness" && (
                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <label className="text-xs text-slate-500 font-medium block mb-1">รายการทดสอบ</label>
                        <select
                            className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[160px]"
                            value={testName}
                            onChange={(e) => {
                                setTestName(e.target.value);
                                setResults({});
                            }}
                        >
                            {TEST_TYPES.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>

                    </div>
                )}
                <button 
                    disabled={!isAdvisor}
                    onClick={loadStudents} 
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ค้นหา
                </button>

                <button
                    onClick={() => setIsCriteriaModalOpen(true)}
                    disabled={!isAdvisor}
                    className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    จัดการเกณฑ์
                </button>
            </div>

            {isAdvisor === false && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-800 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="font-bold text-lg">เฉพาะครูที่ปรึกษา</h3>
                        <p className="text-emerald-700">คุณไม่สามารถบันทึกข้อมูลสมรรถภาพได้ เนื่องจากคุณไม่ได้เป็นครูที่ปรึกษาประจำชั้นใดๆ</p>
                    </div>
                </div>
            )}


            {loading && <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>}
            {!loading && hasSearched && students.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">ไม่พบนักเรียนในชั้น/ห้องที่เลือก</div>
            )}

            {!loading && students.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-16">เลขที่</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-32">รหัสนักเรียน</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 min-w-[200px]">ชื่อ-นามสกุล</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-20">เพศ</th>
                                {recordType === "weight_height" ? (
                                    <>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">น้ำหนัก (กก.)</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">ส่วนสูง (ซม.)</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">BMI</th>
                                    </>
                                ) : recordType === "fitness" ? (
                                    <>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">ผลทดสอบ</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">เกณฑ์มาตรฐาน</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">สถานะ</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100">น้ำหนัก</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100">ส่วนสูง</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100 bg-emerald-50/30">ผลสมรรถภาพ</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100 bg-emerald-50/30">เกณฑ์/สถานะ</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s, i) => {
                                const res = results[s.id] || {};

                                // BMI calculation for weight_height mode
                                let bmi: string | number = "-";
                                let interpretation = "";
                                if (recordType === "weight_height" && res.weight && res.height) {
                                    const hMeter = parseFloat(res.height) / 100;
                                    const wKg = parseFloat(res.weight);
                                    if (hMeter > 0 && wKg > 0) {
                                        const bmiVal = wKg / (hMeter * hMeter);
                                        bmi = bmiVal.toFixed(1);
                                        if (bmiVal < 18.5) interpretation = "ผอม";
                                        else if (bmiVal < 23) interpretation = "ปกติ";
                                        else interpretation = "อ้วน";
                                    }
                                }

                                return (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-500 text-center">{i + 1}</td>
                                        <td className="px-4 py-3 text-sm text-slate-500 text-center">
                                            {s.student_code}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-slate-800 font-semibold truncate max-w-[200px] xl:max-w-none" title={`${s.prefix}${s.first_name} ${s.last_name}`}>
                                                {s.prefix}{s.first_name} {s.last_name}
                                            </div>
                                            {(classLevel === "ทั้งหมด" || room === "ทั้งหมด") && s.class_name && (
                                                <div className="text-xs text-emerald-600 font-bold uppercase mt-1">{s.class_name}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                s.gender === 'ชาย' ? 'bg-teal-50 text-teal-600 border border-teal-100' : 
                                                s.gender === 'หญิง' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                                'bg-slate-50 text-slate-500 border border-slate-100'
                                            }`}>
                                                {s.gender || '-'}
                                            </span>
                                        </td>

                                        {recordType === "weight_height" ? (
                                            <>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                                                        placeholder="0.0"
                                                        value={res.weight || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, weight: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm"
                                                        placeholder="0"
                                                        value={res.height || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, height: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-bold text-slate-700">{bmi}</span>
                                                        {interpretation && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                                interpretation === "ปกติ" ? "bg-emerald-100 text-emerald-700" : 
                                                                interpretation === "ผอม" ? "bg-amber-100 text-amber-700" : 
                                                                "bg-rose-100 text-rose-700"
                                                            }`}>
                                                                {interpretation}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        ) : recordType === "fitness" ? (
                                            <>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm"
                                                        placeholder="ผล"
                                                        value={res.result || ""}
                                                        onChange={(e) => {
                                                            const newResult = e.target.value;
                                                            const newStatus = calculateStatus(newResult, res.standard || "", testName);
                                                            setResults({ ...results, [s.id]: { ...res, result: newResult, status: newStatus } });
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <input
                                                            className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                                                            placeholder="เกณฑ์"
                                                            value={res.standard || ""}
                                                            onChange={(e) => {
                                                                const newStandard = e.target.value;
                                                                const newStatus = calculateStatus(res.result || "", newStandard, testName);
                                                                setResults({ ...results, [s.id]: { ...res, standard: newStandard, status: newStatus } });
                                                            }}
                                                        />
                                                        {res.criteriaSource && (
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter opacity-80 leading-none">
                                                                {res.criteriaSource}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold ${!res.status ? "bg-slate-100 text-slate-400" :
                                                        (res.status === "ไม่ผ่าน") ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                                        }`}>
                                                        {res.status || "-"}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 text-center border-x border-slate-50">
                                                    <input
                                                        type="number"
                                                        className="w-16 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-sm outline-none"
                                                        placeholder="กก."
                                                        value={res.weight || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, weight: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center border-x border-slate-50">
                                                    <input
                                                        type="number"
                                                        className="w-16 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-sm outline-none"
                                                        placeholder="ซม."
                                                        value={res.height || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, height: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center border-x border-slate-50 bg-emerald-50/20">
                                                    <input
                                                        className="w-20 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-sm outline-none"
                                                        placeholder="ผล"
                                                        value={res.result || ""}
                                                        onChange={(e) => {
                                                            const newResult = e.target.value;
                                                            const newStatus = calculateStatus(newResult, res.standard || "", testName);
                                                            setResults({ ...results, [s.id]: { ...res, result: newResult, status: newStatus } });
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center border-x border-slate-50 bg-teal-50/20">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <input
                                                            className="w-20 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-[10px] outline-none group-hover:bg-white"
                                                            placeholder="เกณฑ์"
                                                            value={res.standard || ""}
                                                            onChange={(e) => {
                                                                const newStandard = e.target.value;
                                                                const newStatus = calculateStatus(res.result || "", newStandard, testName);
                                                                setResults({ ...results, [s.id]: { ...res, standard: newStandard, status: newStatus } });
                                                            }}
                                                        />
                                                        {res.criteriaSource && (
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter opacity-80 leading-none">
                                                                {res.criteriaSource}
                                                            </div>
                                                        )}
                                                        <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${!res.status ? "bg-slate-100 text-slate-400" :
                                                            (res.status === "ไม่ผ่าน") ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                                            }`}>
                                                            {res.status || "-"}
                                                        </span>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={handleCancel} className="px-8 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors">
                            ยกเลิก
                        </button>
                        <button onClick={handleSaveAll} disabled={saving} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            {saving ? "กำลังบันทีึก..." : "บันทึกทั้งหมด"}
                        </button>
                    </div>
                </div>
            )}
        <FitnessCriteriaManagement 
            isOpen={isCriteriaModalOpen} 
            onClose={() => setIsCriteriaModalOpen(false)} 
            currentYear={year} 
        />
    </div>
);
}
