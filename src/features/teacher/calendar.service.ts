import { prisma } from '@/lib/prisma';

export const TeacherCalendarService = {
    async getAll() {
        try {
            // Using queryRawUnsafe for robust date/time strings (matches DirectorService logic)
            const rows = await prisma.$queryRawUnsafe(`
                SELECT e.*,
                    TO_CHAR(e.start_datetime, 'YYYY-MM-DD') as start_date_str,
                    TO_CHAR(e.start_datetime, 'HH24:MI') as start_time_str,
                    TO_CHAR(e.end_datetime, 'YYYY-MM-DD') as end_date_str,
                    TO_CHAR(e.end_datetime, 'HH24:MI') as end_time_str,
                    json_agg(et.*) FILTER (WHERE et.id IS NOT NULL) as targets
                FROM events e
                LEFT JOIN event_targets et ON e.id = et.event_id
                GROUP BY e.id
                ORDER BY e.start_datetime ASC
            `);

            if (!rows || (rows as any).length === 0) return [];

            // Fetch lookup data manually for consistency
            const teacherIds = [...new Set((rows as any[]).map((e: any) => e.teacher_id).filter((id: any) => id != null))];
            const deptIds = [...new Set((rows as any[]).map((e: any) => e.department_id).filter((id: any) => id != null))];
            const typeIds = [...new Set((rows as any[]).map((e: any) => e.event_type_id).filter((id: any) => id != null))];
            const userIds = [...new Set((rows as any[]).map((e: any) => e.created_by).filter((id: any) => id != null))];

            const [teachers, departments, eventTypes, users] = await Promise.all([
                prisma.teachers.findMany({
                    where: { id: { in: teacherIds as number[] } },
                    select: { id: true, first_name: true, last_name: true, name_prefixes: { select: { prefix_name: true } } }
                }),
                prisma.departments.findMany({
                    where: { id: { in: deptIds as number[] } },
                    select: { id: true, department_name: true }
                }),
                prisma.event_types.findMany({
                    where: { id: { in: typeIds as number[] } },
                    select: { id: true, name: true }
                }),
                prisma.users.findMany({
                    where: { id: { in: userIds as number[] } },
                    select: { id: true, username: true }
                })
            ]);

            const tMap = new Map((teachers as any[]).map(t => [t.id, t]));
            const dMap = new Map((departments as any[]).map(d => [d.id, d.department_name]));
            const etMap = new Map((eventTypes as any[]).map(et => [et.id, et.name]));
            const uMap = new Map((users as any[]).map(u => [u.id, u.username]));

            const allTargets = (rows as any[]).flatMap(r => r.targets || []);
            const { resolveTargetValues, formatTargetValue } = await import('@/lib/target-resolver');
            const targetDict = await resolveTargetValues(allTargets);

            return (rows as any[]).map((r: any) => {
                const teacher = tMap.get(r.teacher_id);
                const deptName = dMap.get(r.department_id) || '';
                const typeName = etMap.get(r.event_type_id) || '';
                const creatorName = uMap.get(r.created_by) || '';

                return {
                    id: r.id,
                    title: r.title,
                    description: r.description || '',
                    event_date: r.start_date_str, 
                    start_date: r.start_date_str,
                    start_time: r.start_time_str,
                    end_date: r.end_date_str,
                    end_time: r.end_time_str,
                    location: r.location || '',
                    visibility: r.visibility || 'public',
                    responsible_teacher_id: r.teacher_id,
                    responsible_teacher_name: teacher ? `${teacher.name_prefixes?.prefix_name || ''}${teacher.first_name} ${teacher.last_name || ''}` : '',
                    department_id: r.department_id,
                    department_name: deptName,
                    event_type_id: r.event_type_id,
                    event_type_name: typeName,
                    created_by: creatorName,
                    semester_id: r.semester_id,
                    targets: (r.targets || []).map((t: any) => ({
                        ...t,
                        target_value: formatTargetValue(t.target_type, t.target_value, targetDict)
                    }))
                };
            });
        } catch (error: any) {
            console.error('Error in TeacherCalendarService.getAll:', error);
            return [];
        }
    },

    async add(data: {
        title: string;
        description?: string;
        event_date: string;
        start_time?: string;
        end_date?: string;
        end_time?: string;
        responsible_teacher_id?: number | null;
        location?: string | null;
        visibility?: string;
        userId?: number | null;
        department_id?: number | null;
        event_type_id?: number | null;
        semester_id?: number | null;
        targets?: { target_type: string; target_value?: string | null }[];
    }) {
        const startStr = `${data.event_date} ${data.start_time || '00:00'}:00`;
        const endStr = `${data.end_date || data.event_date} ${data.end_time || (data.start_time ? data.start_time : '23:59')}:00`;

        const res = await prisma.$queryRawUnsafe(`
            INSERT INTO events (
                title, description, start_datetime, end_datetime, 
                location, visibility, created_by,
                teacher_id, department_id, event_type_id, is_all_day,
                semester_id
            ) VALUES (
                $1, $2, $3::timestamp, $4::timestamp, 
                $5, $6, $7, $8, 
                $9, $10, $11, $12
            ) RETURNING id
        `, 
            data.title, 
            data.description || null, 
            startStr, 
            endStr, 
            data.location || null, 
            data.visibility || 'public', 
            data.userId || null,
            data.responsible_teacher_id || null, 
            data.department_id || null, 
            data.event_type_id || null,
            !data.start_time && !data.end_time,
            data.semester_id ? Number(data.semester_id) : null
        );
        
        const eventId = (res as any)[0].id;
        
        // Handle targets (participation scope)
        if (data.targets && Array.isArray(data.targets)) {
            for (const t of data.targets) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO event_targets (event_id, target_type, target_value) VALUES ($1, $2, $3)`,
                    eventId, t.target_type, t.target_value || null
                );
            }
        }

        return (res as any)[0];
    },

    async update(id: number, data: {
        title?: string;
        description?: string;
        event_date?: string;
        start_time?: string;
        end_date?: string;
        end_time?: string;
        responsible_teacher_id?: number | null;
        location?: string | null;
        visibility?: string;
        department_id?: number | null;
        event_type_id?: number | null;
        semester_id?: number | null;
        targets?: { target_type: string; target_value?: string | null }[];
    }) {
        const current = await (prisma.events as any).findUnique({ where: { id } });
        if (!current) throw new Error('Event not found');

        const startDate = data.event_date || new Date(current.start_datetime).toISOString().split('T')[0];
        const startTime = data.start_time || new Date(current.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const startStr = `${startDate} ${startTime}:00`;

        const endDate = data.end_date || new Date(current.end_datetime).toISOString().split('T')[0];
        const endTime = data.end_time || new Date(current.end_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const endStr = `${endDate} ${endTime}:00`;

        await (prisma.events as any).update({
            where: { id },
            data: {
                title: data.title !== undefined ? data.title : current.title,
                description: data.description !== undefined ? data.description : current.description,
                start_datetime: new Date(startStr),
                end_datetime: new Date(endStr),
                is_all_day: !data.start_time && !data.end_time && current.is_all_day,
                location: data.location !== undefined ? data.location : current.location,
                visibility: data.visibility !== undefined ? data.visibility : current.visibility,
                teacher_id: data.responsible_teacher_id !== undefined ? data.responsible_teacher_id : current.teacher_id,
                department_id: data.department_id !== undefined ? data.department_id : current.department_id,
                event_type_id: data.event_type_id !== undefined ? data.event_type_id : current.event_type_id,
                semester_id: data.semester_id !== undefined ? (data.semester_id ? Number(data.semester_id) : null) : current.semester_id,
            }
        });

        // Update targets
        if (data.targets !== undefined && Array.isArray(data.targets)) {
            await prisma.$executeRawUnsafe(`DELETE FROM event_targets WHERE event_id = $1`, id);
            for (const t of data.targets) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO event_targets (event_id, target_type, target_value) VALUES ($1, $2, $3)`,
                    id, t.target_type, t.target_value || null
                );
            }
        }

        return { id, ...data };
    },

    async remove(id: number) {
        // Delete related records first
        await prisma.event_participants.deleteMany({ where: { event_id: id } });
        await prisma.event_targets.deleteMany({ where: { event_id: id } });
        await (prisma as any).activity_evaluation_link.deleteMany({ where: { event_id: id } });
        return prisma.events.delete({ where: { id } });
    },

    async getDepartments() {
        return prisma.departments.findMany({
            orderBy: { department_name: 'asc' },
            select: { id: true, department_name: true }
        });
    },

    async getEventTypes() {
        return prisma.event_types.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        });
    },

    async getTargetTypes() {
        return prisma.target_types.findMany({
            where: { is_active: true },
            orderBy: { display_name: 'asc' }
        });
    }
};
