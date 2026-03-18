import { StudentDashboardService } from '@/features/student/dashboard.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

export async function GET() {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;

        const data = await StudentDashboardService.getSummary(sessionResult.studentId);
        return successResponse(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResponse('Failed to load student dashboard', 500, message);
    }
}
