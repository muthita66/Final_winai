import { TeacherEvaluationService } from '@/features/teacher/evaluation.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const mode = (searchParams.get('mode') || '').toLowerCase();
        const yearParam = searchParams.get('year');
        const semesterParam = searchParams.get('semester');
        const year = yearParam ? Number(yearParam) : undefined;
        const semester = semesterParam ? Number(semesterParam) : undefined;

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (yearParam && (year == null || Number.isNaN(year))) return errorResponse('year invalid', 400);
        if (semesterParam && (semester == null || Number.isNaN(semester))) return errorResponse('semester invalid', 400);

        const data = mode === 'student_results'
            ? await TeacherEvaluationService.getAdvisorStudentEvaluationResults(teacher_id, year, semester)
            : await TeacherEvaluationService.getAdvisorEvaluation(teacher_id, year, semester);
        return successResponse(data);
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}
