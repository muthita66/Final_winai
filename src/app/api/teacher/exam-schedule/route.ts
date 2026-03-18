import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/teacher/exam-schedule?section_id=XX
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const section_id = Number(searchParams.get('section_id'));
        if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);

        const ta = await prisma.teaching_assignments.findUnique({
            where: { id: section_id },
            select: { subject_id: true, semester_id: true }
        });
        if (!ta) return successResponse(null);

        const rows = await (prisma.exam_schedules as any).findMany({
            where: { subject_id: ta.subject_id, semester_id: ta.semester_id },
            orderBy: [{ exam_date: 'asc' }]
        });

        return successResponse(rows.map((r: any) => ({
            id: r.id,
            exam_type: r.exam_type,
            exam_date: r.exam_date,
            start_time: r.start_time,
            end_time: r.end_time,
        })));
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

// POST /api/teacher/exam-schedule
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { section_id, exam_type, exam_date, start_time, end_time } = body;

        if (!section_id) return errorResponse('section_id required', 400);
        if (!exam_date) return errorResponse('exam_date required', 400);
        if (!start_time || !end_time) return errorResponse('start_time and end_time required', 400);

        const ta = await prisma.teaching_assignments.findUnique({
            where: { id: Number(section_id) },
            select: { subject_id: true, semester_id: true }
        });
        if (!ta) return errorResponse('Section not found', 404);

        const examTypeVal = exam_type || 'midterm';

        // Try to upsert: find existing by subject+semester+type, then update or create
        const existing: any[] = await prisma.$queryRawUnsafe(
            `SELECT id FROM exam_schedules WHERE subject_id = $1 AND semester_id = $2 AND exam_type = $3 LIMIT 1`,
            ta.subject_id, ta.semester_id, examTypeVal
        );

        const examDateObj = new Date(exam_date);
        const startTimeObj = new Date(`1970-01-01T${start_time}:00`);
        const endTimeObj = new Date(`1970-01-01T${end_time}:00`);

        if (existing.length > 0) {
            await prisma.$executeRawUnsafe(
                `UPDATE exam_schedules SET exam_date = $1, start_time = $2, end_time = $3 WHERE id = $4`,
                examDateObj, startTimeObj, endTimeObj, existing[0].id
            );
            return successResponse({ id: existing[0].id });
        } else {
            const result: any[] = await prisma.$queryRawUnsafe(
                `INSERT INTO exam_schedules (semester_id, subject_id, exam_type, exam_date, start_time, end_time)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                ta.semester_id, ta.subject_id, examTypeVal, examDateObj, startTimeObj, endTimeObj
            );
            return successResponse({ id: result[0].id });
        }
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}
