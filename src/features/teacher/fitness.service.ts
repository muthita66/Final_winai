import { prisma } from '@/lib/prisma';

function extractLevelNumber(value: string) {
    const m = String(value || '').match(/(\d+)/);
    return m ? m[1] : '';
}

/**
 * Fitness service is stubbed because current DB has no fitness result tables.
 * It still resolves students by class/room so the page can be used for data entry UI.
 */
export const TeacherFitnessService = {
    async getStudentsForTest(teacher_id: number, classLevel?: string, room?: string, year?: number, semester?: number) {
        // Find authorized classrooms first
        const advisorClassrooms = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true }
        });
        const authorizedIds = advisorClassrooms.map(ac => ac.classroom_id);

        if (authorizedIds.length === 0) return [];

        const where: any = {
            classroom_students: {
                some: {
                    classroom_id: { in: authorizedIds },
                    classrooms: {}
                }
            }
        };
        
        if ((classLevel && classLevel !== 'ทั้งหมด') || (room && room !== 'ทั้งหมด')) {
            if (classLevel && classLevel !== 'ทั้งหมด') {
                const levelNum = extractLevelNumber(classLevel);
                if (levelNum) {
                    where.classroom_students.some.classrooms.levels = { 
                        name: { contains: levelNum } 
                    };
                } else {
                    where.classroom_students.some.classrooms.levels = { 
                        name: classLevel 
                    };
                }
            }
            
            if (room && room !== 'ทั้งหมด') {
                where.classroom_students.some.classrooms.room_name = { endsWith: room };
            }
        }

        const students = await (prisma.students as any).findMany({
            where,
            orderBy: { student_code: 'asc' },
            include: {
                name_prefixes: true,
                genders: true,
                classroom_students: { 
                    include: { classrooms: { include: { levels: true } } },
                    take: 1
                }
            },
        });

        // 2. Fetch existing fitness results and health checkups
        let fitnessRecords: any[] = [];
        let healthRecords: any[] = [];

        try {
            fitnessRecords = await prisma.student_fitness_records.findMany({
                where: {
                    student_id: { in: students.map((s: any) => s.id) },
                    academic_year: year || undefined,
                    semester: (typeof semester === 'number' || (typeof semester === 'string' && semester !== 'all')) ? Number(semester) : undefined,
                }
            });
        } catch (e) {
            console.error("Error fetching fitness records:", e);
            fitnessRecords = await prisma.student_fitness_records.findMany({
                where: { student_id: { in: students.map((s: any) => s.id) } },
                orderBy: { created_at: 'desc' }
            }).catch(() => []);
        }

        try {
            healthRecords = await prisma.student_health_checkups.findMany({
                where: {
                    student_id: { in: students.map((s: any) => s.id) },
                    academic_year: year || undefined,
                    semester: (typeof semester === 'number' || (typeof semester === 'string' && semester !== 'all')) ? Number(semester) : undefined,
                }
            });
        } catch (e) {
            console.error("Error fetching health checkups:", e);
            healthRecords = await prisma.student_health_checkups.findMany({
                where: { student_id: { in: students.map((s: any) => s.id) } },
                orderBy: { created_at: 'desc' }
            }).catch(() => []);
        }

        // 3. Map students with their results
        const mapped = (students as any[]).map((s: any) => {
            const cs = s.classroom_students?.[0];
            const currentClassroom = cs?.classrooms;
            const levelName = currentClassroom?.levels?.name || '';
            const roomName = currentClassroom?.room_name || '';
            const className = levelName && roomName ? `${levelName}/${roomName}` : (levelName || roomName || '');
            
            const studentFitness = fitnessRecords.filter(r => r.student_id === s.id);
            const studentHealthRecords = healthRecords.filter(r => r.student_id === s.id);
            // Aggregate weight and height from all records in the term, taking the most recent non-null values
            const sortedHealth = [...studentHealthRecords].sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0));
            const latestWeight = sortedHealth.find(r => r.weight !== null && r.weight !== undefined)?.weight;
            const latestHeight = sortedHealth.find(r => r.height !== null && r.height !== undefined)?.height;

            let tests = studentFitness.map(r => ({
                test_name: r.test_name,
                test_result: r.test_result,
                status: r.grade,
                is_passed: r.is_passed,
                fitness_test_id: r.fitness_test_id
            }));

            // Merge weight/height from healthRecords if they exist
            if (latestWeight !== undefined && latestWeight !== null) {
                tests.push({ test_name: "น้ำหนัก (Weight)", test_result: latestWeight, status: null, is_passed: null, fitness_test_id: null });
            }
            if (latestHeight !== undefined && latestHeight !== null) {
                tests.push({ test_name: "ส่วนสูง (Height)", test_result: latestHeight, status: null, is_passed: null, fitness_test_id: null });
            }

            return {
                id: s.id,
                student_code: s.student_code,
                prefix: s.name_prefixes?.prefix_name || '',
                first_name: s.first_name,
                last_name: s.last_name,
                gender: s.genders?.name || '',
                grade_level: levelName,
                class_name: className,
                roll_number: cs?.roll_number,
                fitness_tests: tests,
            };
        });

        let recordsMap: Record<number, { weight?: number, height?: number, fitness: Record<string, any> }> = {};
        
        let semesterId: number | null = null;
        if (year && semester) {
            const semRes = await prisma.$queryRawUnsafe<any[]>(`
                SELECT s.id 
                FROM semesters s 
                JOIN academic_years a ON s.academic_year_id = a.id 
                WHERE a.year_name = $1 AND s.semester_number = $2
            `, String(year), Number(semester));
            if (semRes.length > 0) semesterId = semRes[0].id;
        }

        if (semesterId) {
             const studentIds = mapped.map((s: any) => Number(s.id)).filter(id => !isNaN(id) && id > 0);
             
             if (studentIds.length > 0) {
                 let healthRecords: any[] = [];
                 let fitnessRecords: any[] = [];
                 
                 try {
                     const idsStr = studentIds.join(',');
                     healthRecords = await prisma.$queryRawUnsafe<any[]>(`
                         SELECT student_id, weight, height 
                         FROM student_health_checkups 
                         WHERE semester_id = $1 AND student_id IN (${idsStr})
                     `, semesterId);
                 } catch (e) {
                     console.error("Failed to fetch existing health records:", e);
                 }
                 
                 try {
                     const idsStr = studentIds.join(',');
                     fitnessRecords = await prisma.$queryRawUnsafe<any[]>(`
                         SELECT r.student_id, c.test_name, r.test_result, r.grade 
                         FROM student_fitness_records r
                         LEFT JOIN fitness_test_criteria c ON r.fitness_test_id = c.id
                         WHERE r.semester_id = $1 AND r.student_id IN (${idsStr})
                     `, semesterId);
                 } catch (e) {
                     console.error("Failed to fetch existing fitness records:", e);
                 }
                 
                 healthRecords.forEach(h => {
                     if (!recordsMap[h.student_id]) recordsMap[h.student_id] = { fitness: {} };
                     recordsMap[h.student_id].weight = h.weight != null ? Number(h.weight) : undefined;
                     recordsMap[h.student_id].height = h.height != null ? Number(h.height) : undefined;
                 });
                 
                 fitnessRecords.forEach(f => {
                     if (!recordsMap[f.student_id]) recordsMap[f.student_id] = { fitness: {} };
                     if (f.test_name) {
                         recordsMap[f.student_id].fitness[f.test_name] = {
                             result: f.test_result != null ? Number(f.test_result) : undefined,
                             status: f.grade || undefined
                         };
                     }
                 });
             }
        }

        const finalMapped = mapped.map((s: any) => ({
            ...s,
            existing_health: recordsMap[s.id] ? { weight: recordsMap[s.id].weight, height: recordsMap[s.id].height } : null,
            existing_fitness: recordsMap[s.id]?.fitness || {},
        }));

        return finalMapped.sort((a, b) => {
            const aNum = a.roll_number != null ? Number(a.roll_number) : 999999;
            const bNum = b.roll_number != null ? Number(b.roll_number) : 999999;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.student_code || '').localeCompare(String(b.student_code || ''));
        });
    },
    async getAcademicYears() {
        return prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' },
            select: {
                id: true,
                year_name: true,
                is_active: true,
                semesters: {
                    select: {
                        id: true,
                        semester_number: true,
                        is_active: true
                    },
                    orderBy: {
                        semester_number: 'asc'
                    }
                }
            }
        });
    },
    async getAdvisorClasses(teacher_id: number) {
        const advisors = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            include: {
                classrooms: {
                    include: {
                        levels: true
                    }
                }
            }
        });

        return advisors.map(a => ({
            class_level: a.classrooms.levels.name,
            room: a.classrooms.room_name
        }));
    },
    async getFitnessCriteria(test_name: string, grade_level: string, academic_year?: number, gender?: string) {
        let sql = `SELECT * FROM fitness_test_criteria WHERE test_name ILIKE $1`;
        const params: any[] = [`%${test_name}%`];
        let pIdx = 2;

        if (grade_level) {
            const levelNum = extractLevelNumber(grade_level);
            if (levelNum) {
                sql += ` AND (grade_level ILIKE $${pIdx} OR grade_level ILIKE $${pIdx + 1})`;
                params.push(`%${levelNum}%`, `%${grade_level}%`);
                pIdx += 2;
            } else {
                sql += ` AND grade_level ILIKE $${pIdx}`;
                params.push(`%${grade_level}%`);
                pIdx++;
            }
        }
        if (academic_year) {
            sql += ` AND academic_year = $${pIdx}`;
            params.push(academic_year);
            pIdx++;
        }
        if (gender) {
            sql += ` AND gender = $${pIdx}`;
            params.push(gender);
            pIdx++;
        }
        sql += ` ORDER BY created_at DESC LIMIT 1`;

        const results = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
        return results[0] || null;
    },
    async getFitnessCriteriaForClass(test_name: string, grade_level: string, academic_year?: number) {
        let sql = `SELECT * FROM fitness_test_criteria WHERE test_name ILIKE $1`;
        const params: any[] = [`%${test_name}%`];
        let pIdx = 2;

        if (grade_level) {
            const levelNum = extractLevelNumber(grade_level);
            if (levelNum) {
                sql += ` AND (grade_level ILIKE $${pIdx} OR grade_level ILIKE $${pIdx + 1})`;
                params.push(`%${levelNum}%`, `%${grade_level}%`);
                pIdx += 2;
            } else {
                sql += ` AND grade_level ILIKE $${pIdx}`;
                params.push(`%${grade_level}%`);
                pIdx++;
            }
        }
        if (academic_year) {
            sql += ` AND academic_year = $${pIdx}`;
            params.push(academic_year);
            pIdx++;
        }
        sql += ` ORDER BY created_at DESC`;

        return prisma.$queryRawUnsafe<any[]>(sql, ...params);
    },

    async getAllCriteria(test_name?: string, grade_level?: string, academic_year?: number) {
        let sql = `SELECT * FROM fitness_test_criteria WHERE 1=1`;
        const params: any[] = [];
        let pIdx = 1;

        if (test_name) {
            sql += ` AND test_name ILIKE $${pIdx}`;
            params.push(`%${test_name}%`);
            pIdx++;
        }
        if (grade_level) {
            sql += ` AND grade_level ILIKE $${pIdx}`;
            params.push(`%${grade_level}%`);
            pIdx++;
        }
        if (academic_year) {
            sql += ` AND academic_year = $${pIdx}`;
            params.push(academic_year);
            pIdx++;
        }
        sql += ` ORDER BY test_name ASC, grade_level ASC, gender ASC`;

        return prisma.$queryRawUnsafe<any[]>(sql, ...params);
    },

    async upsertCriteria(data: any) {
        const { id, test_name, grade_level, gender, passing_threshold, unit, comparison_type, academic_year } = data;
        const pThres = parseFloat(passing_threshold) || 0;
        const aYear = academic_year ? parseInt(academic_year as any) : null;

        if (id) {
            const results = await prisma.$queryRawUnsafe<any[]>(`
                UPDATE fitness_test_criteria 
                SET test_name = $1, grade_level = $2, gender = $3, passing_threshold = $4, 
                    unit = $5, comparison_type = $6, academic_year = $7
                WHERE id = $8
                RETURNING *
            `, test_name, grade_level, gender, pThres, unit, comparison_type, aYear, parseInt(id as any));
            return results[0];
        } else {
            const results = await prisma.$queryRawUnsafe<any[]>(`
                INSERT INTO fitness_test_criteria (test_name, grade_level, gender, passing_threshold, unit, comparison_type, academic_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, test_name, grade_level, gender, pThres, unit, comparison_type, aYear);
            return results[0];
        }
    },

    async deleteCriteria(id: number) {
        return prisma.$executeRawUnsafe(`
            DELETE FROM fitness_test_criteria WHERE id = $1
        `, parseInt(id as any));
    },
    async saveFitnessTest(data: any) {
        const { record_type, student_id, teacher_id, test_name, result_value, standard_value, status, year, semester, criteria_id, weight, height } = data;

        // Resolve semesterId
        let semesterId: number | null = null;
        if (year && semester) {
            const semRes = await prisma.$queryRawUnsafe<any[]>(`
                SELECT s.id 
                FROM semesters s 
                JOIN academic_years a ON s.academic_year_id = a.id 
                WHERE a.year_name = $1 AND s.semester_number = $2
            `, String(year), Number(semester));
            if (semRes.length > 0) semesterId = semRes[0].id;
        }

        if (!semesterId) {
            throw new Error('ไม่พบข้อมูลปีการศึกษา/ภาคเรียนในระบบ');
        }

        // 2. Health Checkups
        if (record_type === 'health' || test_name === "น้ำหนัก (Weight)" || test_name === "ส่วนสูง (Height)") {
            const existingHealth = await prisma.$queryRawUnsafe<any[]>(`
                SELECT id, weight, height FROM student_health_checkups
                WHERE student_id = $1 AND semester_id = $2
            `, student_id, semesterId);

            let w = weight !== undefined && weight !== null ? Number(weight) : null;
            let h = height !== undefined && height !== null ? Number(height) : null;

            // Legacy fallback
            if (test_name === "น้ำหนัก (Weight)") w = parseFloat(result_value) || 0;
            if (test_name === "ส่วนสูง (Height)") h = parseFloat(result_value) || 0;

            if (existingHealth.length > 0) {
                // Retain old value if new value is not provided
                if (w === null) w = existingHealth[0].weight ? Number(existingHealth[0].weight) : null;
                if (h === null) h = existingHealth[0].height ? Number(existingHealth[0].height) : null;

                await prisma.$executeRawUnsafe(`
                    UPDATE student_health_checkups
                    SET weight = $1, height = $2, checkup_date = CURRENT_TIMESTAMP, recorded_by = $3
                    WHERE id = $4
                `, w, h, teacher_id, existingHealth[0].id);
            } else {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO student_health_checkups (student_id, semester_id, checkup_date, weight, height, recorded_by)
                    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
                `, student_id, semesterId, w, h, teacher_id);
            }
            return { success: true };
        }

        // 3. Fitness Tests
        let finalCriteriaId = criteria_id;
        if (!finalCriteriaId && test_name) {
            const criteria = await this.getFitnessCriteria(test_name, '', year);
            finalCriteriaId = criteria?.id || null;
        }

        if (!finalCriteriaId) {
            throw new Error('ไม่พบรหัสเกณฑ์การประเมิน (Criteria ID)');
        }

        const existingFitness = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id FROM student_fitness_records
            WHERE student_id = $1 AND semester_id = $2 AND fitness_test_id = $3
        `, student_id, semesterId, finalCriteriaId);

        const resVal = parseFloat(result_value) || 0;
        const isPassed = status === 'ผ่าน';

        if (existingFitness.length > 0) {
            await prisma.$executeRawUnsafe(`
                UPDATE student_fitness_records
                SET test_result = $1, grade = $2, is_passed = $3, test_date = CURRENT_TIMESTAMP, recorded_by = $4
                WHERE id = $5
            `, resVal, status, isPassed, teacher_id, existingFitness[0].id);
        } else {
            await prisma.$executeRawUnsafe(`
                INSERT INTO student_fitness_records (student_id, semester_id, fitness_test_id, test_result, grade, is_passed, test_date, recorded_by)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
            `, student_id, semesterId, finalCriteriaId, resVal, status, isPassed, teacher_id);
        }
        return { success: true };
    },
};
