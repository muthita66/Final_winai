import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const data = await DirectorService.getTeachers(searchParams.get('search') || undefined);
        return successResponse(data);
    } catch (e: any) { return errorResponse('Failed', 500, e.message); }
}

export async function POST(req: Request) {
    try { return successResponse(await DirectorService.createTeacher(await req.json())); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}

export async function PUT(req: Request) {
    try { const body = await req.json(); return successResponse(await DirectorService.updateTeacher(body.id, body)); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}

export async function DELETE(req: Request) {
    try { const { searchParams } = new URL(req.url); return successResponse(await DirectorService.deleteTeacher(Number(searchParams.get('id')))); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
