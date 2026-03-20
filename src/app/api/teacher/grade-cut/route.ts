import { TeacherGradeCutService } from '@/features/teacher/grade-cut.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const section_id = Number(searchParams.get('section_id'));

        if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);

        if (action === 'thresholds') {
            const data = await TeacherGradeCutService.getThresholds(section_id);
            return successResponse(data);
        }
        if (action === 'summary') {
            const data = await TeacherGradeCutService.getGradeSummary(section_id);
            return successResponse(data);
        }
        if (action === 'scale_groups') {
            const data = await TeacherGradeCutService.getGradeScaleGroups();
            return successResponse(data);
        }

        return errorResponse('Unknown action', 400);
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const section_id = Number(body.section_id);
        if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);

        if (body.action === 'save_thresholds') {
            const data = await TeacherGradeCutService.saveThresholds(section_id, body.thresholds);
            return successResponse(data);
        }
        if (body.action === 'reset_thresholds') {
            const data = await TeacherGradeCutService.resetThresholds(section_id);
            return successResponse(data);
        }
        if (body.action === 'calculate') {
            const data = await TeacherGradeCutService.calculateAndSaveGrades(section_id);
            return successResponse(data);
        }
        if (body.action === 'update_manual_grade') {
            const enrollment_id = Number(body.enrollment_id);
            if (!enrollment_id) return errorResponse('enrollment_id required', 400);
            const data = await TeacherGradeCutService.updateManualGrade(
                enrollment_id, 
                body.letter_grade, 
                body.grade_point,
                body.is_locked ?? true
            );
            return successResponse(data);
        }
        if (body.action === 'select_scale_group') {
            const data = await TeacherGradeCutService.setGradeScaleGroup(section_id, body.group_id);
            return successResponse(data);
        }

        return errorResponse('Unknown action', 400);
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}
