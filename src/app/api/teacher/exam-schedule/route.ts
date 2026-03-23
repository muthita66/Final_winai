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
        if (!ta) return successResponse([]);

        const rows = await (prisma.exam_schedules as any).findMany({
            where: { 
                subject_id: ta.subject_id, 
                semester_id: ta.semester_id 
            },
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
        return errorResponse('Failed to fetch exam schedule', 500, error.message);
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
        if (!ta) return errorResponse('Section assignment not found', 404);

        // Standardize exam type to uppercase enum value
        const examTypeVal = (exam_type || 'MIDTERM').toUpperCase() as any;

        // Find existing schedule for this subject, semester, and type
        const existing = await (prisma.exam_schedules as any).findFirst({
            where: {
                subject_id: ta.subject_id,
                semester_id: ta.semester_id,
                exam_type: examTypeVal
            }
        });

        // Parse date and time correctly
        // exam_date is "YYYY-MM-DD"
        const examDateObj = new Date(exam_date);
        
        // start_time and end_time are "HH:mm"
        // For Postgres TIME fields, Prisma expects a Date object where the time part is used
        const startTimeObj = new Date(`1970-01-01T${start_time}:00Z`);
        const endTimeObj = new Date(`1970-01-01T${end_time}:00Z`);

        let result;
        if (existing) {
            result = await (prisma.exam_schedules as any).update({
                where: { id: existing.id },
                data: {
                    exam_date: examDateObj,
                    start_time: startTimeObj,
                    end_time: endTimeObj
                }
            });
        } else {
            result = await (prisma.exam_schedules as any).create({
                data: {
                    semester_id: ta.semester_id,
                    subject_id: ta.subject_id,
                    exam_type: examTypeVal,
                    exam_date: examDateObj,
                    start_time: startTimeObj,
                    end_time: endTimeObj
                }
            });
        }

        return successResponse({ id: result.id }, existing ? 'Exam schedule updated' : 'Exam schedule created');
    } catch (error: any) {
        console.error('Save exam error:', error);
        return errorResponse('Failed to save exam schedule', 500, error.message);
    }
}
