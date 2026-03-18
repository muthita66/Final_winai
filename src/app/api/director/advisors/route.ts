import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        return successResponse(await DirectorService.getAdvisors({
            year: Number(searchParams.get('year')) || undefined,
            semester: Number(searchParams.get('semester')) || undefined,
            class_level: searchParams.get('class_level') || undefined,
            room: searchParams.get('room') || undefined
        }));
    } catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function POST(req: Request) {
    try { return successResponse(await DirectorService.createAdvisor(await req.json())); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function PUT(req: Request) {
    try { const body = await req.json(); return successResponse(await DirectorService.updateAdvisor(body.id, body)); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function DELETE(req: Request) {
    try { const { searchParams } = new URL(req.url); return successResponse(await DirectorService.deleteAdvisor(Number(searchParams.get('id')))); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
