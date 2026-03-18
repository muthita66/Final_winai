import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const years = await DirectorService.getAcademicYears();
        return successResponse(years);
    } catch (e: any) {
        return errorResponse('Failed to fetch academic years', 500, e.message);
    }
}
