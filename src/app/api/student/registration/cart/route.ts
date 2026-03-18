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
        const semesterIdParsed = parseIntegerParam(searchParams.get('semester_id'));
        if (!semesterIdParsed.ok) return errorResponse("Invalid parameter: semester_id", 400, semesterIdParsed.error);
        const yearParsed = parseIntegerParam(searchParams.get('year'));
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get('semester'));
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);

        const hasExplicitTerm = yearParsed.value != null || semesterParsed.value != null;
        let semesterId = semesterIdParsed.value;
        if (!semesterId && yearParsed.value != null && semesterParsed.value != null) {
            semesterId = await RegistrationService.resolveSemesterId(yearParsed.value, semesterParsed.value);
        }
        if (hasExplicitTerm && yearParsed.value != null && semesterParsed.value != null && !semesterId) {
            return successResponse([], "Cart retrieved");
        }

        const data = await RegistrationService.getCart(student_id, semesterId ?? undefined);
        return successResponse(data, "Cart retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve cart", 500, error.message);
    }
}
