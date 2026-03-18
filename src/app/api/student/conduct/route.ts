import { ConductService } from '@/features/student/conduct.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'score') {
            const result = await ConductService.getScore(student_id);
            return successResponse(result, "Conduct score retrieved");
        }

        if (action === 'history') {
            const results = await ConductService.getHistory(student_id);
            return successResponse(results, "Conduct history retrieved");
        }

        return errorResponse("Invalid action parameter", 400);

    } catch (error: any) {
        return errorResponse("Failed to retrieve conduct data", 500, error.message);
    }
}
