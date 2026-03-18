import { prisma } from '@/lib/prisma';

export const TeacherCalendarService = {
    async getAll() {
        // Fetch events first
        const events = await (prisma.events as any).findMany({
            orderBy: { start_datetime: 'asc' }
        });

        // Manual join for responsible teacher to avoid "Unknown field" errors if Prisma client is out of sync
        const teacherIds = [...new Set(events.map((e: any) => e.teacher_id).filter((id: any) => id != null))];
        const teachers = await (prisma.teachers as any).findMany({
            where: { id: { in: teacherIds as number[] } },
            select: { id: true, first_name: true, last_name: true }
        });

        // Also fetch usernames for creators if needed
        const userIds = [...new Set(events.map((e: any) => e.created_by).filter((id: any) => id != null))];
        const users = await (prisma.users as any).findMany({
            where: { id: { in: userIds as number[] } },
            select: { id: true, username: true }
        });

        const teacherMap = Object.fromEntries(teachers.map((t: any) => [t.id, t]));
        const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

        return events.map((e: any) => {
            const teacher = teacherMap[e.teacher_id];
            const user = userMap[e.created_by];
            return {
                id: e.id,
                title: e.title,
                description: e.description || '',
                event_date: e.start_datetime, // keep this for compatibility
                start_datetime: e.start_datetime, // Add start_datetime so it works in UI
                end_date: e.end_datetime,
                location: e.location || '',
                responsible_teacher_id: e.teacher_id,
                responsible_teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
                created_by: user?.username || '',
            };
        });
    },

    async add(title: string, description: string, event_date: string, responsible_teacher_id?: number | null, userId?: number | null, location?: string | null, startTime?: string | null, endTime?: string | null) {
        const startDate = new Date(event_date);
        if (startTime) {
            const [hours, minutes] = startTime.split(':').map(Number);
            startDate.setHours(hours, minutes, 0);
        }

        const endDate = new Date(event_date);
        if (endTime) {
            const [hours, minutes] = endTime.split(':').map(Number);
            endDate.setHours(hours, minutes, 0);
        } else {
            endDate.setHours(23, 59, 59);
        }

        return (prisma.events as any).create({
            data: {
                title,
                description,
                start_datetime: startDate,
                end_datetime: endDate,
                visibility: 'public',
                is_all_day: !startTime && !endTime,
                location: location || null,
                created_by: userId ?? null,
                teacher_id: responsible_teacher_id ?? null,
            }
        });
    },

    async update(id: number, title: string, description: string, event_date: string, responsible_teacher_id?: number | null, location?: string | null, startTime?: string | null, endTime?: string | null) {
        const startDate = new Date(event_date);
        if (startTime) {
            const [hours, minutes] = startTime.split(':').map(Number);
            startDate.setHours(hours, minutes, 0);
        }

        const endDate = new Date(event_date);
        if (endTime) {
            const [hours, minutes] = endTime.split(':').map(Number);
            endDate.setHours(hours, minutes, 0);
        } else {
            endDate.setHours(23, 59, 59);
        }

        return (prisma.events as any).update({
            where: { id },
            data: {
                title,
                description,
                start_datetime: startDate,
                end_datetime: endDate,
                is_all_day: !startTime && !endTime,
                location: location || null,
                teacher_id: responsible_teacher_id ?? null,
            }
        });
    },

    async remove(id: number) {
        // Delete related records first
        await prisma.event_participants.deleteMany({ where: { event_id: id } });
        await prisma.event_targets.deleteMany({ where: { event_id: id } });
        await prisma.activity_evaluation_link.deleteMany({ where: { event_id: id } });
        return prisma.events.delete({ where: { id } });
    }
};
