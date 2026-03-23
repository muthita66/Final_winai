import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const y = searchParams.get('year');
        const s = searchParams.get('semester');
        const type = searchParams.get('type') || 'teaching';

        if (searchParams.has('type')) {
            return successResponse(await DirectorService.getDetailedEvaluationResults(
                y ? Number(y) : undefined, 
                s ? Number(s) : undefined,
                type as any
            ));
        }

        return successResponse(await DirectorService.getEvaluationSummary(
            y ? Number(y) : undefined, 
            s ? Number(s) : undefined
        ));
    } catch (e: any) { 
        console.error('Evaluation API Error:', e);
        return errorResponse('Failed', 500, e.message); 
    }
}
