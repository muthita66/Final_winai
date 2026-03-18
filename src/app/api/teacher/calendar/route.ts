import { TeacherCalendarService } from '@/features/teacher/calendar.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const events = await TeacherCalendarService.getAll();
        return successResponse(events);
    } catch (error: any) {
        return errorResponse('Failed to load calendar', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const { title, description, event_date, responsible_teacher_id, location, start_time, end_time } = await request.json();
        const event = await TeacherCalendarService.add(title, description, event_date, responsible_teacher_id, null, location, start_time, end_time);
        return successResponse(event, 'Event added');
    } catch (error: any) {
        return errorResponse('Failed to add event', 500, error.message);
    }
}

export async function PUT(request: Request) {
    try {
        const { id, title, description, event_date, responsible_teacher_id, location, start_time, end_time } = await request.json();
        const event = await TeacherCalendarService.update(id, title, description, event_date, responsible_teacher_id, location, start_time, end_time);
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
