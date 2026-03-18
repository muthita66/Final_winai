import { ScheduleService } from '@/features/student/schedule.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseIntegerParam, parseStudentIdFromSession } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const { searchParams } = new URL(request.url);
        const yearParsed = parseIntegerParam(searchParams.get('year'));
        const semesterParsed = parseIntegerParam(searchParams.get('semester'));

        const year = yearParsed.ok ? yearParsed.value : undefined;
        const semester = semesterParsed.ok ? semesterParsed.value : undefined;

        const data = await ScheduleService.getClassSchedule(student_id, year ?? undefined, semester ?? undefined);

        return successResponse(data, "Class schedule retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve class schedule", 500, error.message);
    }
}
