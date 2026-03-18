import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseIntegerParam } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);

        const explicitClassroomId = searchParams.get('classroom_id');
        const class_level = searchParams.get('class_level') || undefined;
        const room = searchParams.get('room') || undefined;
        const classroomId = explicitClassroomId
            ? Number(explicitClassroomId)
            : await RegistrationService.resolveClassroomId(class_level, room);

        const data = await RegistrationService.browseSubjects(yearParsed.value!, semesterParsed.value!, Number.isFinite(classroomId as number) ? classroomId : undefined);
        return successResponse(data, "Browse subjects retrieved");
    } catch (error: any) {
        return errorResponse("Failed to browse", 500, error.message);
    }
}
