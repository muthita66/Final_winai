import { prisma } from '@/lib/prisma';

export const ConductService = {
    async getScore(student_id: number) {
        if (!student_id) return { score: 0, additions: 0, deductions: 0 };

        const records: any[] = [];

        let additions = 0;
        let deductions = 0;

        records.forEach(r => {
            const points = r.points || 0;
            const type = String(r.type || '').toLowerCase();
            if (type === 'reward' || points > 0) {
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
        const records: any[] = [];

        return records.map(r => ({
            id: r.id,
            date: r.incident_date,
            time: r.incident_time,
            rule_code: r.rule_code || '',
            rule_name: r.rule_name || '',
            category: r.category || '',
            type: r.type || '',
            points: r.points || 0,
            location: r.location || '',
            remark: r.remark || '',
            status: r.status || '',
            reported_by: r.reported_by || '',
        }));
    }
};
