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
        void teacher_id;
        const where: any = {};
        
        if ((classLevel && classLevel !== 'ทั้งหมด') || (room && room !== 'ทั้งหมด')) {
            where.classroom_students = { some: { classrooms: {} } };
            
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
    async saveFitnessTest(data: any) {
        void data;
        return { message: 'ระบบทดสอบสมรรถภาพยังไม่พร้อมใช้งาน' };
    },
};
