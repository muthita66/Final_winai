import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET() {
    try { return successResponse(await DirectorService.getStudentCount()); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
