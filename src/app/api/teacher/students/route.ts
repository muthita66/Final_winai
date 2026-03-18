import { TeacherStudentsService } from '@/features/teacher/students.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const yearParam = searchParams.get('year');
        const semesterParam = searchParams.get('semester');
        const year = yearParam ? Number(yearParam) : undefined;
        const semester = semesterParam ? Number(semesterParam) : undefined;

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (yearParam && (year == null || Number.isNaN(year))) return errorResponse('year invalid', 400);
        if (semesterParam && (semester == null || Number.isNaN(semester))) return errorResponse('semester invalid', 400);

        const students = await TeacherStudentsService.getAdvisoryStudents(teacher_id, year, semester);
        return successResponse(students);
    } catch (error: any) {
        return errorResponse('Failed to load students', 500, error.message);
    }
}
