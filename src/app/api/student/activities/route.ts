import { ActivitiesService } from '@/features/student/activities.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const activities = await ActivitiesService.getAllActivities();
        return successResponse(activities, "Activities retrieved successfully");
    } catch (error: any) {
        return errorResponse("Failed to retrieve activities", 500, error.message);
    }
}
