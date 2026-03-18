import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: Request) {
    try {
        const data = await DirectorService.getTeachers();
        console.log(`API /api/teacher/teachers: fetched ${data?.length || 0} teachers`);
        // Return only necessary info for selection
        const simpleData = data.map(t => ({
            id: t.id,
            first_name: t.first_name,
            last_name: t.last_name
        }));
        return successResponse(simpleData);
    } catch (e: any) {
        return errorResponse('Failed to fetch teachers', 500, e.message);
    }
}
