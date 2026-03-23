"use client";
import { useEffect, useState } from "react";
import { DirectorApiService } from "@/services/director-api.service";

type EvalType = 'student_teaching' | 'student_advisor' | 'teacher_subject' | 'teacher_advisor';

const TYPE_LABELS: Record<EvalType, string> = {
    student_teaching: "นักเรียนประเมินครูรายวิชา",
    student_advisor: "นักเรียนประเมินครูที่ปรึกษา",
    teacher_subject: "ครูประเมินนักเรียนรายวิชา",
    teacher_advisor: "ครูประเมินนักเรียนในที่ปรึกษา",
};

const TYPE_COL_LABEL: Record<EvalType, string> = {
    student_teaching: "ครูผู้สอน / รายวิชา",
    student_advisor: "ครูที่ปรึกษา",
    teacher_subject: "นักเรียน / รายวิชา",
    teacher_advisor: "นักเรียน / ชั้น-ห้อง",
};

export function EvaluationFeature() {
    const [topics, setTopics] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [gradeLevels, setGradeLevels] = useState<string[]>([]);
    const [classrooms, setClassrooms] = useState<string[]>([]);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [semester, setSemester] = useState<number>(1);
    const [type, setType] = useState<EvalType>('student_teaching');
    // Filters
    const [subjectId, setSubjectId] = useState<number | ''>('');
    const [departmentId, setDepartmentId] = useState<number | ''>('');
    const [classLevel, setClassLevel] = useState<string>('');
    const [room, setRoom] = useState<string>('');

    // Fetch academic years on mount
    useEffect(() => {
        DirectorApiService.getAcademicYears().then(data => {
            setAcademicYears(data || []);
            const activeYear = data?.find((y: any) => y.is_active) || data?.[0];
            if (activeYear) {
                setYear(Number(activeYear.year_name));
                const activeSem = activeYear.semesters?.find((s: any) => s.is_active) || activeYear.semesters?.[0];
                if (activeSem) setSemester(Number(activeSem.semester_number));
            }
        }).catch(() => {});

        // Fetch filter options
        DirectorApiService.getSubjectsLookup().then(data => setSubjects(data || [])).catch(() => {});
        DirectorApiService.getLearningSubjectGroups().then(data => setDepartments(data || [])).catch(() => {});
        DirectorApiService.getGradeLevels().then(data => setGradeLevels(data || [])).catch(() => {});
        DirectorApiService.getClassrooms().then(data => setClassrooms(data || [])).catch(() => {});
    }, []);

    const load = () => {
        if (!year || !semester) return;
        setLoading(true);
        const filters = {
            subject_id: subjectId ? Number(subjectId) : undefined,
            department_id: departmentId ? Number(departmentId) : undefined,
            class_level: classLevel || undefined,
            room: room || undefined,
        };
        DirectorApiService.getEvaluationResults(year, semester, type, filters)
            .then(rows => { setTopics(rows || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        if (year && semester) load();
    }, [year, semester, type]);

    // Reset subject when department changes
    useEffect(() => {
        setSubjectId('');
    }, [departmentId]);

    // When type changes, reset filters
    const changeType = (newType: EvalType) => {
        setType(newType);
        setSubjectId('');
        setDepartmentId('');
        setClassLevel('');
        setRoom('');
    };

    const selectedYearData = academicYears.find(y => Number(y.year_name) === year);
    const availableSemesters = selectedYearData?.semesters || [];
    const isSubjectType = type === 'student_teaching' || type === 'teacher_subject';
    const isAdvisorType = type === 'student_advisor' || type === 'teacher_advisor';

    const filteredSubjects = departmentId 
        ? subjects.filter(s => s.department_id === departmentId)
        : subjects;

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Evaluation</div>
                    <h1 className="text-3xl font-bold">ผลการประเมิน</h1>
                    <p className="text-emerald-50 mt-2">สรุปผลประเมิน ปี {year} / ภาค {semester}</p>
                </div>
            </section>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Eval Type */}
                    <div className="flex-1 min-w-[260px]">
                        <label className="text-xs text-slate-500 block mb-1">ประเภทการประเมิน</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                            value={type}
                            onChange={(e) => changeType(e.target.value as EvalType)}
                        >
                            {(Object.keys(TYPE_LABELS) as EvalType[]).map(k => (
                                <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year */}
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">ปีการศึกษา</label>
                        <select
                            className="px-3 py-2 border border-slate-200 rounded-xl w-32 bg-slate-50 font-medium"
                            value={year}
                            onChange={(e) => {
                                const newYear = Number(e.target.value);
                                setYear(newYear);
                                const yData = academicYears.find(y => Number(y.year_name) === newYear);
                                if (yData?.semesters?.length) {
                                    const activeSem = yData.semesters.find((s: any) => s.is_active) || yData.semesters[0];
                                    setSemester(Number(activeSem.semester_number));
                                }
                            }}
                        >
                            {academicYears.map(y => (
                                <option key={y.id} value={Number(y.year_name)}>{y.year_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Semester */}
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">ภาคเรียน</label>
                        <select
                            className="px-3 py-2 border border-slate-200 rounded-xl w-24 bg-slate-50 font-medium"
                            value={semester}
                            onChange={(e) => setSemester(Number(e.target.value))}
                        >
                            {availableSemesters.map((s: any) => (
                                <option key={s.id} value={Number(s.semester_number)}>{s.semester_number}</option>
                            ))}
                            {!availableSemesters.length && <option value={semester}>{semester}</option>}
                        </select>
                    </div>

                    {/* Subject filter & Department filter – show only for subject-based types */}
                    {isSubjectType && (
                        <>
                            <div className="min-w-[200px]">
                                <label className="text-xs text-slate-500 block mb-1">กลุ่มสาระการเรียนรู้</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                                    value={departmentId}
                                    onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {departments.map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.group_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-[200px]">
                                <label className="text-xs text-slate-500 block mb-1">วิชา</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                                    value={subjectId}
                                    onChange={(e) => setSubjectId(e.target.value === '' ? '' : Number(e.target.value))}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {filteredSubjects.map((s: any) => (
                                        <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Class Level & Room filter – show only for advisor types */}
                    {isAdvisorType && (
                        <>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">ระดับชั้น</label>
                                <select
                                    className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium min-w-[120px]"
                                    value={classLevel}
                                    onChange={(e) => setClassLevel(e.target.value)}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {gradeLevels.map((l) => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">ห้อง</label>
                                <select
                                    className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium min-w-[100px]"
                                    value={room}
                                    onChange={(e) => setRoom(e.target.value)}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {classrooms.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <button onClick={load} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                        ดึงข้อมูล
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4 bg-emerald-50 rounded-2xl px-6 py-4 border border-emerald-100 flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">รวมทั้งสิ้น</span>
                        <span className="text-4xl font-black text-emerald-700">{topics.length}</span>
                        <span className="text-xs text-emerald-500">รายการที่พบ</span>
                    </div>
                    <div className="h-12 w-px bg-emerald-200"></div>
                    <div className="text-sm text-emerald-700 font-medium">{TYPE_LABELS[type]}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">{TYPE_LABELS[type]}</h3>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังประมวลผลข้อมูล...</span>
                    </div>
                ) : topics.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl text-slate-300">∅</span>
                        </div>
                        <p className="font-medium">ยังไม่มีผลการประเมินในประเภทนี้</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {TYPE_COL_LABEL[type]}
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">จำนวนผู้ตอบ</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">คะแนนเฉลี่ย</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">ระดับ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topics.map((t, i) => {
                                    const score = Number(t.avg_score || 0);
                                    let level = "ปรับปรุง";
                                    let color = "bg-red-100 text-red-700 border-red-200";
                                    if (score >= 4.5) { level = "ดีเยี่ยม"; color = "bg-emerald-100 text-emerald-700 border-emerald-200"; }
                                    else if (score >= 3.5) { level = "ดี"; color = "bg-blue-100 text-blue-700 border-blue-200"; }
                                    else if (score >= 2.5) { level = "พอใช้"; color = "bg-amber-100 text-amber-700 border-amber-200"; }

                                    return (
                                        <tr key={t.id || i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-400">{i + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-800">{t.name}</div>
                                                {t.sub_name && <div className="text-xs text-slate-500 mt-0.5">{t.sub_name}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {(() => {
                                                    const answered = t.responses_count || 0;
                                                    const total = t.total_expected || 0;
                                                    const pct = total > 0 ? answered / total : 0;
                                                    const ratioColor = pct >= 1 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-500';
                                                    return (
                                                        <div className="flex flex-col items-center justify-center">
                                                            <div className="flex items-baseline gap-1">
                                                                <span className={`text-base font-bold ${ratioColor}`}>{answered}</span>
                                                                <span className="text-sm font-medium text-slate-500">/ {total}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-400">คน</div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-lg font-black text-slate-800">{score.toFixed(2)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${color}`}>
                                                    {level}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
