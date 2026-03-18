import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        return successResponse(await DirectorService.getDepartments());
    } catch (e: any) {
        return errorResponse('Failed to fetch departments', 500, e.message);
    }
}
