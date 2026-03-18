import { NextResponse } from 'next/server';
import { TeacherFitnessService } from '@/features/teacher/fitness.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const class_level = searchParams.get('class_level') || '';
        const room = searchParams.get('room') || '';
        const action = searchParams.get('action');

        if (action === 'years') {
            const years = await TeacherFitnessService.getAcademicYears();
            return successResponse(years);
        }

        if (action === 'students') {
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            if (!class_level) return errorResponse('class_level required', 400);
            if (!room) return errorResponse('room required', 400);

            const data = await TeacherFitnessService.getStudentsForTest(teacher_id, class_level, room);
            return successResponse(data);
        }

        return errorResponse('Invalid or missing action parameter', 400);

    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = await TeacherFitnessService.saveFitnessTest(body);
        return successResponse(data);
    } catch (error: any) {
        return errorResponse('Failed to save fitness test', 500, error.message);
    }
}
