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
            select: { id: true, year_name: true, is_active: true }
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
        const where: any = { test_name: { contains: test_name } };
        if (grade_level) {
            const levelNum = extractLevelNumber(grade_level);
            if (levelNum) {
                where.OR = [
                    { grade_level: { contains: levelNum } },
                    { grade_level: { contains: grade_level } }
                ];
            } else {
                where.grade_level = { contains: grade_level };
            }
        }
        if (academic_year) {
            where.academic_year = academic_year;
        }
        if (gender) {
            where.gender = gender;
        }

        return (prisma as any).fitness_test_criteria.findFirst({
            where,
            orderBy: { created_at: 'desc' }
        });
    },
    async getFitnessCriteriaForClass(test_name: string, grade_level: string, academic_year?: number) {
        const where: any = { test_name: { contains: test_name } };
        if (grade_level) {
            const levelNum = extractLevelNumber(grade_level);
            if (levelNum) {
                where.OR = [
                    { grade_level: { contains: levelNum } },
                    { grade_level: { contains: grade_level } }
                ];
            } else {
                where.grade_level = { contains: grade_level };
            }
        }
        if (academic_year) {
            where.academic_year = academic_year;
        }

        return (prisma as any).fitness_test_criteria.findMany({
            where,
            orderBy: { created_at: 'desc' }
        });
    },

    async getAllCriteria(test_name?: string, grade_level?: string, academic_year?: number) {
        const where: any = {};
        if (test_name) where.test_name = { contains: test_name };
        if (grade_level) where.grade_level = { contains: grade_level };
        if (academic_year) where.academic_year = academic_year;

        return (prisma as any).fitness_test_criteria.findMany({
            where,
            orderBy: [{ test_name: 'asc' }, { grade_level: 'asc' }, { gender: 'asc' }]
        });
    },

    async upsertCriteria(data: any) {
        const { id, test_name, grade_level, gender, passing_threshold, unit, comparison_type, academic_year } = data;
        const recordData = {
            test_name,
            grade_level,
            gender,
            passing_threshold: parseFloat(passing_threshold) || 0,
            unit,
            comparison_type,
            academic_year: academic_year ? parseInt(academic_year as any) : undefined
        };

        if (id) {
            return (prisma as any).fitness_test_criteria.update({
                where: { id: parseInt(id as any) },
                data: recordData
            });
        } else {
            return (prisma as any).fitness_test_criteria.create({
                data: recordData
            });
        }
    },

    async deleteCriteria(id: number) {
        return (prisma as any).fitness_test_criteria.delete({
            where: { id: parseInt(id as any) }
        });
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
