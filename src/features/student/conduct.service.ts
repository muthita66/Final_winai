import { prisma } from '@/lib/prisma';

export const ConductService = {
    async getScore(student_id: number) {
        if (!student_id) return { score: 0, additions: 0, deductions: 0 };

        const behaviorRecords = await prisma.behavior_records.findMany({
            where: {
                student_id: student_id,
                status: 'APPROVED'
            }
        });

        let additions = 0;
        let deductions = 0;

        behaviorRecords.forEach(r => {
            const points = r.points_awarded || 0;
            if (points > 0) {
                additions += Math.abs(points);
            } else {
                deductions += Math.abs(points);
            }
        });

        // Base score of 100 + rewards - deductions
        const score = 100 + additions - deductions;

        return { score, additions, deductions };
    },

    async getHistory(student_id: number) {
        if (!student_id) return [];
        
        // 1. Fetch records
        const records = await prisma.behavior_records.findMany({
            where: {
                student_id: student_id,
                status: 'APPROVED'
            },
            include: {
                behavior_types: true
            },
            orderBy: {
                incident_date: 'desc'
            }
        });

        // 2. Extract unique user IDs
        const userIdsArr = records.map(r => r.reporter_user_id).concat(records.map(r => r.approved_by_user_id));
        const userIds = Array.from(new Set(userIdsArr.filter((id): id is number => id !== null)));

        // 3. Fetch users with their profiles
        const users = userIds.length > 0 ? await prisma.users.findMany({
            where: { id: { in: userIds } },
            include: {
                teachers: { include: { name_prefixes: true } },
                students: { include: { name_prefixes: true } }
            }
        }) : [];

        // 4. Create a map for lookup
        const userMap = new Map(users.map(u => [u.id, u]));

        const formatName = (user: any) => {
            if (!user) return null;
            if (user.teachers) {
                const t = user.teachers;
                return `${t.name_prefixes?.prefix_name || ''}${t.first_name} ${t.last_name}`.trim();
            }
            if (user.students) {
                const s = user.students;
                return `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`.trim();
            }
            return user.username;
        };

        return records.map(r => ({
            id: r.id,
            log_date: r.incident_date,
            event: r.behavior_types?.name || 'ปรับคะแนนพฤติกรรม',
            is_positive: r.behavior_types?.is_positive ?? (r.points_awarded > 0),
            point: r.points_awarded || 0,
            note: r.note || '',
            status: r.status || '',
            reporter_name: r.reporter_user_id ? (formatName(userMap.get(r.reporter_user_id)) || `UID: ${r.reporter_user_id}`) : null,
            approver_name: r.approved_by_user_id ? (formatName(userMap.get(r.approved_by_user_id)) || `UID: ${r.approved_by_user_id}`) : null,
        }));
    }
};
