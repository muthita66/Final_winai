import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const session = await getSession() as any;
        if (!session || session.role !== 'teacher') return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const teacher_id = searchParams.get('teacher_id') ? Number(searchParams.get('teacher_id')) : null;

        // Find teacher record linked to this user
        const teacher = await prisma.teachers.findFirst({
            where: teacher_id ? { id: teacher_id } : { user_id: session.id },
        });

        if (!teacher) return errorResponse('Teacher not found', 404);

        // Get all active teaching assignments with their schedules
        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                teacher_id: teacher.id,
            },
            include: {
                subjects: {
                    include: {
                        subject_categories: true,
                    }
                },
                classrooms: {
                    include: {
                        levels: true,
                    }
                },
                semesters: {
                    include: {
                        academic_years: true,
                    }
                },
                class_schedules: {
                    include: {
                        day_of_weeks: true,
                        periods: true,
                        rooms: true,
                    }
                },
            },
            orderBy: { id: 'asc' },
        });

        // Flatten into schedule slots
        const slots: any[] = [];
        for (const assign of assignments) {
            for (const sched of assign.class_schedules) {
                slots.push({
                    assignment_id: assign.id,
                    subject_code: assign.subjects.subject_code,
                    subject_name: assign.subjects.subject_name,
                    credit: assign.subjects.credit,
                    class_level: assign.classrooms?.levels?.name ?? '-',
                    classroom: assign.classrooms?.room_name ?? '-',
                    day_id: sched.day_id,
                    day_name: sched.day_of_weeks?.day_name_th ?? '-',
                    day_short: sched.day_of_weeks?.short_name ?? '-',
                    day_color: sched.day_of_weeks?.color_code ?? null,
                    period_id: sched.period_id,
                    period_name: sched.periods?.period_name ?? '-',
                    start_time: sched.periods?.start_time
                        ? new Date(sched.periods.start_time).toISOString().substring(11, 16)
                        : '-',
                    end_time: sched.periods?.end_time
                        ? new Date(sched.periods.end_time).toISOString().substring(11, 16)
                        : '-',
                    room: sched.rooms?.room_name ?? '-',
                    subject_type: assign.subjects.subject_categories?.category_name ?? '-',
                    semester: assign.semesters?.semester_number,
                    academic_year: assign.semesters?.academic_years?.year_name ?? '-',
                });
            }
        }

        // Sort by day_id then period_id
        slots.sort((a, b) => (a.day_id ?? 99) - (b.day_id ?? 99) || (a.period_id ?? 99) - (b.period_id ?? 99));

        // Get all periods for the master list
        const allPeriods = await prisma.periods.findMany({
            orderBy: { id: 'asc' }
        });

        const periodsData = allPeriods.map(p => ({
            period_id: p.id,
            period_name: p.period_name ?? `คาบที่ ${p.id}`,
            start_time: p.start_time ? new Date(p.start_time).toISOString().substring(11, 16) : '-',
            end_time: p.end_time ? new Date(p.end_time).toISOString().substring(11, 16) : '-',
        }));

        return successResponse({
            slots,
            periods: periodsData
        });
    } catch (error: any) {
        return errorResponse('Failed to load teaching schedule', 500, error.message);
    }
}
