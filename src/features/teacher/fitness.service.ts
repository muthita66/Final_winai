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
    async getStudentsForTest(teacher_id: number, classLevel?: string, room?: string) {
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

        const mapped = (students as any[]).map((s: any) => {
            const cs = s.classroom_students?.[0];
            const currentClassroom = cs?.classrooms;
            const levelName = currentClassroom?.levels?.name || '';
            const roomName = currentClassroom?.room_name || '';
            const className = levelName && roomName ? `${levelName}/${roomName}` : (levelName || roomName || '');
            
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
                fitness_tests: [],
            };
        });

        return mapped.sort((a, b) => {
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
        const { student_id, teacher_id, test_name, result_value, standard_value, status, year, semester } = data;

        // 1. Authorization Check: Is this teacher an advisor for this student?
        const advisorClassrooms = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true }
        });
        const advisorRoomIds = advisorClassrooms.map(ac => ac.classroom_id);

        const studentInAdvisorRoom = await prisma.classroom_students.findFirst({
            where: {
                student_id: student_id,
                classroom_id: { in: advisorRoomIds },
                // academic_year: year // Optional: check academic year too
            }
        });

        if (!studentInAdvisorRoom) {
            throw new Error('ไม่อนุญาตให้บันทึกข้อมูลนักเรียนที่ไม่ได้อยู่ในความดูแลของท่าน');
        }

        // 2. Find or match criteria
        const criteria = await this.getFitnessCriteria(test_name, '', year); // Basic match by name

        // 3. Save to student_fitness_records
        // Handle Weight/Height specially if needed, but the UI sends "น้ำหนัก (Weight)" as test_name
        
        // Find existing record for this term/test
        const existing = await prisma.student_fitness_records.findFirst({
            where: {
                student_id,
                academic_year: year,
                semester,
                OR: [
                    { test_name: test_name },
                    { fitness_test_id: criteria?.id }
                ]
            }
        });

        const recordData = {
            student_id,
            academic_year: year,
            semester,
            test_date: new Date(),
            test_name,
            test_result: parseFloat(result_value) || 0,
            score: 0, // Could be calculated
            grade: status,
            is_passed: status === 'ผ่าน',
            fitness_test_id: criteria?.id || null,
            recorded_by: teacher_id
        };

        if (existing) {
            return prisma.student_fitness_records.update({
                where: { id: existing.id },
                data: recordData
            });
        } else {
            return prisma.student_fitness_records.create({
                data: recordData
            });
        }
    },
};
