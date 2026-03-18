import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const positions = await DirectorService.getTeacherPositions();
        return successResponse(positions);
    } catch (error: any) {
        return errorResponse('Failed to fetch teacher positions', 500, error.message);
    }
}
