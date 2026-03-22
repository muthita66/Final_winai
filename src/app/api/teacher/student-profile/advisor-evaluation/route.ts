import { NextRequest, NextResponse } from 'next/server';
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
        score: z.number().int().min(0).max(10),
    })),
    feedback: z.string().optional().nullable(),
    sub_mode: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = parseInt(searchParams.get('teacher_id') || '0');
        const student_id = parseInt(searchParams.get('student_id') || '0');
        const year = parseInt(searchParams.get('year') || '0');
        const semester = parseInt(searchParams.get('semester') || '0');
        const sub_mode = searchParams.get('sub_mode') || 'attributes';

        if (!teacher_id || !student_id || !year || !semester) {
            return errorResponse('Missing required parameters', 400);
        }

        const data = await TeacherStudentsService.getAdvisorEvaluationTemplateForStudent(teacher_id, student_id, year, semester, sub_mode);
        return successResponse(data);
    } catch (error: any) {
        console.error('[AdvisorEvaluation API GET] Error full details:', {
            message: error?.message,
            stack: error?.stack,
            error
        });
        return errorResponse(error?.message || 'Failed to load advisor evaluation template', 500, error?.message);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse('Invalid payload format', 400, parsed.error.format());
        }

        const result = await TeacherStudentsService.submitAdvisorEvaluationForStudent({
            teacher_id: parsed.data.teacher_id,
            student_id: parsed.data.student_id,
            year: parsed.data.year,
            semester: parsed.data.semester,
            data: parsed.data.data,
            feedback: parsed.data.feedback || undefined,
            sub_mode: parsed.data.sub_mode
        });

        return successResponse(result);
    } catch (error: any) {
        console.error('[AdvisorEvaluation API POST] Error:', error);
        return errorResponse(error?.message || 'Failed to submit advisor evaluation', 500, error?.message);
    }
}
