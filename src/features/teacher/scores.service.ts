import { prisma } from '@/lib/prisma';

export const TeacherScoresService = {
    // Get teacher's teaching assignments (subjects)
    async getSubjects(teacher_id: number) {
        const assignments = await prisma.teaching_assignments.findMany({
            where: { teacher_id },
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
                semesters: { include: { academic_years: true } },
                class_schedules: {
                    include: {
                        day_of_weeks: true,
                        periods: true,
                        rooms: true,
                    },
                    orderBy: { day_id: 'asc' },
                },
            }
        });

        return assignments.map(ta => {
            const ay = ta.semesters?.academic_years;
            const semesterNum = ta.semesters?.semester_number ?? null;

            const subjectsClean = ta.subjects ? {
                id: ta.subjects.id,
                subject_code: ta.subjects.subject_code,
                name: ta.subjects.subject_name,
                subject_name: ta.subjects.subject_name,
                credit: ta.subjects.credit ? Number(ta.subjects.credit) : 0,
                evaluation_type_id: ta.subjects.evaluation_type_id,
            } : null;

            const schedules = ((ta as any).class_schedules || []).map((sc: any) => ({
                id: sc.id,
                day_id: sc.day_id,
                period_id: sc.period_id,
                room_id: sc.room_id,
                day_of_weeks: sc.day_of_weeks ? {
                    id: sc.day_of_weeks.id,
                    day_name_th: sc.day_of_weeks.day_name_th,
                    short_name: sc.day_of_weeks.short_name,
                } : null,
                periods: sc.periods ? {
                    id: sc.periods.id,
                    period_name: sc.periods.period_name,
                    start_time: sc.periods.start_time ? String(sc.periods.start_time) : null,
                    end_time: sc.periods.end_time ? String(sc.periods.end_time) : null,
                } : null,
                rooms: sc.rooms ? {
                    id: sc.rooms.id,
                    room_name: sc.rooms.room_name,
                } : null,
            }));

            return {
                id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                class_level: ta.classrooms?.levels?.name || '',
                classroom: ta.classrooms?.room_name || '',
                room: ta.classrooms?.room_name || '',
                year: ay?.year_name || '',
                semester: semesterNum,
                subjects: subjectsClean,
                semesters: ta.semesters ? {
                    id: ta.semesters.id,
                    semester_number: semesterNum,
                    academic_years: ay ? {
                        id: ay.id,
                        year_name: ay.year_name,
                    } : null,
                } : null,
                class_schedules: schedules,
            };
        });
    },

    // Get grade categories + assessment items for a teaching assignment
    async getHeaders(teaching_assignment_id: number) {
        const categories = await prisma.grade_categories.findMany({
            where: { teaching_assignment_id },
            include: {
                assessment_items: {
                    orderBy: { id: 'asc' },
                    include: {
                        assessment_item_indicators: {
                            include: { indicators: true }
                        }
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        // Flatten to simple header list
        const headers: any[] = [];
        categories.forEach(cat => {
            cat.assessment_items.forEach(item => {
                headers.push({
                    id: item.id,
                    category_id: cat.id,
                    category_name: cat.name,
                    title: item.name,
                    max_score: Number(item.max_score),
                    weight_percent: Number(cat.weight_percent),
                    indicators: (item as any).assessment_item_indicators?.map((ai: any) => ({
                        id: ai.indicators.id,
                        code: ai.indicators.code,
                        description: ai.indicators.description,
                    })) || [],
                });
            });
        });
        return headers;
    },

    // Add a new assessment item under a grade category
    async addHeader(
        teaching_assignment_id: number,
        category_name_or_title: string,
        title_or_max: string | number,
        max_score_arg?: number,
        indicator_ids?: number[]
    ) {
        const isThreeArgShape = typeof title_or_max === 'number' && max_score_arg === undefined;
        const category_name = isThreeArgShape ? 'ทั่วไป' : category_name_or_title;
        const title = isThreeArgShape ? category_name_or_title : String(title_or_max || '');
        const max_score = isThreeArgShape ? Number(title_or_max) : Number(max_score_arg);

        // Find or create grade category
        let category = await prisma.grade_categories.findFirst({
            where: { teaching_assignment_id, name: category_name }
        });

        if (!category) {
            category = await prisma.grade_categories.create({
                data: {
                    teaching_assignment_id,
                    name: category_name,
                    weight_percent: 100,
                }
            });
        }

        const item = await prisma.assessment_items.create({
            data: {
                grade_category_id: category.id,
                name: title,
                max_score: Number.isFinite(max_score) ? max_score : 0,
            }
        });

        // Save indicator links
        if (indicator_ids && indicator_ids.length > 0) {
            const maxId = await prisma.assessment_item_indicators.aggregate({ _max: { id: true } });
            let nextId = (maxId._max.id || 0) + 1;
            await prisma.assessment_item_indicators.createMany({
                data: indicator_ids.map((indicator_id: number) => ({
                    id: nextId++,
                    assessment_item_id: item.id,
                    indicator_id,
                })),
            });
        }

        return item;
    },

    // Update assessment item
    async updateHeader(id: number, title: string, max_score: number, indicator_ids?: number[]) {
        const item = await prisma.assessment_items.update({
            where: { id },
            data: { name: title, max_score }
        });

        // Sync indicator links
        if (indicator_ids !== undefined) {
            await prisma.assessment_item_indicators.deleteMany({ where: { assessment_item_id: id } });
            if (indicator_ids.length > 0) {
                const maxId = await prisma.assessment_item_indicators.aggregate({ _max: { id: true } });
                let nextId = (maxId._max.id || 0) + 1;
                await prisma.assessment_item_indicators.createMany({
                    data: indicator_ids.map((indicator_id: number) => ({
                        id: nextId++,
                        assessment_item_id: id,
                        indicator_id,
                    })),
                });
            }
        }

        return item;
    },

    // Delete assessment item and its scores
    async deleteHeader(id: number) {
        await prisma.assessment_item_indicators.deleteMany({ where: { assessment_item_id: id } });
        await prisma.student_scores.deleteMany({ where: { assessment_item_id: id } });
        return prisma.assessment_items.delete({ where: { id } });
    },

    // Get indicators for a subject
    async getIndicators(subject_id: number) {
        const indicators = await prisma.indicators.findMany({
            where: { subject_id },
            orderBy: { code: 'asc' },
        });
        return indicators.map(i => ({
            id: i.id,
            code: i.code,
            description: i.description,
        }));
    },

    // Get students enrolled in a teaching assignment
    async getStudents(teaching_assignment_id: number) {
        const enrollments = await prisma.enrollments.findMany({
            where: { teaching_assignment_id },
            include: {
                students: {
                    include: {
                        name_prefixes: true,
                        classroom_students: { take: 1, orderBy: { academic_year: 'desc' } },
                    }
                }
            },
            distinct: ['student_id']
        });

        const mapped = enrollments
            .map(e => {
                const s = e.students;
                if (!s) return null;
                const cs = (s as any).classroom_students?.[0];
                return {
                    id: s.id,
                    enrollment_id: e.id,
                    student_code: s.student_code,
                    prefix: s.name_prefixes?.prefix_name || '',
                    first_name: s.first_name,
                    last_name: s.last_name,
                    roll_number: cs?.roll_number,
                };
            })
            .filter(Boolean);

        return (mapped as any[]).sort((a, b) => {
            const aNum = a.roll_number != null ? Number(a.roll_number) : 999999;
            const bNum = b.roll_number != null ? Number(b.roll_number) : 999999;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.student_code || '').localeCompare(String(b.student_code || ''));
        });
    },

    // Get scores for an assessment item
    async getScores(assessment_item_id: number) {
        const scores = await prisma.student_scores.findMany({
            where: { assessment_item_id },
            include: {
                enrollments: { select: { student_id: true } }
            }
        });

        return scores.map(s => ({
            id: s.id,
            enrollment_id: s.enrollment_id,
            student_id: s.enrollments?.student_id || 0,
            score: Number(s.score || 0),
            is_missing: s.is_missing || false,
            is_passed: s.is_passed,
            remark: s.remark || '',
        }));
    },

    // Get all scores for all assessment items in a section
    async getAllSectionScores(section_id: number) {
        const categories = await prisma.grade_categories.findMany({
            where: { teaching_assignment_id: section_id },
            include: {
                assessment_items: {
                    include: {
                        student_scores: {
                            include: {
                                enrollments: { select: { student_id: true } }
                            }
                        }
                    }
                }
            }
        });

        const scoreData: any[] = [];
        categories.forEach(cat => {
            cat.assessment_items.forEach(item => {
                item.student_scores.forEach(s => {
                    scoreData.push({
                        header_id: item.id,
                        student_id: s.enrollments?.student_id || 0,
                        score: Number(s.score || 0),
                        is_passed: s.is_passed,
                    });
                });
            });
        });
        return scoreData;
    },

    // Save scores for an assessment item
    async saveScores(assessment_item_id: number, scores: { enrollment_id?: number; student_id?: number; score: number; is_passed?: boolean | null }[]) {
        const item = await prisma.assessment_items.findUnique({
            where: { id: assessment_item_id },
            select: {
                grade_categories: {
                    select: { teaching_assignment_id: true }
                }
            }
        });
        const teaching_assignment_id = item?.grade_categories?.teaching_assignment_id;

        const studentIds = (scores || [])
            .map((s) => Number(s.student_id))
            .filter((n) => Number.isFinite(n) && n > 0);

        let enrollmentMap = new Map<number, number>();
        if (teaching_assignment_id && studentIds.length > 0) {
            const enrollments = await prisma.enrollments.findMany({
                where: { teaching_assignment_id, student_id: { in: studentIds } },
                select: { id: true, student_id: true },
            });
            enrollmentMap = new Map(enrollments.map((e) => [e.student_id, e.id]));
        }

        for (const sc of scores || []) {
            const enrollment_id =
                (sc.enrollment_id && Number(sc.enrollment_id)) ||
                (sc.student_id ? enrollmentMap.get(Number(sc.student_id)) : undefined);

            if (!enrollment_id) continue;

            const existing = await prisma.student_scores.findFirst({
                where: { assessment_item_id, enrollment_id }
            });
            if (existing) {
                await prisma.student_scores.update({
                    where: { id: existing.id },
                    data: {
                        score: sc.score,
                        is_passed: sc.is_passed !== undefined ? sc.is_passed : null
                    }
                });
            } else {
                await prisma.student_scores.create({
                    data: {
                        assessment_item_id,
                        enrollment_id,
                        score: sc.score,
                        is_passed: sc.is_passed !== undefined ? sc.is_passed : null
                    }
                });
            }
        }
        return { success: true };
    }
};
