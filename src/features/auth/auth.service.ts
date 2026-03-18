import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const AuthService = {
    async authenticateUser(code: string, password: string, role: string) {
        const normalizedCode = String(code || '').trim();
        const normalizedRole = String(role || '').toLowerCase().trim();

        // 1. Find user by actor code
        const user = await prisma.users.findFirst({
            where:
                normalizedRole === 'student'
                    ? { students: { is: { student_code: normalizedCode } } }
                    : normalizedRole === 'teacher'
                        ? { teachers: { is: { teacher_code: normalizedCode } } }
                        : { username: normalizedCode },
            include: {
                roles: true,
                students: {
                    include: {
                        name_prefixes: true,
                        classroom_students: {
                            include: { classrooms: { include: { levels: true } } },
                            orderBy: { academic_year: 'desc' },
                            take: 1
                        }
                    },
                },
                teachers: {
                    include: {
                        name_prefixes: true,
                    },
                },
            },
        });

        if (!user) {
            throw new Error('ไม่พบผู้ใช้ในระบบ');
        }

        // 2. Check role match
        const userRole = user.roles.role_name.toLowerCase();
        if (userRole !== normalizedRole) {
            throw new Error('บทบาทไม่ตรงกับผู้ใช้');
        }

        // 3. Verify password (password_hash is on users table)
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('รหัสผ่านไม่ถูกต้อง');
        }

        // 4. Build payload based on role
        let payload: any = null;

        if (normalizedRole === 'student' && user.students) {
            const s = user.students as any;
            const prefix = s.name_prefixes?.prefix_name || '';
            const fullName = [prefix, s.first_name, s.last_name].filter(Boolean).join(' ').trim();
            const currentAssignment = s.classroom_students?.[0]?.classrooms;
            const classLevel = currentAssignment?.levels?.name || '';
            const room = currentAssignment?.room_name || '';

            payload = {
                id: s.id,
                userId: user.id,
                code: s.student_code,
                role: 'student',
                name: fullName || s.student_code,
                class_level: classLevel,
                room: room,
            };
        } else if (normalizedRole === 'teacher' && user.teachers) {
            const t = user.teachers;
            const prefix = t.name_prefixes?.prefix_name || '';
            const fullName = [prefix, t.first_name, t.last_name].filter(Boolean).join(' ').trim();

            payload = {
                id: t.id,
                userId: user.id,
                code: t.teacher_code,
                role: 'teacher',
                name: fullName || t.teacher_code,
            };
        } else if (normalizedRole === 'director') {
            // Director has no separate profile table — use users data
            payload = {
                id: user.id,
                userId: user.id,
                code: user.username,
                role: 'director',
                name: user.username,
            };
        }

        if (!payload) {
            throw new Error('ไม่พบข้อมูลโปรไฟล์ผู้ใช้');
        }

        // 5. Update last_login
        await prisma.users.update({
            where: { id: user.id },
            data: { last_login: new Date() },
        });

        return payload;
    }
};
