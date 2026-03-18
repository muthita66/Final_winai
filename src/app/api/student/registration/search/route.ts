import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseIntegerParam } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get('keyword');
        const yearParsed = parseIntegerParam(searchParams.get('year'));
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get('semester'));
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
        const year = yearParsed.value;
        const semester = semesterParsed.value;

        const class_level = searchParams.get('class_level') || undefined;
        const room = searchParams.get('room') || undefined;
        const classroomId = await RegistrationService.resolveClassroomId(class_level, room);

        if (!keyword) {
            return successResponse([], "No keyword provided");
        }

        const data = await RegistrationService.searchSubjects(keyword, year, semester, Number.isFinite(classroomId as number) ? classroomId : undefined);
        return successResponse(data, "Subjects retrieved");
    } catch (error: any) {
        return errorResponse("Failed to search", 500, error.message);
    }
}
