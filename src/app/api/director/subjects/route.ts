import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        return successResponse(await DirectorService.getSubjects({ 
            search: searchParams.get('search') || undefined, 
            level: searchParams.get('level') || undefined, 
            group: searchParams.get('group') || undefined,
            category: searchParams.get('category') || undefined
        }));
    } catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function POST(req: Request) {
    try { return successResponse(await DirectorService.createSubject(await req.json())); }
    catch (e: any) { if ((e as any).code === 'P2002') return errorResponse('รหัสวิชานี้มีอยู่ในระบบแล้ว', 400); return errorResponse('Failed', 500, e.message); }
}
export async function PUT(req: Request) {
    try { const body = await req.json(); return successResponse(await DirectorService.updateSubject(body.id, body)); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
export async function DELETE(req: Request) {
    try { const { searchParams } = new URL(req.url); return successResponse(await DirectorService.deleteSubject(Number(searchParams.get('id')))); }
    catch (e: any) { return errorResponse('Failed', 500, e.message); }
}
