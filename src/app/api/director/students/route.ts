import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const data = await DirectorService.getStudents({
            search: searchParams.get('search') || undefined,
            class_level: searchParams.get('class_level') || undefined,
            room: searchParams.get('room') || undefined
        });
        return successResponse(data);
    } catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function POST(req: Request) {
    try { return successResponse(await DirectorService.createStudent(await req.json())); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function PUT(req: Request) {
    try { const body = await req.json(); return successResponse(await DirectorService.updateStudent(body.id, body)); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function DELETE(req: Request) {
    try { const { searchParams } = new URL(req.url); return successResponse(await DirectorService.deleteStudent(Number(searchParams.get('id')))); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
