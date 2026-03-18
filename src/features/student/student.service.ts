import { prisma } from '@/lib/prisma';

export const StudentService = {
    async getAllStudents() {
        const students = await prisma.students.findMany({
            take: 50,
            orderBy: { student_code: 'asc' },
            include: {
                name_prefixes: true,
                classroom_students: {
                    include: { classrooms: { include: { levels: true } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            } as any
        });

        return students.map((s: any) => ({
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: s.classroom_students?.[0]?.classrooms?.levels?.name || '',
            room: s.classroom_students?.[0]?.classrooms?.room_name || '',
            status: s.student_statuses?.status_name || '',
            phone: s.phone || '',
        }));
    },

    async getStudentById(student_code: string) {
        const s = await prisma.students.findUnique({
            where: { student_code },
            include: {
                name_prefixes: true,
                classroom_students: {
                    include: { classrooms: { include: { levels: true } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            } as any
        });
        if (!s) return null;
        return {
            id: s.id,
            student_code: s.student_code,
            prefix: (s as any).name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: (s as any).genders?.name || '',
            class_level: (s as any).classroom_students?.[0]?.classrooms?.levels?.name || '',
            room: (s as any).classroom_students?.[0]?.classrooms?.room_name || '',
            status: (s as any).student_statuses?.status_name || '',
            phone: s.phone || '',
            address: s.address || '',
            date_of_birth: s.date_of_birth,
        };
    },
};
