import { prisma } from '@/lib/prisma';

/**
 * Exam calendar service — stubbed because presentATOM has no exam_schedule table.
 */
export const TeacherExamCalendarService = {
    async getExamSchedule(teacher_id: number) {
        // No exam_schedule table in presentATOM — return empty
        return [];
    }
};
