import { TeacherExamCalendarService } from '@/features/teacher/exam-calendar.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);

        const exams = await TeacherExamCalendarService.getExamSchedule(teacher_id);
        return successResponse(exams);
    } catch (error: any) {
        return errorResponse('Failed to load exam schedule', 500, error.message);
    }
}
