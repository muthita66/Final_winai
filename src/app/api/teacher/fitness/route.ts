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

        if (action === 'advisor-classes') {
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            const classes = await TeacherFitnessService.getAdvisorClasses(teacher_id);
            return successResponse(classes);
        }

        if (action === 'criteria') {
            const test_name = searchParams.get('test_name') || '';
            const grade_level = searchParams.get('class_level') || '';
            const year = Number(searchParams.get('year'));
            const gender = searchParams.get('gender');
            
            if (gender) {
                const criteria = await TeacherFitnessService.getFitnessCriteria(test_name, grade_level, year || undefined, gender);
                return successResponse(criteria);
            } else {
                const criteria = await TeacherFitnessService.getFitnessCriteriaForClass(test_name, grade_level, year || undefined);
                return successResponse(criteria);
            }
        }

        if (action === 'students') {
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            if (!class_level) return errorResponse('class_level required', 400);
            if (!room) return errorResponse('room required', 400);

            const year = Number(searchParams.get('year')) || undefined;
            const semester = Number(searchParams.get('semester')) || undefined;

            const data = await TeacherFitnessService.getStudentsForTest(teacher_id, class_level, room, year, semester);
            return successResponse(data);
        }

        if (action === 'dropdown-options') {
            const data = await TeacherFitnessService.getDropdownOptions();
            return successResponse(data);
        }

        if (action === 'list-all-criteria') {
            const test_name = searchParams.get('test_name') || undefined;
            const grade_level = searchParams.get('class_level') || undefined;
            const year = Number(searchParams.get('year')) || undefined;
            
            const data = await TeacherFitnessService.getAllCriteria(test_name, grade_level, year);
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
        const { action, ...payload } = body;

        if (action === 'upsert-criteria') {
            const data = await TeacherFitnessService.upsertCriteria(payload);
            return successResponse(data);
        }

        if (action === 'delete-criteria') {
            const data = await TeacherFitnessService.deleteCriteria(payload.id);
            return successResponse(data);
        }

        const data = await TeacherFitnessService.saveFitnessTest(body);
        return successResponse(data);
    } catch (error: any) {
        console.error("FITNESS SAVE ERROR:", error);
        return errorResponse('Failed to process request', 500, error.message);
    }
}
