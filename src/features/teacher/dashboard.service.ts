import { prisma } from '@/lib/prisma';

export const TeacherDashboardService = {
    async getSummary(teacher_id: number) {
        // Count advisory students from classroom_advisors (to match /teacher/students)
        const advisorLinks = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true },
            distinct: ['classroom_id'],
        });
        const advisoryClassroomIds = advisorLinks
            .map((a) => a.classroom_id)
            .filter((id): id is number => id != null);

        const advisoryStudentCount = advisoryClassroomIds.length > 0
            ? await prisma.students.count({
                where: { classroom_students: { some: { classroom_id: { in: advisoryClassroomIds } } } },
            })
            : 0;

        // Count teaching assignments (subjects)
        const subjectCount = await prisma.teaching_assignments.count({
            where: { teacher_id }
        });

        // Count assessment items across teacher's assignments
        const assessmentCount = await prisma.assessment_items.count({
            where: {
                grade_categories: {
                    teaching_assignments: { teacher_id }
                }
            }
        });

        // Get upcoming events
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents = await prisma.events.findMany({
            where: {
                start_datetime: { gte: today }
            },
            orderBy: { start_datetime: 'asc' },
            take: 5
        });

        const totalEvents = await prisma.events.count();

        return {
            students: advisoryStudentCount,
            subjects: subjectCount,
            scoreItems: assessmentCount,
            allEvents: totalEvents,
            upcomingEvents: upcomingEvents.length,
            recentEvents: upcomingEvents.map(e => ({
                id: e.id,
                title: e.title,
                date: e.start_datetime,
                event_date: e.start_datetime,
                location: e.location || '',
            }))
        };
    }
};
