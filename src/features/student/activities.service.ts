import { prisma } from '@/lib/prisma';

export const ActivitiesService = {
    async getAllActivities() {
        const events = await prisma.events.findMany({
            orderBy: { start_datetime: 'desc' },
            include: {
                users: { select: { username: true } },
                event_participants: { select: { id: true } },
            }
        });

        return events.map(e => ({
            id: e.id,
            name: e.title, // Map title to name
            description: e.description || '',
            date: e.start_datetime ? e.start_datetime.toISOString().split('T')[0] : null, // Map start_datetime to date
            start_date: e.start_datetime,
            end_date: e.end_datetime,
            is_all_day: e.is_all_day || false,
            location: e.location || '',
            visibility: e.visibility,
            created_by: e.users?.username || '',
            participant_count: e.event_participants?.length || 0,
        }));
    },

    async getStudentActivities(student_id: number) {
        if (!student_id) return [];

        // Get user_id from student
        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });
        if (!student) return [];

        const participations = await prisma.event_participants.findMany({
            where: { user_id: student.user_id },
            include: {
                events: true
            },
            orderBy: { registered_at: 'desc' }
        });

        return participations.map(p => ({
            id: p.events.id,
            title: p.events.title,
            description: p.events.description || '',
            start_date: p.events.start_datetime,
            end_date: p.events.end_datetime,
            location: p.events.location || '',
            status: p.status || 'registered',
        }));
    }
};
