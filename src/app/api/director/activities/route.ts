import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET() {
    try { return successResponse(await DirectorService.getActivities()); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function POST(req: Request) {
    try { return successResponse(await DirectorService.createActivity(await req.json())); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function PUT(req: Request) {
    try { const body = await req.json(); return successResponse(await DirectorService.updateActivity(body.id, body)); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function DELETE(req: Request) {
    try { const { searchParams } = new URL(req.url); return successResponse(await DirectorService.deleteActivity(Number(searchParams.get('id')))); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
