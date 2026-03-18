import { RegistrationService } from '@/features/student/registration.service';
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
        if (searchParams.has('year') !== searchParams.has('semester')) {
            return errorResponse("Parameters year and semester must be provided together", 400);
        }
        const yearParsed = parseIntegerParam(searchParams.get('year'));
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get('semester'));
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
        const year = yearParsed.value;
        const semester = semesterParsed.value;

        const advisors = await RegistrationService.getAdvisor(student_id, year, semester);

        // Return `{ advisors: [...] }` to match frontend expectations
        return successResponse({ advisors }, "Advisors retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve advisors", 500, error.message);
    }
}
