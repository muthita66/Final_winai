import { ActivitiesService } from '@/features/student/activities.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return errorResponse("Unauthorized", 401);
        }

        const { searchParams } = new URL(req.url);
        const year = Number(searchParams.get('year'));
        const semester = Number(searchParams.get('semester'));

        if (!year || !semester) {
            return errorResponse("Missing year or semester", 400);
        }

        const evaluations = await ActivitiesService.getStudentActivityEvaluations(Number(session.id), year, semester);
        return successResponse(evaluations, "Activity evaluations retrieved successfully");
    } catch (error: any) {
        return errorResponse("Failed to retrieve activity evaluations", 500, error.message);
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return errorResponse("Unauthorized", 401);
        }

        const body = await req.json();
        const { activity_id, year, semester, data, feedback } = body;

        if (!activity_id || !year || !semester || !data) {
            return errorResponse("Missing required fields", 400);
        }

        const result = await ActivitiesService.submitActivityEvaluation(
            Number(session.id),
            activity_id,
            year,
            semester,
            data,
            feedback
        );

        return successResponse(result, "Activity evaluation submitted successfully");
    } catch (error: any) {
        return errorResponse("Failed to submit activity evaluation", 500, error.message);
    }
}
