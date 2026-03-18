"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import { getCurrentAcademicYearBE, getAcademicYearOptions } from "@/features/student/academic-term";

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
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchYears = async () => {
            try {
                const yearsData = await TeacherApiService.getAcademicYears();
                // Merge DB years with default generated years (recent 5 years)
                const dbYearNums = (yearsData || []).map((y: any) => parseInt(y.year_name));
                const defaultYears = getAcademicYearOptions(getCurrentAcademicYearBE(), 5);

                // Combine and remove duplicates, sort desc
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

                // If there's an active year, set it as default
                const active = merged.find((y: any) => y.is_active);
                if (active) setYear(parseInt(active.year_name));
            } catch (e) {
                console.error("Failed to fetch years", e);
                // Fallback to just generated options
                const fallback = getAcademicYearOptions(getCurrentAcademicYearBE(), 5).map(y => ({
                    id: `err-${y}`,
                    year_name: y.toString(),
                    is_active: false
                }));
                setAcademicYears(fallback);
            }
        };
        fetchYears();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            const data = await TeacherApiService.getFitnessStudents(session.id, classLevel, room);
            setStudents(data || []);
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
            <section className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Fitness Test</div>
                    <h1 className="text-3xl font-bold">บันทึกสุขภาพและสมรรถภาพ</h1>
                    <p className="text-orange-100 mt-2">บันทึกผลทดสอบสมรรถภาพทางกายนักเรียน</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ชั้น</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[140px]" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                        <option value="ทั้งหมด">ทั้งหมด</option>
                        {["มัธยมศึกษาปีที่ 1", "มัธยมศึกษาปีที่ 2", "มัธยมศึกษาปีที่ 3", "มัธยมศึกษาปีที่ 4", "มัธยมศึกษาปีที่ 5", "มัธยมศึกษาปีที่ 6"].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ห้อง</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[100px]" value={room} onChange={(e) => setRoom(e.target.value)}>
                        <option value="ทั้งหมด">ทั้งหมด</option>
                        {["1", "2", "3", "4", "5"].map((r) => <option key={r} value={r}>{r}</option>)}
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
                            onChange={(e) => setTestName(e.target.value)}
                        >
                            {testOptions.map((t) => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                )}
                <button onClick={loadStudents} className="px-5 py-2 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors shadow-sm active:scale-95">ค้นหา</button>
            </div>

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
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100 bg-orange-50/30">ผลสมรรถภาพ</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-x border-slate-100 bg-orange-50/30">เกณฑ์/สถานะ</th>
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
                                        else if (bmiVal < 25) interpretation = "ท้วม";
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
                                                <div className="text-xs text-indigo-600 font-bold uppercase mt-1">{s.class_name}</div>
                                            )}
                                        </td>

                                        {recordType === "weight_height" ? (
                                            <>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm"
                                                        placeholder="0.0"
                                                        value={res.weight || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, weight: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm"
                                                        placeholder="0"
                                                        value={res.height || ""}
                                                        onChange={(e) => setResults({ ...results, [s.id]: { ...res, height: e.target.value } })}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-bold text-slate-700">{bmi}</span>
                                                        {interpretation && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${interpretation === "ปกติ" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
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
                                                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm"
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
                                                    <input
                                                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                                        placeholder="เกณฑ์"
                                                        value={res.standard || ""}
                                                        onChange={(e) => {
                                                            const newStandard = e.target.value;
                                                            const newStatus = calculateStatus(res.result || "", newStandard, testName);
                                                            setResults({ ...results, [s.id]: { ...res, standard: newStandard, status: newStatus } });
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold ${!res.status ? "bg-slate-100 text-slate-400" :
                                                        (res.status === "ไม่ผ่าน") ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
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
                                                <td className="px-4 py-3 text-center border-x border-slate-50 bg-orange-50/20">
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
                                                <td className="px-4 py-3 text-center border-x border-slate-50 bg-orange-50/20">
                                                    <div className="flex flex-col gap-1">
                                                        <input
                                                            className="w-20 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-[10px] outline-none"
                                                            placeholder="เกณฑ์"
                                                            value={res.standard || ""}
                                                            onChange={(e) => {
                                                                const newStandard = e.target.value;
                                                                const newStatus = calculateStatus(res.result || "", newStandard, testName);
                                                                setResults({ ...results, [s.id]: { ...res, standard: newStandard, status: newStatus } });
                                                            }}
                                                        />
                                                        <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${!res.status ? "bg-slate-100 text-slate-400" :
                                                            (res.status === "ไม่ผ่าน") ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
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
                        <button onClick={handleSaveAll} disabled={saving} className="px-8 py-2.5 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50">
                            {saving ? "กำลังบันทีึก..." : "บันทึกทั้งหมด"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
