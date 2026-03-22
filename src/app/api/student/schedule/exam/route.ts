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
        const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
        const year = yearParsed.value!;
        const semester = semesterParsed.value!;

        const data = await ScheduleService.getExamSchedule(student_id, year, semester);

        return successResponse(data, "Exam schedule retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve exam schedule", 500, error.message);
    }
}
