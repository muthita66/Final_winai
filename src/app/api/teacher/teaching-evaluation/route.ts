import { TeacherEvaluationService } from '@/features/teacher/evaluation.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const teacher_id = Number(searchParams.get('teacher_id'));
        const yearParam = searchParams.get('year');
        const semesterParam = searchParams.get('semester');
        const year = yearParam ? Number(yearParam) : undefined;
        const semester = semesterParam ? Number(semesterParam) : undefined;

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);

        if (action === 'results') {
            const section_id = searchParams.get('section_id') ? Number(searchParams.get('section_id')) : undefined;
            const data = await TeacherEvaluationService.getTeachingEvaluationResults(teacher_id, section_id, year, semester);
            return successResponse(data);
        }

        if (action === 'students') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id) return errorResponse('section_id required', 400);
            const data = await TeacherEvaluationService.getSectionStudentsForEvaluation(teacher_id, section_id, year || 0, semester || 0);
            return successResponse(data);
        }

        if (action === 'template') {
            const student_id = Number(searchParams.get('student_id'));
            const section_id = Number(searchParams.get('section_id'));
            if (!student_id || !section_id) return errorResponse('IDs required', 400);
            const data = await TeacherEvaluationService.getSubjectEvaluationTemplate(teacher_id, student_id, section_id, year || 0, semester || 0);
            return successResponse(data);
        }

        const data = await TeacherEvaluationService.getTeachingEvaluation(teacher_id, year, semester);
        return successResponse(data);
    } catch (error: any) {
        console.error("[API Teaching Evaluation GET] Error:", error);
        return errorResponse(error.message || 'Failed', 500, {
            stack: error.stack,
            cause: error.cause,
            ...error
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = await TeacherEvaluationService.submitSubjectEvaluation(body);
        return successResponse(data);
    } catch (error: any) {
        console.error("[API Teaching Evaluation POST] Error:", error);
        return errorResponse(error.message || 'Failed to submit evaluation', 500);
    }
}
