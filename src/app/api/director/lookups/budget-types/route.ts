import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        return successResponse(await DirectorService.getBudgetTypes());
    } catch (e: any) {
        return errorResponse('Failed to fetch budget types', 500, e.message);
    }
}
