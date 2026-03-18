import { TeacherStudentsService } from '@/features/teacher/students.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const studentRaw = searchParams.get('student_id') || searchParams.get('id');
        const teacherRaw = searchParams.get('teacher_id');
        const student_id = Number(studentRaw);
        const teacher_id = Number(teacherRaw);
        if (!student_id || Number.isNaN(student_id)) return errorResponse('student_id required', 400);
        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);

        const profile = await TeacherStudentsService.getStudentProfileForTeacher(teacher_id, student_id);
        if (!profile) return errorResponse('Student not found in advisory list', 403);
        return successResponse(profile);
    } catch (error: any) {
        return errorResponse('Failed to load student profile', 500, error.message);
    }
}
