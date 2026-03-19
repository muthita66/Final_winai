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

        if (action === 'indicators') {
            const subject_id = Number(searchParams.get('subject_id'));
            if (!subject_id || Number.isNaN(subject_id)) return errorResponse('subject_id required', 400);
            const data = await TeacherScoresService.getIndicators(subject_id);
            return successResponse(data);
        }

        if (action === 'categories') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id || Number.isNaN(section_id)) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.getCategories(section_id);
            return successResponse(data);
        }

        if (action === 'category_types') {
            const data = await TeacherScoresService.getCategoryTypes();
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
            const data = await TeacherScoresService.addHeader(body.section_id, body.category_id || body.category_name || 'ทั่วไป', body.header_name, body.max_score, body.indicator_ids);
            return successResponse(data);
        }
        if (action === 'header_update') {
            if (!Number(body.id) || Number.isNaN(Number(body.id))) return errorResponse('id required', 400);
            const data = await TeacherScoresService.updateHeader(body.id, body.title, body.max_score, body.indicator_ids, body.category_id);
            return successResponse(data);
        }
        if (action === 'save') {
            if (!Number(body.header_id) || Number.isNaN(Number(body.header_id))) return errorResponse('header_id required', 400);
            const data = await TeacherScoresService.saveScores(body.header_id, body.scores);
            return successResponse(data);
        }

        if (action === 'category_add') {
            if (!Number(body.section_id)) return errorResponse('section_id required', 400);
            const data = await TeacherScoresService.addCategory(body.section_id, body.name, body.weight_percent, body.category_type_id);
            return successResponse(data);
        }
        if (action === 'category_update') {
            if (!Number(body.id)) return errorResponse('id required', 400);
            const data = await TeacherScoresService.updateCategory(body.id, body.name, body.weight_percent, body.category_type_id);
            return successResponse(data);
        }

        if (action === 'category_type_add') {
            if (!body.type_name) return errorResponse('type_name required', 400);
            const data = await TeacherScoresService.addCategoryType(body.type_name);
            return successResponse(data);
        }

        if (action === 'category_type_update') {
            if (!body.id || !body.type_name) return errorResponse('id and type_name required', 400);
            const data = await TeacherScoresService.updateCategoryType(body.id, body.type_name);
            return successResponse(data);
        }

        if (action === 'category_type_delete') {
            const typeId = Number(body.id);
            if (!typeId) return errorResponse('id required', 400);
            console.log("Attempting to delete category type ID:", typeId);
            try {
                const data = await TeacherScoresService.deleteCategoryType(typeId);
                console.log("Delete category type result:", data);
                return successResponse(data);
            } catch (err: any) {
                console.error("Failed to delete category type:", err.message);
                return errorResponse('Failed to delete: it may be in use', 500, err.message);
            }
        }

        if (action === 'category_delete') {
            await TeacherScoresService.deleteCategory(body.id);
            return successResponse({ success: true });
        }

        if (action === 'header_delete') {
            const id = Number(body.id);
            if (!id) return errorResponse('id required', 400);
            await TeacherScoresService.deleteHeader(id);
            return successResponse({ success: true });
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

        if (searchParams.get('action') === 'category_delete') {
            await TeacherScoresService.deleteCategory(id);
            return successResponse({ success: true });
        }

        if (searchParams.get('action') === 'category_type_delete') {
            await TeacherScoresService.deleteCategoryType(id);
            return successResponse({ success: true });
        }

        await TeacherScoresService.deleteHeader(id);
        return successResponse({ success: true });
    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}
