import { GradesService } from '@/features/student/grades.service';
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
        const yearParam = searchParams.get('year');
        const semesterParam = searchParams.get('semester');

        const yearParsed = parseIntegerParam(yearParam);
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(semesterParam);
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);

        const year = yearParsed.value;
        const semester = semesterParsed.value;

        const data = await GradesService.getGrades(student_id, year, semester);

        return successResponse(data, "Grades retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve grades", 500, error.message);
    }
}
