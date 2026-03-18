import { ActorsService } from '@/features/director/actors.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');

        if (name) {
            // Return data for a specific actor
            const result = await ActorsService.getActorData(name);
            return successResponse(result);
        }

        // Return list of all actors with counts
        const actors = await ActorsService.getAllActors();
        return successResponse(actors);
    } catch (e: any) {
        return errorResponse(e.message || 'Failed to fetch actors', 500, e.message);
    }
}
