import { prisma } from '@/lib/prisma';

export const ProfileService = {
    async getProfile(student_id: number) {
        if (!student_id) return null;
        const s = await (prisma.students as any).findUnique({
            where: { id: student_id },
            include: {
                name_prefixes: true,
                classroom_students: {
                    include: { classrooms: { include: { levels: true, programs: true } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            }
        });
        if (!s) return null;
        const currentRoom = (s as any).classroom_students?.[0]?.classrooms;
        return {
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: currentRoom?.levels?.name || '',
            room: currentRoom?.room_name || '',
            program: currentRoom?.programs?.name || '',
            status: s.student_statuses?.status_name || '',
            birthday: s.date_of_birth,
            date_of_birth: s.date_of_birth,
            phone: s.phone || '',
            address: s.address || '',
            admission_year: s.admission_year,
            enrollment_date: s.enrollment_date,
        };
    },

    async updateProfile(student_id: number, data: any) {
        if (!student_id) throw new Error("Student ID is required");
        const birthdayInput = Object.prototype.hasOwnProperty.call(data, "birthday")
            ? data.birthday
            : data.date_of_birth;

        let prefixId: number | null | undefined = undefined;
        if (Object.prototype.hasOwnProperty.call(data, "prefix")) {
            const prefixName = String(data.prefix || "").trim();
            if (!prefixName) {
                prefixId = null;
            } else {
                const prefix = await prisma.name_prefixes.findUnique({
                    where: { prefix_name: prefixName },
                    select: { id: true },
                });
                if (!prefix) {
                    throw new Error(`Invalid prefix: ${prefixName}`);
                }
                prefixId = prefix.id;
            }
        }

        await prisma.students.update({
            where: { id: student_id },
            data: {
                first_name: data.first_name || undefined,
                last_name: data.last_name || undefined,
                date_of_birth: birthdayInput === ""
                    ? null
                    : (birthdayInput ? new Date(birthdayInput) : undefined),
                phone: data.phone || undefined,
                address: data.address || undefined,
                prefix_id: prefixId,
            }
        });

        return this.getProfile(student_id);
    }
};
