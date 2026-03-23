import { TeacherCalendarService } from '@/features/teacher/calendar.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'departments') {
            return successResponse(await TeacherCalendarService.getDepartments());
        }
        if (action === 'event-types') {
            return successResponse(await TeacherCalendarService.getEventTypes());
        }
        if (action === 'target-types') {
            return successResponse(await TeacherCalendarService.getTargetTypes());
        }

        const events = await TeacherCalendarService.getAll();
        return successResponse(events);
    } catch (error: any) {
        return errorResponse('Failed to load calendar', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const event = await TeacherCalendarService.add(body);
        return successResponse(event, 'Event added');
    } catch (error: any) {
        return errorResponse('Failed to add event', 500, error.message);
    }
}

export async function PUT(request: Request) {
    try {
        const { id, ...data } = await request.json();
        if (!id) return errorResponse('id required', 400);
        const event = await TeacherCalendarService.update(id, data);
        return successResponse(event, 'Event updated');
    } catch (error: any) {
        return errorResponse('Failed to update event', 500, error.message);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id'));
        if (!id || Number.isNaN(id)) return errorResponse('id required', 400);
        await TeacherCalendarService.remove(id);
        return successResponse({ success: true });
    } catch (error: any) {
        return errorResponse('Failed to delete event', 500, error.message);
    }
}
