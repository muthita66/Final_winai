import { TeacherStudentsService } from '@/features/teacher/students.service';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const submitSchema = z.object({
    teacher_id: z.number().int().positive(),
    student_id: z.number().int().positive(),
    year: z.number().int().positive(),
    semester: z.number().int().positive(),
    data: z.array(z.object({
        name: z.string().trim().min(1),
        score: z.number().int().min(1).max(5),
    })),
    feedback: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const student_id = Number(searchParams.get('student_id') || searchParams.get('id'));
        const year = Number(searchParams.get('year'));
        const semester = Number(searchParams.get('semester'));

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (!student_id || Number.isNaN(student_id)) return errorResponse('student_id required', 400);
        if (!year || Number.isNaN(year)) return errorResponse('year required', 400);
        if (!semester || Number.isNaN(semester)) return errorResponse('semester required', 400);

        const data = await TeacherStudentsService.getAdvisorEvaluationTemplateForStudent(teacher_id, student_id, year, semester);
        return successResponse(data);
    } catch (error: any) {
        return errorResponse(error?.message || 'Failed to load advisor evaluation template', 500, error?.message);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse('Invalid payload format', 400, parsed.error.format());
        }

        const result = await TeacherStudentsService.submitAdvisorEvaluationForStudent(
            parsed.data.teacher_id,
            parsed.data.student_id,
            parsed.data.year,
            parsed.data.semester,
            parsed.data.data,
            parsed.data.feedback
        );

        return successResponse(result, 'Advisor evaluation saved');
    } catch (error: any) {
        return errorResponse(error?.message || 'Failed to save advisor evaluation', 500, error?.message);
    }
}
