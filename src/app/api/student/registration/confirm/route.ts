import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';
import { z } from 'zod';

const confirmSchema = z.object({
    year: z.number().int().positive().optional(),
    semester: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const body = await request.json().catch(() => ({}));
        const parsed = confirmSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const { year, semester } = parsed.data;
        const semesterId = (year != null && semester != null)
            ? await RegistrationService.resolveSemesterId(year, semester)
            : undefined;
        if (year != null && semester != null && !semesterId) {
            return errorResponse("ไม่พบภาคเรียนที่เลือก", 400);
        }

        const data = await RegistrationService.confirmCart(student_id, semesterId);
        return successResponse(data, "Confirmed cart successfully");
    } catch (error: any) {
        return errorResponse("Failed to confirm cart", 500, error.message);
    }
}
