"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";
import Portal from "@/components/Portal";

type SectionLike = {
    id?: number | string | null;
    class_level?: string | number | null;
    classroom?: string | number | null;
    year?: string | number | null;
    semester?: string | number | null;
    semesters?: {
        academic_years?: {
            year_name?: string | number | null;
        } | null;
    } | null;
    subjects?: {
        id?: number | string | null;
        subject_code?: string | number | null;
        name?: string | null;
    } | null;
} | null | undefined;

function toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown) {
    return String(v ?? "").trim();
}

function getSubjectKey(section: SectionLike) {
    const subjectId = txt(section?.subjects?.id);
    if (subjectId) return `id:${subjectId}`;
    return `${txt(section?.subjects?.subject_code)}|${txt(section?.subjects?.name)}`;
}

function formatSubjectLabel(section: SectionLike) {
    const code = txt(section?.subjects?.subject_code);
    const name = txt(section?.subjects?.name);
    if (code && name) return `${code} ${name}`;
    return code || name || "-";
}

function getRoomKey(section: SectionLike) {
    return `${txt(section?.class_level)}|${txt(section?.classroom)}`;
}

function getAcademicYearValue(section: SectionLike) {
    return txt(section?.semesters?.academic_years?.year_name) || txt(section?.year);
}

function getYearKey(section: SectionLike) {
    return getAcademicYearValue(section);
}

function formatYearLabel(section: SectionLike) {
    return getAcademicYearValue(section) || "-";
}

function formatRoomLabel(section: SectionLike) {
    const level = txt(section?.class_level);
    const room = txt(section?.classroom);
    if (level && room && room.includes(level)) return room;
    if (level && room) return `${level}/${room}`;
    return room || level || "-";
}

function getTermKey(section: SectionLike) {
    return `${getAcademicYearValue(section)}|${txt(section?.semester)}`;
}

function formatTermLabel(section: SectionLike) {
    return `ปีการศึกษา ${getAcademicYearValue(section) || "-"} ภาคเรียน ${txt(section?.semester) || "-"}`;
}

export function ScoreInputFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sectionId = Number(searchParams.get("section_id"));
    const hasSection = Number.isFinite(sectionId) && sectionId > 0;

    /* ─── state ─── */
    const [sections, setSections] = useState<any[]>([]);
    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headers, setHeaders] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedHeaderId, setSelectedHeaderId] = useState<number | null>(null);
    const [scoreMap, setScoreMap] = useState<Record<number, Record<number, string>>>({}); // student_id -> header_id -> score
    const [originalScoreMap, setOriginalScoreMap] = useState<Record<number, Record<number, string>>>({});
    const [isPassedMap, setIsPassedMap] = useState<Record<number, Record<number, boolean | null>>>({});
    const [originalIsPassedMap, setOriginalIsPassedMap] = useState<Record<number, Record<number, boolean | null>>>({});
    const [loading, setLoading] = useState(true);
    const [scoreLoading, setScoreLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [showManageModal, setShowManageModal] = useState(false);
    const [showCategoryManageModal, setShowCategoryManageModal] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [categoryTypes, setCategoryTypes] = useState<any[]>([]);
    const [categorySaving, setCategorySaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
    const [selectedRoomKey, setSelectedRoomKey] = useState("");
    const [selectedYearKey, setSelectedYearKey] = useState("");
    const [selectedTermKey, setSelectedTermKey] = useState("");

    // header inline add
    const [showAddHeader, setShowAddHeader] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newMax, setNewMax] = useState(100);
    const [addingHeader, setAddingHeader] = useState(false);
    const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
    const [newCategoryTypeName, setNewCategoryTypeName] = useState("");
    const [addingCategoryType, setAddingCategoryType] = useState(false);
    const [editingCategoryTypeId, setEditingCategoryTypeId] = useState<number | null>(null);
    const [editCategoryTypeName, setEditCategoryTypeName] = useState("");
    const [deletingCategoryTypeId, setDeletingCategoryTypeId] = useState<number | null>(null);

    // header inline edit
    const [editingHeaderId, setEditingHeaderId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editMax, setEditMax] = useState(100);
    const [updatingHeader, setUpdatingHeader] = useState(false);
    const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
    const [deletingHeaderId, setDeletingHeaderId] = useState<number | null>(null);
    const activeHeader = headers.find((h) => h.id === selectedHeaderId) || null;
    const activeMax = toNum(activeHeader?.max_score);

    // categories

    const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({}); // key: studentId-headerId

    /* ─── derived ─── */
    const filteredStudents = students.filter((s) => {
        if (!studentSearch.trim()) return true;
        const q = studentSearch.trim().toLowerCase();
        return [s.student_code, s.first_name, s.last_name].some((v) =>
            String(v ?? "").toLowerCase().includes(q)
        );
    });

    const filledCount = students.filter((s) => {
        const studentScores = scoreMap[s.id] || {};
        const passScores = isPassedMap[s.id] || {};
        return Object.values(studentScores).some(v => v !== "") || 
               Object.values(passScores).some(v => v !== null && v !== undefined);
    }).length;

    const isPassFail = sectionInfo?.subjects?.evaluation_type_id === 2 || sectionInfo?.subjects?.subject_categories_id === 3;

    const invalidCount = students.reduce((acc, s) => {
        if (isPassFail) return acc;
        const studentScores = scoreMap[s.id] || {};
        headers.forEach(h => {
            const raw = studentScores[h.id];
            if (raw == null || raw === "") return;
            const n = Number(raw);
            const hMax = toNum(h.max_score);
            if (!Number.isFinite(n) || n < 0 || (hMax > 0 && n > hMax)) {
                acc++;
            }
        });
        return acc;
    }, 0);

    const changedCount = students.reduce((acc, s) => {
        const studentScores = scoreMap[s.id] || {};
        const originalStudentScores = originalScoreMap[s.id] || {};
        const passScores = isPassedMap[s.id] || {};
        const origPassScores = originalIsPassedMap[s.id] || {};
        headers.forEach(h => {
            if ((studentScores[h.id] ?? "") !== (originalStudentScores[h.id] ?? "") || passScores[h.id] !== origPassScores[h.id]) {
                acc++;
            }
        });
        return acc;
    }, 0);

    const studentTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        students.forEach(s => {
            if (isPassFail) {
                // For PF subjects, return completion count or %? 
                // Let's return raw count for now as it's the "Work count"
                const studentScores = scoreMap[s.id] || {};
                const passScores = isPassedMap[s.id] || {};
                let count = 0;
                headers.forEach(h => {
                    if ((studentScores[h.id] !== "" && studentScores[h.id] != null) || passScores[h.id] === true) {
                        count++;
                    }
                });
                totals[s.id] = count;
                return;
            }

            // Weighted Grade Calculation
            const studentScores = scoreMap[s.id] || {};
            let finalPct = 0;
            
            const totalWeightPercent = categories.reduce((acc, cat) => acc + toNum(cat.weight_percent), 0);

            if (categories.length > 0 && totalWeightPercent > 0) {
                // Weighted Grade Calculation
                categories.forEach(cat => {
                    const catHeaders = headers.filter(h => h.category_id === cat.id);
                    const catMax = catHeaders.reduce((acc, h) => acc + toNum(h.max_score), 0);
                    const catRaw = catHeaders.reduce((acc, h) => acc + toNum(studentScores[h.id]), 0);
                    
                    if (catMax > 0) {
                        const catPct = (catRaw / catMax) * 100;
                        const weightedContrib = (catPct / 100) * toNum(cat.weight_percent);
                        finalPct += weightedContrib;
                    }
                });
            } else {
                // Basic raw percentage calculation (Fallback when no categories or total weight is 0)
                const totalMax = headers.reduce((acc, h) => acc + toNum(h.max_score), 0);
                const totalRaw = headers.reduce((acc, h) => acc + toNum(studentScores[h.id]), 0);
                if (totalMax > 0) {
                    finalPct = (totalRaw / totalMax) * 100;
                }
            }

            totals[s.id] = Math.round(finalPct * 100) / 100;
        });
        return totals;
    }, [students, headers, scoreMap, isPassFail, categories, isPassedMap]);

    const subjectOptions = useMemo(() => {
        const map = new Map<string, string>();
        sections.forEach((s) => {
            const key = getSubjectKey(s);
            if (!key) return;
            if (!map.has(key)) map.set(key, formatSubjectLabel(s));
        });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "th"));
    }, [sections]);

    const roomOptions = useMemo(() => {
        if (!selectedSubjectKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey)
            .forEach((s) => {
                const key = getRoomKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatRoomLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                const [aG = "999", aR = "999"] = a.label.split("/");
                const [bG = "999", bR = "999"] = b.label.split("/");
                const gDiff = Number(aG) - Number(bG);
                if (gDiff !== 0) return gDiff;
                return Number(aR) - Number(bR);
            });
    }, [sections, selectedSubjectKey]);

    const yearOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey)
            .forEach((s) => {
                const key = getYearKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatYearLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => Number(b.value) - Number(a.value));
    }, [sections, selectedSubjectKey, selectedRoomKey]);

    const semesterOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey)
            .forEach((s) => {
                const sem = txt(s?.semester);
                if (!sem) return;
                if (!map.has(sem)) map.set(sem, `ภาคเรียนที่ ${sem}`);
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => Number(a.value) - Number(b.value));
    }, [sections, selectedSubjectKey, selectedRoomKey, selectedYearKey]);

    const termOptions = useMemo(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || !selectedTermKey) return [];
        const map = new Map<string, string>();
        sections
            .filter((s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey)
            .forEach((s) => {
                const key = getTermKey(s);
                if (!key) return;
                if (!map.has(key)) map.set(key, formatTermLabel(s));
            });
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                const [aYear = "0", aSem = "0"] = a.value.split("|");
                const [bYear = "0", bSem = "0"] = b.value.split("|");
                const yearDiff = Number(bYear) - Number(aYear);
                if (yearDiff !== 0) return yearDiff;
                return Number(bSem) - Number(aSem);
            });
    }, [sections, selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey]);

    const selectedSubjectLabel = subjectOptions.find((o) => o.value === selectedSubjectKey)?.label || "-";
    const selectedRoomLabel = roomOptions.find((o) => o.value === selectedRoomKey)?.label || "-";
    const selectedYearLabel = yearOptions.find((o) => o.value === selectedYearKey)?.label || "-";
    const selectedTermLabel = termOptions.find((o) => o.value === selectedTermKey)?.label || "-";
    const selectionReady = !!(selectedSubjectKey && selectedRoomKey && selectedYearKey && selectedTermKey);

    /* ─── loaders ─── */
    const loadCategories = useCallback(async (sectionId: number) => {
        try {
            const data = await TeacherApiService.getScoreCategories(sectionId);
            setCategories(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load categories:", err);
        }
    }, []);

    const loadSections = useCallback(async () => {
        try {
            const data = await TeacherApiService.getTeacherSubjects(session.id);
            setSections(Array.isArray(data) ? data : []);
        } catch { setSections([]); }
    }, [session.id]);

    const loadSectionData = useCallback(async () => {
        if (!hasSection) { setLoading(false); return; }
        setLoading(true);
        try {
            const [headerRows, studentRows, categoryRows, typeRows] = await Promise.all([
                TeacherApiService.getScoreHeaders(sectionId),
                TeacherApiService.getSectionStudents(sectionId),
                TeacherApiService.getScoreCategories(sectionId),
                TeacherApiService.getGradeCategoryTypes(),
            ]);
            const nextHeaders = Array.isArray(headerRows) ? headerRows : [];
            setHeaders(nextHeaders);
            setStudents(Array.isArray(studentRows) ? studentRows : []);
            setCategories(Array.isArray(categoryRows) ? categoryRows : []);
            setCategoryTypes(Array.isArray(typeRows) ? typeRows : []);
            setSelectedHeaderId((prev) => {
                if (prev && nextHeaders.some((h: any) => h.id === prev)) return prev;
                return nextHeaders[0]?.id ?? null;
            });
        } catch (err) {
            console.error("Failed to load section data:", err);
            setHeaders([]);
            setStudents([]);
            setCategories([]);
        } finally { setLoading(false); }
    }, [hasSection, sectionId]);

    const loadScores = useCallback(async (sectionId: number) => {
        setScoreLoading(true);
        try {
            const rows = await TeacherApiService.getSectionScores(sectionId);
            const map: Record<number, Record<number, string>> = {};
            const passMap: Record<number, Record<number, boolean | null>> = {};
            (rows || []).forEach((r: any) => {
                if (r?.student_id && r?.header_id) {
                    if (!map[r.student_id]) map[r.student_id] = {};
                    if (!passMap[r.student_id]) passMap[r.student_id] = {};
                    map[r.student_id][r.header_id] = r.score == null ? "" : String(r.score);
                    passMap[r.student_id][r.header_id] = r.is_passed;
                }
            });
            setScoreMap(map);
            setOriginalScoreMap(JSON.parse(JSON.stringify(map)));
            setIsPassedMap(passMap);
            setOriginalIsPassedMap(JSON.parse(JSON.stringify(passMap)));
        } catch {
            setScoreMap({});
            setOriginalScoreMap({});
            setIsPassedMap({});
            setOriginalIsPassedMap({});
        } finally {
            setScoreLoading(false);
        }
    }, []);

    const handleUpdateCategory = (id: number, name: string, weight: number, typeId?: number) => {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name, weight_percent: weight, category_type_id: typeId, grade_category_types: categoryTypes.find(t => t.id === typeId) } : c));
    };

    const handleAddCategory = async (name: string, weight: number, typeId?: number) => {
        if (!hasSection) return;
        setCategorySaving(true);
        try {
            await TeacherApiService.addScoreCategory(sectionId, name, weight, typeId);
            await loadCategories(sectionId);
        } catch (err) {
            alert("Failed to add category");
        } finally {
            setCategorySaving(false);
        }
    };

    const handleAddCategoryType = async () => {
        if (!newCategoryTypeName.trim()) return;
        setAddingCategoryType(true);
        try {
            await TeacherApiService.addGradeCategoryType(newCategoryTypeName);
            setNewCategoryTypeName("");
            const types = await TeacherApiService.getGradeCategoryTypes();
            setCategoryTypes(types);
        } catch (err) {
            alert("Failed to add category type");
        } finally {
            setAddingCategoryType(false);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        const originalCategories = [...categories];
        // Optimistic UI update
        setCategories(prev => prev.filter(c => c.id !== id));
        setCategorySaving(true);
        setDeletingId(null);
        
        try {
            console.log("Deleting category ID:", id);
            await TeacherApiService.deleteScoreCategory(id);
            await loadSectionData(); // Reload headers as they might have been deleted
            console.log("Deletion successful");
        } catch (err) {
            console.error("Failed to delete category:", err);
            alert("Failed to delete category");
            // Rollback on error
            setCategories(originalCategories);
        } finally {
            setCategorySaving(false);
        }
    };

    const handleUpdateCategoryType = async (id: number, typeName: string) => {
        if (!typeName.trim()) return;
        setAddingCategoryType(true);
        try {
            await TeacherApiService.updateGradeCategoryType(id, typeName);
            setEditingCategoryTypeId(null);
            const types = await TeacherApiService.getGradeCategoryTypes();
            setCategoryTypes(types);
        } catch (err) {
            alert("Failed to update category type");
        } finally {
            setAddingCategoryType(false);
        }
    };

    const handleDeleteCategoryType = async (id: number) => {
        setAddingCategoryType(true);
        setDeletingCategoryTypeId(null);
        try {
            await TeacherApiService.deleteGradeCategoryType(id);
            const types = await TeacherApiService.getGradeCategoryTypes();
            setCategoryTypes(types);
        } catch (err: any) {
            console.error("Failed to delete category type:", err);
            alert("ไม่สามารถลบได้ เนื่องจากรายการนี้ถูกใช้งานอยู่ในระบบ");
        } finally {
            setAddingCategoryType(false);
        }
    };

    const handleSaveCategories = async () => {
        if (!hasSection) return;
        setCategorySaving(true);
        try {
            // Bulk update weights
            for (const cat of categories) {
                await TeacherApiService.updateScoreCategory(cat.id, cat.name || "", cat.weight_percent, cat.category_type_id);
            }
            setShowCategoryManageModal(false);
            await loadSectionData();
        } catch (err) {
            alert("Failed to save categories");
        } finally {
            setCategorySaving(false);
        }
    };

    useEffect(() => { loadSections(); }, [loadSections]);

    useEffect(() => {
        if (hasSection) {
            const found = sections.find((s) => s.id === sectionId) || null;
            setSectionInfo(found);
            loadSectionData();
        } else {
            setLoading(false);
        }
    }, [hasSection, sectionId, sections, loadSectionData]);

    useEffect(() => {
        if (!hasSection) return;
        loadScores(sectionId);
    }, [hasSection, sectionId, loadScores]);

    useEffect(() => {
        if (!hasSection) return;
        const found = sections.find((s) => s.id === sectionId);
        if (!found) return;
        setSelectedSubjectKey(getSubjectKey(found));
        setSelectedRoomKey(getRoomKey(found));
        setSelectedYearKey(getYearKey(found));
        setSelectedTermKey(getTermKey(found));
    }, [hasSection, sectionId, sections]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || !selectedTermKey) return;
        const matched = sections.find(
            (s) =>
                getSubjectKey(s) === selectedSubjectKey &&
                getRoomKey(s) === selectedRoomKey &&
                getYearKey(s) === selectedYearKey &&
                getTermKey(s) === selectedTermKey
        );
        const nextId = Number(matched?.id);
        if (!Number.isFinite(nextId) || nextId <= 0 || nextId === sectionId) return;
        router.push(`/teacher/score_input?section_id=${nextId}`);
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey, sections, sectionId, router]);

    useEffect(() => {
        if (!selectedSubjectKey || selectedRoomKey || roomOptions.length !== 1) return;
        setSelectedRoomKey(roomOptions[0].value);
    }, [selectedSubjectKey, selectedRoomKey, roomOptions]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || selectedYearKey || yearOptions.length === 0) return;
        setSelectedYearKey(yearOptions[0].value);
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, yearOptions]);

    useEffect(() => {
        if (!selectedSubjectKey || !selectedRoomKey || !selectedYearKey || selectedTermKey || semesterOptions.length === 0) return;
        // auto-select term key from first semesterOption
        const firstSem = semesterOptions[0].value;
        const matched = sections.find(
            (s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey && txt(s?.semester) === firstSem
        );
        if (matched) setSelectedTermKey(getTermKey(matched));
    }, [selectedSubjectKey, selectedRoomKey, selectedYearKey, selectedTermKey, semesterOptions, sections]);

    /* ─── handlers ─── */
    const handleSubjectSelect = (value: string) => {
        setSelectedSubjectKey(value);
        setSelectedRoomKey("");
        setSelectedYearKey("");
        setSelectedTermKey("");
    };

    const handleRoomSelect = (value: string) => {
        setSelectedRoomKey(value);
        setSelectedYearKey("");
        setSelectedTermKey("");
    };

    const handleYearSelect = (value: string) => {
        setSelectedYearKey(value);
        setSelectedTermKey("");
    };

    const handleSemesterSelect = (value: string) => {
        // find the section that matches and derive term key
        const matched = sections.find(
            (s) => getSubjectKey(s) === selectedSubjectKey && getRoomKey(s) === selectedRoomKey && getYearKey(s) === selectedYearKey && txt(s?.semester) === value
        );
        setSelectedTermKey(matched ? getTermKey(matched) : "");
    };

    const handleAddHeader = async () => {
        const title = newTitle.trim();
        if (!title) return alert("กรุณากรอกชื่อหัวข้อคะแนน");
        if (!isPassFail && toNum(newMax) <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");
        setAddingHeader(true);
        try {
            const created = await TeacherApiService.addScoreHeader(
                sectionId, 
                title, 
                isPassFail ? 0 : toNum(newMax), 
                [],
                newCategoryId || undefined
            );
            setNewTitle(""); 
            setNewMax(100); 
            setNewCategoryId(null);
            setShowAddHeader(false);
            await loadSectionData();
            if (created?.id) setSelectedHeaderId(created.id);
        } catch { alert("เพิ่มหัวข้อคะแนนไม่สำเร็จ"); }
        finally { setAddingHeader(false); }
    };

    const handleStartEdit = (h: any) => {
        setEditingHeaderId(h.id);
        setEditTitle(String(h.title || ""));
        setEditMax(toNum(h.max_score) || 100);
        setEditCategoryId(h.category_id || null);
    };

    const handleUpdateHeader = async () => {
        if (!editingHeaderId) return;
        const title = editTitle.trim();
        if (!title) return alert("กรุณากรอกชื่อหัวข้อ");
        if (!isPassFail && toNum(editMax) <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");
        setUpdatingHeader(true);
        try {
            await TeacherApiService.updateScoreHeader(
                editingHeaderId, 
                title, 
                isPassFail ? 0 : toNum(editMax), 
                [],
                editCategoryId || undefined
            );
            setEditingHeaderId(null);
            await loadSectionData();
        } catch { alert("แก้ไขหัวข้อไม่สำเร็จ"); }
        finally { setUpdatingHeader(false); }
    };

    const handleDeleteHeader = async (id: number) => {
        setDeletingHeaderId(null);
        try {
            await TeacherApiService.deleteScoreHeader(id);
            if (selectedHeaderId === id) setSelectedHeaderId(null);
            await loadSectionData();
        } catch { alert("ลบหัวข้อไม่สำเร็จ"); }
    };

    const handleSaveScores = async () => {
        if (invalidCount > 0) return alert("มีคะแนนไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก");
        setSaving(true);
        try {
            const changedHeaders = headers.filter(h => {
                return students.some(s => {
                    const current = (scoreMap[s.id] || {})[h.id] ?? "";
                    const original = (originalScoreMap[s.id] || {})[h.id] ?? "";
                    const currentPass = (isPassedMap[s.id] || {})[h.id];
                    const origPass = (originalIsPassedMap[s.id] || {})[h.id];
                    return current !== original || currentPass !== origPass;
                });
            });

            if (changedHeaders.length === 0) {
                setSaving(false);
                return;
            }

            await Promise.all(changedHeaders.map(h => {
                const hMax = toNum(h.max_score);
                return TeacherApiService.saveScores(
                    h.id,
                    students.map((s) => {
                        const raw = (scoreMap[s.id] || {})[h.id];
                        const ip = (isPassedMap[s.id] || {})[h.id];
                        const n = raw == null || raw === "" ? 0 : Number(raw);
                        return {
                            student_id: s.id,
                            score: hMax > 0 ? Math.max(0, Math.min(hMax, toNum(n))) : Math.max(0, toNum(n)),
                            is_passed: ip
                        };
                    })
                );
            }));

            setOriginalScoreMap(JSON.parse(JSON.stringify(scoreMap)));
            setOriginalIsPassedMap(JSON.parse(JSON.stringify(isPassedMap)));
            alert("บันทึกคะแนนเรียบร้อย");
        } catch (err) {
            console.error(err);
            alert("บันทึกคะแนนไม่สำเร็จ");
        }
        finally { setSaving(false); }
    };

    const handleFillZero = () => {
        if (!selectedHeaderId) return alert("กรุณาเลือกหัวข้อที่ต้องการเติม 0");
        setScoreMap((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            students.forEach((s) => {
                if (!next[s.id]) next[s.id] = {};
                if ((next[s.id][selectedHeaderId] ?? "") === "") {
                    next[s.id][selectedHeaderId] = "0";
                }
            });
            return next;
        });
    };

    const handleScoreInputEnter = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, headerId: number) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const nextStudent = filteredStudents[rowIndex + 1];
            if (nextStudent) {
                const nextInput = scoreInputRefs.current[`${nextStudent.id}-${headerId}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === "ArrowRight") {
            const hIndex = headers.findIndex(h => h.id === headerId);
            if (hIndex < headers.length - 1) {
                const nextHeader = headers[hIndex + 1];
                const nextInput = scoreInputRefs.current[`${filteredStudents[rowIndex].id}-${nextHeader.id}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === "ArrowLeft") {
            const hIndex = headers.findIndex(h => h.id === headerId);
            if (hIndex > 0) {
                const nextHeader = headers[hIndex - 1];
                const nextInput = scoreInputRefs.current[`${filteredStudents[rowIndex].id}-${nextHeader.id}`];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        }
    };


    /* ─── render ─── */
    return (
        <div className="space-y-4 pb-24">
            {/* ── Top Bar: Section selector + info ── */}
            <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-60 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                        <Link href="/teacher/scores" className="inline-flex items-center gap-1.5 text-emerald-100 hover:text-white mb-2 transition-colors text-sm font-medium">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            กลับหน้าหลัก
                        </Link>
                        <div className="mt-1">
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                บันทึกคะแนน
                            </h1>
                            {sectionInfo && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                            <svg className="w-5 h-5 text-emerald-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">วิชาที่สอน</div>
                                            <div className="text-sm font-bold leading-tight truncate">{sectionInfo.subjects?.subject_code} {sectionInfo.subjects?.name}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                        <div className="w-10 h-10 rounded-lg bg-teal-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                            <svg className="w-5 h-5 text-teal-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-teal-100">ห้องเรียน</div>
                                            <div className="text-sm font-bold leading-tight">ชั้น{formatRoomLabel(sectionInfo)}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/15">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                                            <svg className="w-5 h-5 text-emerald-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">ปีการศึกษา/ภาคเรียน</div>
                                            <div className="text-sm font-bold leading-tight">{formatTermLabel(sectionInfo)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 flex justify-end">
                        <Link href={`/teacher/grade_cut${hasSection ? `?section_id=${sectionId}` : ""}`}
                            className="inline-flex items-center gap-1.5 text-emerald-100 hover:text-white transition-colors text-sm font-medium">
                            ไปหน้าตัดเกรด
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Selection Box (Premium Design) ── */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 transition-all mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <div className="p-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลการบันทึกคะแนน</h2>
                                <p className="text-xs font-medium text-slate-400">เลือกวิชาและห้องเรียนที่ต้องการจัดการ</p>
                            </div>
                        </div>
                        {!hasSection && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 animate-pulse">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">กรุณาเลือกข้อมูลให้ครบ</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Subject */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                วิชาที่สอน
                            </label>
                            <div className="relative group">
                                <select
                                    value={selectedSubjectKey}
                                    onChange={(e) => handleSubjectSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกวิชา...</option>
                                    {subjectOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Room */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-teal-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                ห้องเรียน
                            </label>
                            <div className="relative group">
                                <select
                                    disabled={!selectedSubjectKey}
                                    value={selectedRoomKey}
                                    onChange={(e) => handleRoomSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-teal-400 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกห้อง...</option>
                                    {roomOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-teal-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                ปีการศึกษา
                            </label>
                            <div className="relative group">
                                <select
                                    disabled={!selectedRoomKey}
                                    value={selectedYearKey}
                                    onChange={(e) => handleYearSelect(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-emerald-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">เลือกปีการศึกษา...</option>
                                    {yearOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-emerald-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Semester */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <svg className="h-4 w-4 text-teal-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                ภาคเรียน
                            </label>
                            <div className="relative group">
                                <select
                                    value={selectedTermKey ? txt(sections.find(s => getTermKey(s) === selectedTermKey)?.semester) : ""}
                                    onChange={(e) => handleSemesterSelect(e.target.value)}
                                    disabled={!selectedYearKey}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all group-hover:bg-white group-hover:border-teal-400 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:opacity-40 cursor-pointer appearance-none"
                                >
                                    <option value="">{selectedYearKey ? "เลือกภาคเรียน..." : "เลือกปีก่อน"}</option>
                                    {semesterOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-teal-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {!hasSection ? (
                /* ── No section selected ── */
                <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mb-4 flex justify-center">
                        <svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700">เลือกวิชา ห้อง และปีการศึกษา เพื่อเริ่มบันทึกคะแนน</h2>
                    <p className="mt-2 text-slate-500">ระบบจะเลือกเทอมล่าสุดให้อัตโนมัติภายใต้ปีการศึกษาที่เลือก</p>
                </section>
            ) : loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ── Score Table ── */}
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Compact stat bar */}
                        <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-50/70">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <span className="font-semibold text-slate-700">{students.length}</span> คน
                                </span>
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                    กรอกแล้ว <span className="font-semibold text-emerald-700">{filledCount}</span>/{students.length}
                                </span>
                                {changedCount > 0 && (
                                    <span className="text-sm text-teal-700 font-medium flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        แก้ไข {changedCount} รายการ
                                    </span>
                                )}
                                {invalidCount > 0 && (
                                    <span className="text-sm text-rose-600 font-medium flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ผิด {invalidCount} จุด
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        placeholder="ค้นหานักเรียน..."
                                        className="w-48 rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        setShowManageModal(true);
                                    }}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                    จัดการหัวข้อ
                                </button>
                                <button
                                    onClick={() => setShowCategoryManageModal(true)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    จัดการหมวดหมู่
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        {scoreLoading ? (
                            <div className="p-16 text-center text-slate-400">
                                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                                <p className="mt-4 text-sm font-medium">กำลังโหลดข้อมูลคะแนน...</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 text-sm">ไม่พบรายชื่อนักเรียนในกลุ่มนี้</div>
                        ) : (
                            <div className="overflow-x-auto max-w-full">
                                <table className="w-full border-collapse">
                                    <thead>
                                        {categories.length > 0 && (
                                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                                <th colSpan={3} className="border-r border-slate-200"></th>
                                                {categories.map(cat => {
                                                    const catHeaders = headers.filter(h => h.category_id === cat.id);
                                                    if (catHeaders.length === 0) return null;
                                                    return (
                                                        <th key={cat.id} colSpan={catHeaders.length} className="px-4 py-2 text-center text-[10px] font-black uppercase text-emerald-500 border-r border-slate-100 bg-emerald-50/30">
                                                            {cat.grade_category_types?.type_name || cat.name} ({cat.weight_percent}%)
                                                        </th>
                                                    );
                                                })}
                                                {headers.filter(h => !h.category_id).length > 0 && (
                                                    <th colSpan={headers.filter(h => !h.category_id).length} className="px-4 py-2 text-center text-[10px] font-black uppercase text-slate-400 border-r border-slate-100">
                                                        อื่นๆ
                                                    </th>
                                                )}
                                                {!isPassFail && <th className="bg-emerald-50/10"></th>}
                                            </tr>
                                        )}
                                        <tr className="bg-slate-50/80 border-b border-slate-200">
                                            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12 border-r border-slate-200">#</th>
                                            <th className="sticky left-12 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] border-r border-slate-200">รหัส</th>
                                            <th className="sticky left-[148px] z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">ชื่อ-นามสกุล</th>
                                            
                                            {/* Sorted by Category */}
                                            {[...categories.map(c => headers.filter(h => h.category_id === c.id)).flat(), ...headers.filter(h => !h.category_id)].map(h => (
                                                <th key={h.id}
                                                    onClick={() => setSelectedHeaderId(h.id)}
                                                    className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-100 min-w-[100px] cursor-pointer transition-colors ${selectedHeaderId === h.id ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}>
                                                    <div className="line-clamp-1" title={h.title}>{h.title}</div>
                                                    {!isPassFail && <div className="mt-0.5 text-[10px] font-normal opacity-60">เต็ม {toNum(h.max_score)}</div>}
                                                </th>
                                            ))}

                                            {!isPassFail && <th className="px-4 py-3 text-center text-xs font-bold text-teal-600 uppercase tracking-wider bg-teal-50/50 min-w-[100px]">คะแนนรวม (%)</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map((s, i) => {
                                            const total = studentTotals[s.id] || 0;
                                            const studentScores = scoreMap[s.id] || {};
                                            const studentOriginalScores = originalScoreMap[s.id] || {};

                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-xs text-slate-400 border-r border-slate-100">{i + 1}</td>
                                                    <td className="sticky left-12 z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-[15px] font-bold font-mono text-slate-600 border-r border-slate-100 tracking-tight">{s.student_code}</td>
                                                    <td className="sticky left-[148px] z-10 bg-white group-hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                        {s.prefix}{s.first_name} {s.last_name}
                                                    </td>

                                                    {headers.map(h => {
                                                        const raw = studentScores[h.id] ?? "";
                                                        const originalRaw = studentOriginalScores[h.id] ?? "";
                                                        const n = raw === "" ? null : Number(raw);
                                                        const hMax = toNum(h.max_score);
                                                        const invalid = !isPassFail && raw !== "" && (!Number.isFinite(n) || (n as number) < 0 || (hMax > 0 && (n as number) > hMax));
                                                        
                                                        const passRaw = (isPassedMap[s.id] || {})[h.id];
                                                        const originalPassRaw = (originalIsPassedMap[s.id] || {})[h.id];
                                                        const changed = isPassFail ? passRaw !== originalPassRaw : raw !== originalRaw;

                                                        return (
                                                            <td key={h.id} className={`px-2 py-1.5 text-center border-r border-slate-50 ${selectedHeaderId === h.id ? "bg-emerald-50/20" : ""}`}>
                                                                {isPassFail ? (
                                                                    <label className="inline-flex items-center justify-center cursor-pointer w-full h-full">
                                                                        <input
                                                                            type="checkbox"
                                                                            className={`w-5 h-5 rounded border-slate-300 text-teal-500 focus:ring-teal-500 cursor-pointer ${changed ? "ring-2 ring-teal-400" : ""}`}
                                                                            checked={passRaw === true}
                                                                            onChange={(e) => setIsPassedMap(prev => ({
                                                                                ...prev,
                                                                                [s.id]: { ...(prev[s.id] || {}), [h.id]: e.target.checked }
                                                                            }))}
                                                                        />
                                                                        <span className={`ml-2 text-sm font-bold ${passRaw ? "text-green-600" : "text-slate-400"}`}>
                                                                            {passRaw ? "ผ" : "มผ"}
                                                                        </span>
                                                                    </label>
                                                                ) : (
                                                                <input
                                                                    ref={(el) => {
                                                                        scoreInputRefs.current[`${s.id}-${h.id}`] = el;
                                                                    }}
                                                                    type="number"
                                                                    value={raw}
                                                                    onFocus={() => setSelectedHeaderId(h.id)}
                                                                    onChange={(e) => setScoreMap((prev) => ({
                                                                        ...prev,
                                                                        [s.id]: { ...(prev[s.id] || {}), [h.id]: e.target.value }
                                                                    }))}
                                                                    onKeyDown={(e) => handleScoreInputEnter(e, i, h.id)}
                                                                    className={`w-16 rounded-lg border px-2 py-1.5 text-center text-sm outline-none transition-all focus:ring-2 ${invalid ? "border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-400 cursor-help"
                                                                        : changed ? "border-teal-300 bg-teal-50 text-teal-800 focus:ring-teal-400"
                                                                            : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20"
                                                                        }`}
                                                                    />
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {!isPassFail && (
                                                        <td className="px-4 py-2 text-center bg-emerald-50/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]">
                                                            <span className={`text-sm font-black ${total > 0 ? "text-emerald-700" : "text-slate-300"}`}>
                                                                {total.toLocaleString()}%
                                                            </span>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* ── Action Bar (Save/Cancel) ── */}
            {hasSection && (
                <div className="mt-6 flex justify-end px-4 overflow-visible">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                            <div className={`w-2.5 h-2.5 rounded-full ${changedCount > 0 ? "bg-teal-500 animate-pulse" : "bg-emerald-500"}`} />
                            <span className="font-medium">{changedCount > 0 ? `มีการเปลี่ยนแปลง ${changedCount} รายการ` : "ข้อมูลเป็นปัจจุบันแล้ว"}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setScoreMap(JSON.parse(JSON.stringify(originalScoreMap)))}
                                disabled={saving || changedCount === 0}
                                className="px-6 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveScores}
                                disabled={saving || invalidCount > 0 || changedCount === 0}
                                className="px-8 py-2.5 rounded-2xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                {saving ? "กำลังบันทึก..." : "บันทึกคะแนนทั้งหมด"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Manage Headers Modal ── */}
            {showManageModal && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">จัดการหัวข้อคะแนน</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{headers.length} หัวข้อคะแนนทั้งหมด</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowManageModal(false);
                                    setShowAddHeader(false);
                                    setEditingHeaderId(null);
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {headers.map((h) => {
                                    const isEditing = editingHeaderId === h.id;
                                    if (isEditing) {
                                        return (
                                            <div key={h.id} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-teal-400 bg-teal-50 animate-in slide-in-from-top-2">
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="w-full rounded-xl border border-teal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                                                        placeholder="ชื่อหัวข้อ"
                                                    />
                                                    {!isPassFail && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-500 font-medium">คะแนนเต็ม:</span>
                                                                <input
                                                                    type="number"
                                                                    value={editMax}
                                                                    onChange={(e) => setEditMax(Number(e.target.value))}
                                                                    className="w-20 rounded-xl border border-teal-200 px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-teal-400"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <span className="text-xs text-slate-500 font-medium">หมวดหมู่:</span>
                                                                <select
                                                                    value={editCategoryId || ""}
                                                                    onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : null)}
                                                                    className="flex-1 rounded-xl border border-teal-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                                                                >
                                                                    <option value="">(ไม่ระบุ)</option>
                                                                    {categories.map(cat => (
                                                                    <option key={cat.id} value={cat.id}>{cat.grade_category_types?.type_name || "(ไม่มีชื่อ)"}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={handleUpdateHeader} disabled={updatingHeader} className="px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 disabled:opacity-50">บันทึก</button>
                                                    <button onClick={() => setEditingHeaderId(null)} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300">ยกเลิก</button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={h.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md transition-all group">
                                            <div>
                                                <div className="font-bold text-slate-700">{h.title}</div>
                                                {!isPassFail && <div className="text-xs text-slate-400 font-medium mt-1">เต็ม {toNum(h.max_score)} คะแนน</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {deletingHeaderId === h.id ? (
                                                    <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                                        <button 
                                                            onClick={() => handleDeleteHeader(h.id)}
                                                            className="bg-rose-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-700 shadow-sm"
                                                        >ยืนยัน</button>
                                                        <button 
                                                            onClick={() => setDeletingHeaderId(null)}
                                                            className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-300"
                                                        >ยกเลิก</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                handleStartEdit(h);
                                                                setDeletingHeaderId(null);
                                                            }} 
                                                            className="p-2 rounded-lg text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors" 
                                                            title="แก้ไข"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeletingHeaderId(h.id)} 
                                                            className="p-2 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors" 
                                                            title="ลบ"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {showAddHeader ? (
                                    <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 space-y-3 animate-in fade-in zoom-in-95">
                                        <input
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                                            placeholder="กรอกชื่อหัวข้อใหม่ (เช่น เก็บหลังเรียนบทที่ 1)"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-4">
                                            {!isPassFail && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 font-medium">คะแนนเต็ม:</span>
                                                    <input
                                                        type="number"
                                                        value={newMax}
                                                        onChange={(e) => setNewMax(Number(e.target.value))}
                                                        className="w-20 rounded-xl border border-emerald-200 px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-emerald-400"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-xs text-slate-500 font-medium">หมวดหมู่:</span>
                                                <select
                                                    value={newCategoryId || ""}
                                                    onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : null)}
                                                    className="flex-1 rounded-xl border border-emerald-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                                                >
                                                    <option value="">(ไม่ระบุ)</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.grade_category_types?.type_name || "(ไม่มีชื่อ)"}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-auto">
                                            <button onClick={handleAddHeader} disabled={addingHeader} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">เพิ่ม</button>
                                            <button onClick={() => { setShowAddHeader(false); setNewTitle(""); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300">ยกเลิก</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowAddHeader(true)}
                                        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        <span className="font-bold">เพิ่มหัวข้อใหม่</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowManageModal(false);
                                    setShowAddHeader(false);
                                    setEditingHeaderId(null);
                                }}
                                className="px-6 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-all hover:shadow-lg active:scale-95"
                            >
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>
            </Portal>
        )}
            {/* ── Manage Categories Modal ── */}
            {showCategoryManageModal && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-emerald-900">จัดการสัดส่วนคะแนน</h3>
                                <p className="text-xs text-emerald-600 mt-0.5">กำหนดหมวดหมู่และน้ำหนักคะแนน (รวมควรเป็น 100%)</p>
                            </div>
                            <button onClick={() => setShowCategoryManageModal(false)} className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-4">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">1. จัดการรายการประเภทคะแนน</h4>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            value={newCategoryTypeName}
                                            onChange={(e) => setNewCategoryTypeName(e.target.value)}
                                            placeholder="ชื่อประเภทเช่น จิตพิสัย, พฤติกรรม"
                                            className="flex-1 rounded-xl border border-emerald-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                                        />
                                        <button 
                                            onClick={handleAddCategoryType}
                                            disabled={addingCategoryType || !newCategoryTypeName.trim()}
                                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            {addingCategoryType ? "..." : "เพิ่มใหม่"}
                                        </button>
                                    </div>

                                    {/* Scrollable list of existing types */}
                                    <div className="max-h-40 overflow-y-auto pr-1 space-y-2 mb-4 custom-scrollbar">
                                        {categoryTypes.map(t => (
                                            <div key={t.id} className="flex items-center gap-2 bg-white border border-emerald-100 p-2 rounded-xl group transition-all hover:border-emerald-300">
                                                {editingCategoryTypeId === t.id ? (
                                                    <div className="flex-1 flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            value={editCategoryTypeName}
                                                            onChange={(e) => setEditCategoryTypeName(e.target.value)}
                                                            className="flex-1 text-sm border-b-2 border-emerald-400 outline-none px-1"
                                                        />
                                                        <button 
                                                            onClick={() => handleUpdateCategoryType(t.id, editCategoryTypeName)}
                                                            className="text-emerald-600 font-bold text-xs"
                                                        >บันทึก</button>
                                                        <button 
                                                            onClick={() => setEditingCategoryTypeId(null)}
                                                            className="text-slate-400 font-bold text-xs"
                                                        >ยกเลิก</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="flex-1 text-sm font-semibold text-slate-700">{t.type_name}</span>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {deletingCategoryTypeId === t.id ? (
                                                                <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                                                    <button 
                                                                        onClick={() => handleDeleteCategoryType(t.id)}
                                                                        className="bg-rose-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-700 shadow-sm"
                                                                    >ยืนยัน</button>
                                                                    <button 
                                                                        onClick={() => setDeletingCategoryTypeId(null)}
                                                                        className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-300"
                                                                    >ยกเลิก</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingCategoryTypeId(t.id);
                                                                            setEditCategoryTypeName(t.type_name);
                                                                            setDeletingCategoryTypeId(null);
                                                                        }}
                                                                        className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                                        title="แก้ไขชื่อนี้"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setDeletingCategoryTypeId(t.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                        title="ลบประเภทนี้"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h.01" /></svg>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-emerald-100">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">2. เลือกประเภทคะแนนลงในตาราง (กดเพื่อเพิ่ม)</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {categoryTypes.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    handleAddCategory("", 0, t.id);
                                                }}
                                                className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-white text-emerald-700 text-sm font-bold hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                            >
                                                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                                </svg>
                                                {t.type_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white group">
                                        <div className="flex-1 flex flex-col">
                                            <span className="font-bold text-slate-700">{cat.grade_category_types?.type_name || "(ไม่มีชื่อ)"}</span>
                                            {cat.category_type_id && (
                                                <span className="text-[10px] text-slate-400 uppercase tracking-widest">Predefined Type</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={cat.weight_percent} 
                                                onChange={(e) => handleUpdateCategory(cat.id, "", Number(e.target.value), cat.category_type_id)}
                                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-emerald-400"
                                            />
                                            <span className="text-xs text-slate-400">%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {deletingId === cat.id ? (
                                                <div className="flex items-center gap-2 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                                                    <span className="text-[10px] font-bold text-rose-600 uppercase">ลบ?</span>
                                                    <button 
                                                        onClick={() => handleDeleteCategory(cat.id)}
                                                        className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded font-bold hover:bg-rose-700"
                                                    >ยืนยัน</button>
                                                    <button 
                                                        onClick={() => setDeletingId(null)}
                                                        className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold hover:bg-slate-300"
                                                    >ยกเลิก</button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setDeletingId(cat.id)} 
                                                    className="p-2 text-slate-400 hover:text-rose-500 transition-all flex-shrink-0"
                                                    title="ลบหมวดหมู่นี้"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h.01" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {categories.length > 0 && (() => {
                                const totalWeight = categories.reduce((a, b) => a + Number(b.weight_percent || 0), 0);
                                const isOverweight = totalWeight > 100;
                                return (
                                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-500">รวมทั้งหมด:</span>
                                            {isOverweight && <span className="text-[10px] text-rose-500 font-bold">* ห้ามเกิน 100%</span>}
                                        </div>
                                        <span className={`text-lg font-black ${isOverweight ? "text-rose-600 animate-pulse" : totalWeight === 100 ? "text-emerald-600" : "text-teal-500"}`}>
                                            {totalWeight}%
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowCategoryManageModal(false)} className="px-6 py-2 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-300 transition-colors">ยกเลิก</button>
                            <button 
                                onClick={handleSaveCategories} 
                                disabled={categorySaving || categories.reduce((a, b) => a + Number(b.weight_percent || 0), 0) > 100}
                                className="px-8 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                            >
                                {categorySaving && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                บันทึกทั้งหมด
                            </button>
                        </div>
                    </div>
                </div>
            </Portal>
        )}
        </div>
    );
}

