import { TeacherScoresService } from '@/features/teacher/scores.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'subjects') {
            const teacher_id = Number(searchParams.get('teacher_id'));
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            const data = await TeacherScoresService.getSubjects(teacher_id);
            return successResponse(data);
        }
        if (action === 'headers') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.getHeaders(section_id);
            return successResponse(data);
        }
        if (action === 'students') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.getStudents(section_id);
            return successResponse(data);
        }
        if (action === 'scores') {
            const header_id = Number(searchParams.get('header_id'));
            if (!header_id || Number.isNaN(header_id)) return errorResponse('header_id required', 400);
            const data = await TeacherScoresService.getScores(header_id);
            return successResponse(data);
        }
        if (action === 'all_scores') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.getAllSectionScores(section_id);
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
        const { action } = body;

        if (action === 'header_add') {
            if (!Number(body.section_id) || Number.isNaN(Number(body.section_id))) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.addHeader(body.section_id, body.header_name, body.max_score);
            return successResponse(data);
        }
        if (action === 'header_update') {
            if (!Number(body.id) || Number.isNaN(Number(body.id))) return errorResponse('id required', 400);
            const data = await TeacherScoresService.updateHeader(body.id, body.title, body.max_score);
            return successResponse(data);
        }
        if (action === 'save') {
            if (!Number(body.header_id) || Number.isNaN(Number(body.header_id))) return errorResponse('header_id required', 400);
            const data = await TeacherScoresService.saveScores(body.header_id, body.scores);
            return successResponse(data);
        }

        return errorResponse('Unknown action', 400);
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id'));
        if (!id || Number.isNaN(id)) return errorResponse('id required', 400);
        await TeacherScoresService.deleteHeader(id);
        return successResponse({ success: true });
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}
