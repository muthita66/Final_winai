import { TeacherAttendanceService } from '@/features/teacher/attendance.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const section_id = Number(searchParams.get('section_id'));
        const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);

        const data = await TeacherAttendanceService.getAttendanceList(teacher_id, section_id, date);
        return successResponse(data);
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const { records } = await request.json();
        if (!Array.isArray(records)) return errorResponse('records required', 400);
        const data = await TeacherAttendanceService.saveAttendance(records);
        return successResponse(data);
    } catch (error: any) {
        return errorResponse('Failed to save attendance', 500, error.message);
    }
}
