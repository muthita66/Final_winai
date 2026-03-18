import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const levels = await DirectorService.getGradeLevels();
        return successResponse(levels);
    } catch (error: any) {
        return errorResponse('Failed to fetch grade levels', 500, error.message);
    }
}
