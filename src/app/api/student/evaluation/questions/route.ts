import { EvaluationService } from '@/features/student/evaluation.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return errorResponse("Unauthorized", 401);
        }

        const { searchParams } = new URL(req.url);
        const formId = Number(searchParams.get('form_id'));

        if (!formId) {
            return errorResponse("Missing form_id", 400);
        }

        const questions = await EvaluationService.getFormQuestions(formId);
        return successResponse(questions, "Form questions retrieved successfully");
    } catch (error: any) {
        return errorResponse("Failed to retrieve form questions", 500, error.message);
    }
}
