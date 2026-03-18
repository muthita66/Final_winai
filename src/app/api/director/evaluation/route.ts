import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const y = searchParams.get('year');
        const s = searchParams.get('semester');
        return successResponse(await DirectorService.getEvaluationSummary(y ? Number(y) : undefined, s ? Number(s) : undefined));
    } catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
