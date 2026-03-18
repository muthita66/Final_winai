import { ProfileService } from '@/features/student/profile.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

const updateProfileSchema = z.object({
    prefix: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    birthday: z.string().optional(),
    date_of_birth: z.string().optional(),
    nickname: z.string().optional(),
    phone: z.string().optional(),
    parent_phone: z.string().optional(),
    address: z.string().optional(),
    blood_type: z.string().optional(),
    dormitory: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const profile = await ProfileService.getProfile(student_id);

        if (!profile) {
            return errorResponse("Profile not found", 404);
        }

        return successResponse(profile, "Profile retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve profile", 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const body = await request.json();

        // Validate with Zod
        const parsed = updateProfileSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const updatedProfile = await ProfileService.updateProfile(student_id, parsed.data);

        return successResponse(updatedProfile, "Profile updated successfully");
    } catch (error: any) {
        return errorResponse("Failed to update profile", 500, error.message);
    }
}
