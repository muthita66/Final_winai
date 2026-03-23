import { prisma } from '@/lib/prisma';

export const TeacherDashboardService = {
    async getSummary(id: number) {
        console.log(`[TeacherDashboardService] getSummary for id: ${id}`);
        // Resolve teacher_id from user_id if necessary
        let teacher_id = id;
        const teacherRecord = await prisma.teachers.findFirst({
            where: { OR: [{ id: id }, { user_id: id }] }
        });
        
        if (teacherRecord) {
            teacher_id = teacherRecord.id;
            console.log(`[TeacherDashboardService] Resolved teacher_id: ${teacher_id}`);
        } else {
            console.warn(`[TeacherDashboardService] No teacher record found for id: ${id}`);
        }

        // Count advisory students
        const advisorLinks = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true }
        });
        const advisoryClassroomIds = advisorLinks.map(a => a.classroom_id).filter(Boolean) as number[];
        const isAdvisor = advisoryClassroomIds.length > 0;

        const advisoryStudentCount = isAdvisor
            ? await prisma.students.count({
                where: { classroom_students: { some: { classroom_id: { in: advisoryClassroomIds } } } },
            })
            : 0;

        // Count all students taught by this teacher (from all their assigned classrooms)
        const assignments = await prisma.teaching_assignments.findMany({
            where: { teacher_id },
            select: { classroom_id: true }
        });
        const teachingClassroomIds = assignments.map(a => a.classroom_id).filter(Boolean) as number[];
        
        // Combined unique classroom IDs for the teacher
        const allRelevantClassroomIds = Array.from(new Set([...advisoryClassroomIds, ...teachingClassroomIds]));

        const totalStudentCount = allRelevantClassroomIds.length > 0
            ? await prisma.students.count({
                where: { classroom_students: { some: { classroom_id: { in: allRelevantClassroomIds } } } },
            })
            : 0;

        // Count teaching assignments (subjects)
        const subjectCount = await prisma.teaching_assignments.count({
            where: { teacher_id }
        });

        // Count assessment items (score items)
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

        const upcomingEventsCount = await prisma.events.count({
            where: { start_datetime: { gte: today } }
        });

        const recentEvents = await prisma.events.findMany({
            where: { start_datetime: { gte: today } },
            select: {
                id: true,
                title: true,
                start_datetime: true,
                location: true,
            },
            orderBy: { start_datetime: 'asc' },
            take: 5
        });

        return {
            students: totalStudentCount,
            advisoryStudents: advisoryStudentCount,
            isAdvisor: isAdvisor,
            subjects: subjectCount,
            scoreItems: assessmentCount,
            allEvents: await prisma.events.count().catch(() => 0),
            upcomingEvents: upcomingEventsCount,
            recentEvents: recentEvents.map(e => ({
                id: e.id,
                title: e.title,
                event_date: e.start_datetime,
                location: e.location || '',
            }))
        };
    }
};
