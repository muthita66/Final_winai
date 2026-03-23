import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

const STUDENT_PHOTO_REL_DIR = '/uploads/student-photos';
const STUDENT_PHOTO_PUBLIC_DIR = path.join(process.cwd(), 'public', 'uploads', 'student-photos');

async function resolveStudentPhotoUrl(student_id: number) {
    if (!student_id) return null;
    const candidates = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `student-${student_id}.${ext}`);
    for (const filename of candidates) {
        try {
            await fs.access(path.join(STUDENT_PHOTO_PUBLIC_DIR, filename));
            return `${STUDENT_PHOTO_REL_DIR}/${filename}`;
        } catch { /* continue */ }
    }
    return null;
}

function normalizeAttendanceStatus(status: string | null | undefined) {
    const raw = String(status || '').trim().toLowerCase();

    if (raw === 'present' || raw.includes('มา')) return 'present';
    if (raw === 'absent' || raw.includes('ขาด')) return 'absent';
    if (raw === 'late' || raw.includes('สาย')) return 'late';
    if (raw === 'leave' || raw.includes('ลา')) return 'leave';
    return 'other';
}

export const StudentDashboardService = {
    async getSummary(student_id: number) {
        if (!student_id) {
            return {
                profile: null,
                currentTerm: null,
                stats: {
                    registeredSubjects: 0,
                    completedGrades: 0,
                    pendingGrades: 0,
                    gpa: 0,
                    attendanceRate: 0,
                    conductScore: 100,
                    upcomingActivities: 0,
                },
                attendance: { present: 0, absent: 0, late: 0, leave: 0, total: 0, rate: 0 },
                upcomingActivities: [],
                recentGrades: [],
            };
        }

        const [student, activeSemester] = await Promise.all([
            (prisma.students as any).findUnique({
                where: { id: student_id },
                include: {
                    name_prefixes: true,
                    classroom_students: {
                        include: {
                            classrooms: { include: { levels: true } },
                        },
                        orderBy: { academic_year: 'desc' },
                        take: 1
                    },
                },
            }),
            prisma.semesters.findFirst({
                where: { is_active: true },
                include: { academic_years: true },
                orderBy: { id: 'desc' },
            }),
        ]);

        if (!student) {
            throw new Error('Student not found');
        }

        const photo_url = await resolveStudentPhotoUrl(student.id);

        const enrollmentWhere: any = { student_id };
        if (activeSemester?.id) {
            const assignments = await (prisma.teaching_assignments as any).findMany({
                where: { semester_id: activeSemester.id },
                select: { id: true },
            });
            enrollmentWhere.teaching_assignment_id = {
                in: assignments.map((ta: any) => ta.id),
            };
        }

        const [enrollments, attendanceRecords, behaviorRaw, participations] = await Promise.all([
            (prisma.enrollments as any).findMany({
                where: enrollmentWhere,
                include: {
                    teaching_assignments: {
                        include: {
                            subjects: true,
                        },
                    },
                    final_grades: true,
                },
                orderBy: { id: 'desc' },
            }),
            (prisma.attendance_records as any).findMany({
                where: {
                    enrollments: enrollmentWhere,
                },
                select: {
                    status: true,
                },
            }),
            Promise.resolve([] as any[]),
            prisma.$queryRawUnsafe(`
                SELECT ep.*, e.title, e.start_datetime, e.location
                FROM event_participants ep
                JOIN events e ON ep.event_id = e.id
                WHERE ep.user_id = $1
            `, student.user_id),
        ]);

        const attendance = { present: 0, absent: 0, late: 0, leave: 0, total: attendanceRecords.length, rate: 0 };
        for (const record of attendanceRecords as any[]) {
            const key = normalizeAttendanceStatus(record.status);
            if (key === 'present') attendance.present += 1;
            if (key === 'absent') attendance.absent += 1;
            if (key === 'late') attendance.late += 1;
            if (key === 'leave') attendance.leave += 1;
        }
        attendance.rate = attendance.total > 0
            ? Math.round(((attendance.present + attendance.late) / attendance.total) * 1000) / 10
            : 0;

        let additions = 0;
        let deductions = 0;
        for (const record of behaviorRaw || []) {
            const points = record.points || 0;
            const type = String(record.type || '').toLowerCase();
            if (type === 'reward' || points > 0) additions += Math.abs(points);
            else deductions += Math.abs(points);
        }
        const conductScore = Math.max(0, 100 + additions - deductions);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, title, start_datetime, end_datetime, location
            FROM events
            WHERE start_datetime >= $1 AND visibility = 'public'
            ORDER BY start_datetime ASC
            LIMIT 5
        `, today);

        const upcomingActivities = upcomingEvents.map((e) => ({
            id: e.id,
            title: e.title,
            start_date: e.start_datetime,
            end_date: e.end_datetime,
            location: e.location || '',
            status: 'upcoming',
        }));

        const allGradeRows = (enrollments as any[])
            .filter((e: any) => e.teaching_assignments?.subjects)
            .map((e: any) => ({
                enrollment_id: e.id,
                subject_code: e.teaching_assignments.subjects.subject_code,
                subject_name: e.teaching_assignments.subjects.subject_name,
                total_score: e.final_grades ? Number(e.final_grades.total_score || 0) : null,
                letter_grade: e.final_grades?.letter_grade || null,
                grade_point: e.final_grades?.grade_point != null ? Number(e.final_grades.grade_point) : null,
            }))
            .sort((a: any, b: any) => a.subject_code.localeCompare(b.subject_code));

        const recentGrades = allGradeRows.slice(0, 6);

        const graded = allGradeRows.filter((g: any) => g.grade_point != null);
        const gpa = graded.length > 0
            ? Math.round((graded.reduce((sum: number, g: any) => sum + Number(g.grade_point || 0), 0) / graded.length) * 100) / 100
            : 0;

        const prefix = (student as any).name_prefixes?.prefix_name || '';
        const fullName = [prefix, (student as any).first_name, (student as any).last_name].filter(Boolean).join(' ').trim();
        const classLevel = (student as any).classroom_students?.[0]?.classrooms?.levels?.name || '';
        const room = (student as any).classroom_students?.[0]?.classrooms?.room_name || '';

        return {
            profile: {
                id: student.id,
                student_code: student.student_code,
                name: fullName || student.student_code,
                image_url: photo_url,
                class_level: classLevel,
                room,
            },
            currentTerm: activeSemester ? {
                semester: activeSemester.semester_number,
                year: activeSemester.academic_years?.year_name || '',
            } : null,
            stats: {
                registeredSubjects: enrollments.length,
                completedGrades: allGradeRows.filter((g: any) => g.letter_grade).length,
                pendingGrades: allGradeRows.filter((g: any) => !g.letter_grade).length,
                gpa,
                attendanceRate: attendance.rate,
                conductScore,
                upcomingActivities: upcomingActivities.length,
            },
            attendance,
            upcomingActivities,
            recentGrades,
        };
    },
};
