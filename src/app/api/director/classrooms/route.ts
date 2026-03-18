import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const rooms = await DirectorService.getClassrooms();
        return successResponse(rooms);
    } catch (error: any) {
        return errorResponse('Failed to fetch classrooms', 500, error.message);
    }
}
