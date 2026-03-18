import { DirectorDashboardService } from '@/features/director/dashboard.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        if (action === 'filters') {
            return successResponse(await DirectorDashboardService.getFilterOptions());
        }

        const filters: any = {};
        if (searchParams.get('gender')) filters.gender = searchParams.get('gender');
        if (searchParams.get('class_level')) filters.class_level = searchParams.get('class_level');
        if (searchParams.get('room')) filters.room = searchParams.get('room');
        if (searchParams.get('subject_id')) filters.subject_id = Number(searchParams.get('subject_id'));

        const data = await DirectorDashboardService.getFullDashboard(filters);
        return successResponse(data);
    } catch (e: any) {
        console.error('Director dashboard error:', e);
        return errorResponse('Failed to load dashboard', 500, e.message);
    }
}
