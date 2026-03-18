import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

const addSchema = z.object({
    teaching_assignment_id: z.number().int().positive().optional(),
    section_id: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const body = await request.json();
        const parsed = addSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const teaching_assignment_id = parsed.data.teaching_assignment_id ?? parsed.data.section_id;
        if (!teaching_assignment_id) {
            return errorResponse("teaching_assignment_id or section_id is required", 400);
        }
        const data = await RegistrationService.addToCart(student_id, teaching_assignment_id);
        return successResponse(data, "Added to cart successfully");
    } catch (error: any) {
        return errorResponse(error.message || "Failed to enroll", 500, error.message);
    }
}
