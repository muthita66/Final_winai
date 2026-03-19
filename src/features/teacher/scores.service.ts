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
        // Fetch categories using raw query to bypass stale client
        const categories = await prisma.$queryRaw`
            SELECT id, teaching_assignment_id, weight_percent, category_type_id FROM "grade_categories"
            WHERE "teaching_assignment_id" = ${teaching_assignment_id}
            ORDER BY "id" ASC
        ` as any[];

        // Fetch assessment items for these categories
        const categoryIds = categories.map(c => c.id);
        const assessmentItems = categoryIds.length > 0 
            ? await prisma.assessment_items.findMany({
                where: { grade_category_id: { in: categoryIds } },
                include: {
                    assessment_item_indicators: {
                        include: { indicators: true }
                    }
                },
                orderBy: { id: 'asc' }
            })
            : [];

        // Fetch types manually since Prisma Client might be stale
        const types = await this.getCategoryTypes() as any[];
        const typeMap = new Map(types.map((t: any) => [t.id, t]));

        // Map items back to categories for flattening
        const catMap = new Map(categories.map(c => [c.id, { ...c, assessment_items: [] }]));
        assessmentItems.forEach(item => {
            const cat = catMap.get(item.grade_category_id);
            if (cat) cat.assessment_items.push(item);
        });

        // Flatten to simple header list
        const headers: any[] = [];
        categories.forEach((cat: any) => {
            const typeInfo: any = cat.category_type_id ? typeMap.get(cat.category_type_id) : null;
            const catWithItems = catMap.get(cat.id);
            catWithItems?.assessment_items.forEach((item: any) => {
                headers.push({
                    id: item.id,
                    category_id: cat.id,
                    category_name: typeInfo?.type_name || "(ไม่มีชื่อ)",
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

    // Get grade categories for a teaching assignment
    async getCategories(teaching_assignment_id: number) {
        const categories = await prisma.$queryRaw`
            SELECT id, teaching_assignment_id, weight_percent, category_type_id FROM "grade_categories"
            WHERE "teaching_assignment_id" = ${teaching_assignment_id}
            ORDER BY "id" ASC
        ` as any[];

        // Join types manually
        const types = await this.getCategoryTypes() as any[];
        const typeMap = new Map(types.map((t: any) => [t.id, t]));

        return categories.map((cat: any) => ({
            ...cat,
            grade_category_types: cat.category_type_id ? typeMap.get(cat.category_type_id) : null
        }));
    },

    // Get predefined grade category types - Use raw query if client is stale
    async getCategoryTypes() {
        try {
            return await prisma.$queryRaw`SELECT id, type_name, description FROM "grade_category_types" ORDER BY id ASC`;
        } catch (err) {
            console.error("Raw query for category types failed:", err);
            return [];
        }
    },

    // Add a new grade category type
    async addCategoryType(type_name: string) {
        try {
            await prisma.$executeRaw`
                INSERT INTO "grade_category_types" ("type_name")
                VALUES (${type_name})
            `;
            return { success: true };
        } catch (err) {
            console.error("Raw insert for category type failed:", err);
            throw err;
        }
    },

    // Update a grade category type
    async updateCategoryType(id: number, type_name: string) {
        try {
            await prisma.$executeRaw`
                UPDATE "grade_category_types"
                SET "type_name" = ${type_name}
                WHERE "id" = ${id}
            `;
            return { success: true };
        } catch (err) {
            console.error("Raw update for category type failed:", err);
            throw err;
        }
    },

    // Delete a grade category type
    async deleteCategoryType(id: number) {
        try {
            await prisma.$executeRaw`
                DELETE FROM "grade_category_types"
                WHERE "id" = ${id}
            `;
            return { success: true };
        } catch (err) {
            console.error("Raw delete for category type failed:", err);
            throw err;
        }
    },

    // Add a new grade category
    async addCategory(
        teaching_assignment_id: number,
        name: string, // Kept for interface compatibility but ignored
        weight_percent: number,
        category_type_id?: number
    ) {
        // Use raw query for creation to bypass stale client
        const weight = Number.isFinite(weight_percent) ? weight_percent : 0;
        
        try {
            await prisma.$executeRaw`
                INSERT INTO "grade_categories" ("teaching_assignment_id", "weight_percent", "category_type_id")
                VALUES (${teaching_assignment_id}, ${weight}, ${category_type_id || null})
            `;
            // Return something compatible or null
            return { success: true };
        } catch (err) {
            console.error("Raw insert for category failed:", err);
            throw err;
        }
    },

    // Update a grade category
    async updateCategory(id: number, name: string, weight_percent: number, category_type_id?: number) {
        const weight = Number.isFinite(weight_percent) ? weight_percent : 0;

        try {
            await prisma.$executeRaw`
                UPDATE "grade_categories"
                SET "category_type_id" = ${category_type_id || null}, "weight_percent" = ${weight}
                WHERE "id" = ${id}
            `;
            return { success: true };
        } catch (err) {
            console.error("Raw update for category failed:", err);
            throw err;
        }
    },

    // Delete a grade category
    async deleteCategory(id: number) {
        try {
            // 1. Delete all related records using raw SQL to bypass stale client
            await prisma.$executeRaw`DELETE FROM "assessment_item_indicators" WHERE "assessment_item_id" IN (SELECT id FROM "assessment_items" WHERE "grade_category_id" = ${id})`;
            await prisma.$executeRaw`DELETE FROM "student_scores" WHERE "assessment_item_id" IN (SELECT id FROM "assessment_items" WHERE "grade_category_id" = ${id})`;
            await prisma.$executeRaw`DELETE FROM "assessment_items" WHERE "grade_category_id" = ${id}`;
            await prisma.$executeRaw`DELETE FROM "grade_categories" WHERE "id" = ${id}`;
            
            return { success: true };
        } catch (err) {
            console.error("Raw delete for category failed:", err);
            throw err;
        }
    },

    // Add a new assessment item
    async addHeader(
        teaching_assignment_id: number,
        category_id_or_name: number | string,
        title_or_max?: string | number,
        max_score_arg?: number,
        indicator_ids?: number[]
    ) {
        let categoryId: number;
        let title: string;
        let max_score: number;

        if (typeof category_id_or_name === 'number') {
            categoryId = category_id_or_name;
            title = String(title_or_max || '');
            max_score = Number(max_score_arg);
        } else {
            // Legacy signature support
            const isThreeArgShape = typeof title_or_max === 'number' && max_score_arg === undefined;
            const category_name = isThreeArgShape ? 'ทั่วไป' : category_id_or_name;
            title = isThreeArgShape ? category_id_or_name : String(title_or_max || '');
            max_score = isThreeArgShape ? Number(title_or_max) : Number(max_score_arg);

            // Find or create category
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
            categoryId = category.id;
        }

        const item = await prisma.assessment_items.create({
            data: {
                grade_category_id: categoryId,
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
    async updateHeader(id: number, title: string, max_score: number, indicator_ids?: number[], category_id?: number) {
        const data: any = { name: title, max_score };
        if (category_id) data.grade_category_id = category_id;

        const item = await prisma.assessment_items.update({
            where: { id },
            data
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
        await prisma.$executeRaw`DELETE FROM "assessment_item_indicators" WHERE "assessment_item_id" = ${id}`;
        await prisma.$executeRaw`DELETE FROM "student_scores" WHERE "assessment_item_id" = ${id}`;
        return prisma.$executeRaw`DELETE FROM "assessment_items" WHERE "id" = ${id}`;
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
        const scores: any[] = await prisma.$queryRawUnsafe(`
            SELECT ss.*, e.student_id
            FROM student_scores ss
            JOIN enrollments e ON ss.enrollment_id = e.id
            WHERE ss.assessment_item_id = $1
        `, assessment_item_id);

        return scores.map(s => ({
            id: s.id,
            enrollment_id: s.enrollment_id,
            student_id: s.student_id || 0,
            score: Number(s.score || 0),
            is_missing: s.is_missing || false,
            is_passed: s.is_passed,
            remark: s.remark || '',
        }));
    },

    // Get all scores for all assessment items in a section
    async getAllSectionScores(section_id: number) {
        // 3. Fetch categories via raw SQL
        const categories = await prisma.$queryRaw`
            SELECT id, teaching_assignment_id, weight_percent, category_type_id
            FROM "grade_categories"
            WHERE "teaching_assignment_id" = ${section_id}
        ` as any[];

        // 4. Fetch predefined types
        const types = await prisma.$queryRaw`SELECT id, type_name FROM "grade_category_types"` as any[];
        if (categories.length === 0) return [];

        const catIds = categories.map(c => c.id);

        // 5. Fetch scores via Raw SQL to avoid Prisma Client schema mismatches
        const scores: any[] = await prisma.$queryRawUnsafe(`
            SELECT ss.assessment_item_id as header_id, e.student_id, ss.score, ss.is_passed
            FROM student_scores ss
            JOIN enrollments e ON ss.enrollment_id = e.id
            JOIN assessment_items ai ON ss.assessment_item_id = ai.id
            WHERE ai.grade_category_id = ANY($1::int[])
        `, catIds);

        return scores.map(s => ({
            header_id: s.header_id,
            student_id: s.student_id || 0,
            score: Number(s.score || 0),
            is_passed: s.is_passed,
        }));
    },

    // Save scores for an assessment item
    async saveScores(assessment_item_id: number, scores: { enrollment_id?: number; student_id?: number; score: number; is_passed?: boolean | null }[]) {
        // Use raw SQL to find the teaching_assignment_id via the header's category
        const result = await prisma.$queryRaw`
            SELECT gc.teaching_assignment_id 
            FROM "assessment_items" ai
            JOIN "grade_categories" gc ON ai.grade_category_id = gc.id
            WHERE ai.id = ${assessment_item_id}
            LIMIT 1
        ` as any[];
        
        const teaching_assignment_id = result[0]?.teaching_assignment_id;

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

            const existing: any[] = await prisma.$queryRawUnsafe(`
                SELECT id FROM student_scores 
                WHERE assessment_item_id = $1 AND enrollment_id = $2
                LIMIT 1
            `, assessment_item_id, enrollment_id);

            const isPassedVal = sc.is_passed !== undefined ? sc.is_passed : null;
            const scoreVal = sc.score !== undefined ? sc.score : 0;

            if (existing.length > 0) {
                await prisma.$executeRawUnsafe(`
                    UPDATE student_scores 
                    SET score = $1, is_passed = $2, updated_at = NOW()
                    WHERE id = $3
                `, scoreVal, isPassedVal, existing[0].id);
            } else {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO student_scores (assessment_item_id, enrollment_id, score, is_passed, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, NOW(), NOW())
                `, assessment_item_id, enrollment_id, scoreVal, isPassedVal);
            }
        }
        return { success: true };
    }
};
