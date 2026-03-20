import { prisma } from '@/lib/prisma';

const DEFAULT_THRESHOLDS = {
    a: 80,
    b_plus: 75,
    b: 70,
    c_plus: 65,
    c: 60,
    d_plus: 55,
    d: 50,
};

const GRADE_ALIAS_TO_NUMERIC: Record<string, string> = {
    a: '4',
    'a+': '4',
    '4': '4',
    '4.0': '4',
    'b+': '3.5',
    '3.5': '3.5',
    b: '3',
    '3': '3',
    '3.0': '3',
    'c+': '2.5',
    '2.5': '2.5',
    c: '2',
    '2': '2',
    '2.0': '2',
    'd+': '1.5',
    '1.5': '1.5',
    d: '1',
    '1': '1',
    '1.0': '1',
    f: '0',
    '0': '0',
    '0.0': '0',
};

const THRESHOLD_KEY_BY_GRADE: Record<string, keyof typeof DEFAULT_THRESHOLDS> = {
    '4': 'a',
    '3.5': 'b_plus',
    '3': 'b',
    '2.5': 'c_plus',
    '2': 'c',
    '1.5': 'd_plus',
    '1': 'd',
};

function normalizeGradeLabel(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    return GRADE_ALIAS_TO_NUMERIC[raw] || raw;
}

function isExactNumericGradeLabel(value: unknown): boolean {
    const raw = String(value ?? '').trim();
    return ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'].includes(raw);
}

function isSupportedGradeLabel(value: unknown): boolean {
    return Object.prototype.hasOwnProperty.call(THRESHOLD_KEY_BY_GRADE, String(value ?? '')) || String(value ?? '') === '0';
}

function shouldPreferScale(next: any, current: any): boolean {
    const nextNumeric = isExactNumericGradeLabel(next.__raw_label);
    const currentNumeric = isExactNumericGradeLabel(current.__raw_label);
    if (nextNumeric !== currentNumeric) return nextNumeric;

    const nextMin = Number(next.min_score ?? 0);
    const currentMin = Number(current.min_score ?? 0);
    if (nextMin !== currentMin) return nextMin > currentMin;

    const nextId = Number(next.id ?? Number.MAX_SAFE_INTEGER);
    const currentId = Number(current.id ?? Number.MAX_SAFE_INTEGER);
    return nextId < currentId;
}

function normalizeGradeScales(scales: any[]) {
    const byGrade = new Map<string, any>();

    for (const scale of scales) {
        const normalizedGrade = normalizeGradeLabel(scale?.letter_grade);
        if (!isSupportedGradeLabel(normalizedGrade)) continue;

        const candidate = {
            ...scale,
            letter_grade: normalizedGrade,
            __raw_label: String(scale?.letter_grade ?? '').trim(),
        };

        const existing = byGrade.get(normalizedGrade);
        if (!existing || shouldPreferScale(candidate, existing)) {
            byGrade.set(normalizedGrade, candidate);
        }
    }

    return Array.from(byGrade.values())
        .map((entry) => {
            const { __raw_label: _rawLabel, ...scale } = entry;
            void _rawLabel;
            return scale;
        })
        .sort((a, b) => Number(b.min_score ?? 0) - Number(a.min_score ?? 0));
}

function defaultGradeFromPct(pct: number): string {
    if (pct >= 80) return '4';
    if (pct >= 75) return '3.5';
    if (pct >= 70) return '3';
    if (pct >= 65) return '2.5';
    if (pct >= 60) return '2';
    if (pct >= 55) return '1.5';
    if (pct >= 50) return '1';
    return '0';
}

function gradePointFromLabel(label: unknown): number | null {
    const normalized = normalizeGradeLabel(label);
    const point = Number(normalized);
    return Number.isFinite(point) ? point : null;
}

export const TeacherGradeCutService = {
    async getThresholds(teaching_assignment_id?: number) {
        let groupId = null;
        let isCustom = false;
        if (teaching_assignment_id) {
            const assignment = await prisma.teaching_assignments.findUnique({
                where: { id: teaching_assignment_id },
                select: { grade_scale_group_id: true }
            });
            groupId = assignment?.grade_scale_group_id;
            if (groupId) isCustom = true;
        }

        let rawScales = await prisma.grade_scales.findMany({
            where: { grade_scale_group_id: groupId || null },
            orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
        });

        // Fallback to global scales if the group is empty
        if (groupId && rawScales.length === 0) {
            rawScales = await prisma.grade_scales.findMany({
                where: { grade_scale_group_id: null },
                orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
            });
            isCustom = false;
        }

        const scales = normalizeGradeScales(rawScales);

        // Format for frontend compatibility
        if (scales.length === 0) {
            return { ...DEFAULT_THRESHOLDS, is_custom: false };
        }

        const thresholds: any = { ...DEFAULT_THRESHOLDS, is_custom: isCustom };
        scales.forEach(s => {
            const key = THRESHOLD_KEY_BY_GRADE[String(s.letter_grade)];
            if (key) thresholds[key] = Number(s.min_score);
        });

        const activeGroup = groupId ? await prisma.grade_scale_groups.findUnique({
            where: { id: groupId },
            select: { id: true, name: true }
        }) : null;

        return { 
            ...thresholds, 
            active_group_id: activeGroup?.id || null,
            active_group_name: activeGroup?.name || "เกณฑ์มาตรฐาน (Default)"
        };
    },

    // Delete custom scale group for a teaching assignment
    async resetThresholds(teaching_assignment_id: number) {
        const assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            select: { grade_scale_group_id: true }
        });

        if (!assignment?.grade_scale_group_id) return { success: true };

        const groupId = assignment.grade_scale_group_id;

        // Decouple first
        await prisma.teaching_assignments.update({
            where: { id: teaching_assignment_id },
            data: { grade_scale_group_id: null }
        });

        // Check if other assignments use this group 
        // AND if it's NOT a system/default group (though we normally only delete groups created for sections)
        const count = await prisma.teaching_assignments.count({
            where: { grade_scale_group_id: groupId }
        });

        if (count === 0) {
            const group = await prisma.grade_scale_groups.findUnique({ where: { id: groupId } });
            // Only delete if it looks like a private group created for an assignment
            if (group?.name?.startsWith("Grade Scale for Teaching Assignment")) {
                await prisma.grade_scales.deleteMany({ where: { grade_scale_group_id: groupId } });
                await prisma.grade_scale_groups.delete({ where: { id: groupId } });
            }
        }

        return { success: true };
    },

    async getGradeScaleGroups() {
        return prisma.grade_scale_groups.findMany({
            orderBy: { name: 'asc' }
        });
    },

    async setGradeScaleGroup(teaching_assignment_id: number, group_id: number | null) {
        await prisma.teaching_assignments.update({
            where: { id: teaching_assignment_id },
            data: { grade_scale_group_id: group_id }
        });
        return { success: true };
    },

    async updateManualGrade(enrollment_id: number, letter_grade: string, grade_point?: number, is_locked: boolean = true) {
        const finalGrade = await prisma.final_grades.findUnique({
            where: { enrollment_id }
        });

        if (finalGrade) {
            await prisma.final_grades.update({
                where: { id: finalGrade.id },
                data: {
                    letter_grade,
                    grade_point: grade_point !== undefined ? grade_point : gradePointFromLabel(letter_grade),
                    is_locked,
                }
            });
        } else {
            // We need total_score if creating from scratch, but usually calculate first
            await prisma.final_grades.create({
                data: {
                    enrollment_id,
                    total_score: 0, // Placeholder
                    letter_grade,
                    grade_point: grade_point !== undefined ? grade_point : gradePointFromLabel(letter_grade),
                    is_locked: true
                }
            });
        }
        return { success: true };
    },

    // Save grade scales (per-section using grade_scale_groups)
    async saveThresholds(teaching_assignment_id: number, thresholds: any) {
        let assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            select: { grade_scale_group_id: true }
        });

        let groupId = assignment?.grade_scale_group_id;

        if (!groupId) {
            const group = await prisma.grade_scale_groups.create({
                data: {
                    name: `Grade Scale for Teaching Assignment ${teaching_assignment_id}`,
                }
            });
            groupId = group.id;
            await prisma.teaching_assignments.update({
                where: { id: teaching_assignment_id },
                data: { grade_scale_group_id: groupId }
            });
        }

        const t = {
            a: Number(thresholds?.a ?? 80),
            b_plus: Number(thresholds?.b_plus ?? 75),
            b: Number(thresholds?.b ?? 70),
            c_plus: Number(thresholds?.c_plus ?? 65),
            c: Number(thresholds?.c ?? 60),
            d_plus: Number(thresholds?.d_plus ?? 55),
            d: Number(thresholds?.d ?? 50),
        };

        const rows = [
            { letter_grade: '4', grade_point: 4.0, min_score: t.a, max_score: 100 },
            { letter_grade: '3.5', grade_point: 3.5, min_score: t.b_plus, max_score: Math.max(t.a - 0.01, t.b_plus) },
            { letter_grade: '3', grade_point: 3.0, min_score: t.b, max_score: Math.max(t.b_plus - 0.01, t.b) },
            { letter_grade: '2.5', grade_point: 2.5, min_score: t.c_plus, max_score: Math.max(t.b - 0.01, t.c_plus) },
            { letter_grade: '2', grade_point: 2.0, min_score: t.c, max_score: Math.max(t.c_plus - 0.01, t.c) },
            { letter_grade: '1.5', grade_point: 1.5, min_score: t.d_plus, max_score: Math.max(t.c - 0.01, t.d_plus) },
            { letter_grade: '1', grade_point: 1.0, min_score: t.d, max_score: Math.max(t.d_plus - 0.01, t.d) },
            { letter_grade: '0', grade_point: 0.0, min_score: 0, max_score: Math.max(t.d - 0.01, 0) },
        ];

        await prisma.$transaction(async (tx) => {
            for (const row of rows) {
                const existing = await tx.grade_scales.findFirst({
                    where: { letter_grade: row.letter_grade, grade_scale_group_id: groupId },
                    select: { id: true },
                    orderBy: { id: 'asc' },
                });

                if (existing) {
                    await tx.grade_scales.update({
                        where: { id: existing.id },
                        data: {
                            min_score: row.min_score,
                            max_score: row.max_score,
                            grade_point: row.grade_point,
                        },
                    });
                } else {
                    await tx.grade_scales.create({
                        data: {
                            letter_grade: row.letter_grade,
                            min_score: row.min_score,
                            max_score: row.max_score,
                            grade_point: row.grade_point,
                            grade_scale_group_id: groupId,
                        },
                    });
                }
            }
        });

        return { success: true };
    },

    // Grade summary for all students in a teaching assignment
    async getGradeSummary(teaching_assignment_id: number) {
        const assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            include: {
                subjects: {
                    include: { subject_categories: true }
                },
                grade_categories: {
                    include: { assessment_items: true }
                }
            }
        });

        if (!assignment) return [];

        const isPF = assignment.subjects?.subject_categories_id === 3 || assignment.subjects?.evaluation_type_id === 2;
        const totalItemsInAssignment = assignment.grade_categories.reduce((acc, cat) => acc + cat.assessment_items.length, 0);

        const enrollments = await prisma.enrollments.findMany({
            where: { teaching_assignment_id },
            include: {
                students: { include: { name_prefixes: true } },
                student_scores: {
                    include: {
                        assessment_items: true
                    }
                },
                final_grades: true,
            },
            distinct: ['student_id']
        });

        const groupId = assignment?.grade_scale_group_id;
        let rawScales = await prisma.grade_scales.findMany({
            where: { grade_scale_group_id: groupId || null },
            orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
        });
        if (groupId && rawScales.length === 0) {
            rawScales = await prisma.grade_scales.findMany({
                where: { grade_scale_group_id: null },
                orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
            });
        }
        const scales = normalizeGradeScales(rawScales);

        return enrollments.map(e => {
            const student = e.students;
            if (!student) return null;

            let finalPct = 0;
            let totalRawScore = 0;
            let totalMaxPossible = 0;
            let itemsSubmitted = 0;

            if (isPF) {
                // Pass/Fail: "ต้องส่งให้ครบถึงจะผ่าน"
                itemsSubmitted = e.student_scores.filter(sc => sc.is_passed === true).length;
                const isPassed = itemsSubmitted >= totalItemsInAssignment;
                const displayGrade = isPassed ? "ผ" : "มผ";
                
                return {
                    student_id: student.id,
                    enrollment_id: e.id,
                    student_code: student.student_code,
                    prefix: student.name_prefixes?.prefix_name || '',
                    first_name: student.first_name,
                    last_name: student.last_name,
                    total_score: itemsSubmitted,
                    max_possible: totalItemsInAssignment,
                    percentage: totalItemsInAssignment > 0 ? Math.round((itemsSubmitted / totalItemsInAssignment) * 100 * 100) / 100 : 0,
                    grade: displayGrade,
                    calculated_grade: displayGrade,
                    stored_grade: e.final_grades?.letter_grade || null,
                    is_locked: Boolean(e.final_grades?.is_locked),
                    is_pf: true
                };
            }

            // Weighted Grade Calculation
            const totalWeightPercent = assignment.grade_categories.reduce((acc, cat) => acc + Number(cat.weight_percent || 0), 0);

            if (assignment.grade_categories.length > 0 && totalWeightPercent > 0) {
                assignment.grade_categories.forEach(cat => {
                    const catItems = cat.assessment_items;
                    const catMax = catItems.reduce((acc, item) => acc + Number(item.max_score || 0), 0);
                    
                    const catScores = e.student_scores.filter(sc => sc.assessment_items?.grade_category_id === cat.id);
                    const catRaw = catScores.reduce((acc, sc) => acc + Number(sc.score || 0), 0);
                    
                    totalRawScore += catRaw;
                    totalMaxPossible += catMax;

                    if (catMax > 0) {
                        const catPct = (catRaw / catMax) * 100;
                        const weightedContrib = (catPct / 100) * Number(cat.weight_percent);
                        finalPct += weightedContrib;
                    }
                });
            } else {
                // Fallback: If no categories exist or the total category weight is 0, use the raw sum
                totalMaxPossible = assignment.grade_categories.reduce((acc, cat) => 
                    acc + cat.assessment_items.reduce((sum, item) => sum + Number(item.max_score || 0), 0), 0
                );
                totalRawScore = e.student_scores.reduce((acc, sc) => acc + Number(sc.score || 0), 0);
                
                if (totalMaxPossible > 0) {
                    finalPct = (totalRawScore / totalMaxPossible) * 100;
                }
            }

            const pct = Math.round(finalPct * 100) / 100;
            const calculatedGrade = calculateGradeFromScales(pct, scales);
            const normalizedStoredGrade = normalizeGradeLabel(e.final_grades?.letter_grade);
            const rawStoredGrade = String(e.final_grades?.letter_grade ?? '').trim();
            const storedGrade = normalizedStoredGrade || rawStoredGrade || null;
            const isLocked = Boolean(e.final_grades?.is_locked);
            const displayGrade = isLocked ? (storedGrade || calculatedGrade) : calculatedGrade;

            return {
                student_id: student.id,
                enrollment_id: e.id,
                student_code: student.student_code,
                prefix: student.name_prefixes?.prefix_name || '',
                first_name: student.first_name,
                last_name: student.last_name,
                total_score: totalRawScore,
                max_possible: totalMaxPossible,
                percentage: pct,
                grade: displayGrade,
                calculated_grade: calculatedGrade,
                stored_grade: storedGrade,
                is_locked: isLocked,
                is_pf: false
            };
        }).filter(Boolean);
    },

    // Calculate and save final grades
    async calculateAndSaveGrades(teaching_assignment_id: number) {
        const summary = await this.getGradeSummary(teaching_assignment_id);
        const assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            include: {
                subjects: { select: { subject_categories_id: true, evaluation_type_id: true } }
            }
        });
        
        if (!assignment) return { success: false, message: "Assignment not found" };
        const isPF = assignment.subjects?.subject_categories_id === 3 || assignment.subjects?.evaluation_type_id === 2;

        const groupId = assignment?.grade_scale_group_id;
        let rawScales = await prisma.grade_scales.findMany({
            where: { grade_scale_group_id: groupId || null },
            orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
        });
        if (groupId && rawScales.length === 0) {
            rawScales = await prisma.grade_scales.findMany({
                where: { grade_scale_group_id: null },
                orderBy: [{ min_score: 'desc' }, { id: 'asc' }]
            });
        }
        const scales = normalizeGradeScales(rawScales);

        console.log(`[GradeCut] Processing ${summary.length} students for assignment ${teaching_assignment_id} (P/F: ${isPF})`);

        let savedCount = 0;
        for (const s of summary) {
            if (!s) continue;

            let finalGrade: string;
            let finalGradePoint: number | null;
            let gradeScaleId: number | null = null;

            if (isPF) {
                finalGrade = String(s.grade); // "ผ" or "มผ"
                finalGradePoint = finalGrade === "ผ" ? 1 : 0;
            } else {
                const gradeScale = findGradeScale(s.percentage, scales);
                const fallbackGrade = normalizeGradeLabel(s.grade) || String(s.grade ?? '0');
                finalGrade = gradeScale?.letter_grade || fallbackGrade;
                finalGradePoint = gradeScale?.grade_point != null ? Number(gradeScale.grade_point) : gradePointFromLabel(finalGrade);
                gradeScaleId = gradeScale?.id || null;
            }

            try {
                const existing = await prisma.final_grades.findUnique({
                    where: { enrollment_id: s.enrollment_id }
                });

                if (existing) {
                    if (!existing.is_locked) {
                        await prisma.final_grades.update({
                            where: { id: existing.id },
                            data: {
                                total_score: s.total_score,
                                letter_grade: finalGrade,
                                grade_point: finalGradePoint,
                                grade_scale_id: gradeScaleId,
                            }
                        });
                    }
                } else {
                    await prisma.final_grades.create({
                        data: {
                            enrollment_id: s.enrollment_id,
                            total_score: s.total_score,
                            letter_grade: finalGrade,
                            grade_point: finalGradePoint,
                            grade_scale_id: gradeScaleId,
                        }
                    });
                }
                savedCount++;
            } catch (err: any) {
                console.error(`[GradeCut] Failed to save grade for enrollment ${s.enrollment_id}:`, err.message);
            }
        }

        console.log(`[GradeCut] Successfully saved ${savedCount}/${summary.length} grades`);
        return { success: true, count: savedCount, total: summary.length };
    }
};

function calculateGradeFromScales(pct: number, scales: any[]): string {
    const scale = findGradeScale(pct, scales);
    return scale?.letter_grade || defaultGradeFromPct(pct);
}

function findGradeScale(pct: number, scales: any[]) {
    for (const scale of scales) {
        if (pct >= Number(scale.min_score)) {
            return scale;
        }
    }
    return scales.find((s) => String(s.letter_grade) === '0') || null;
}
