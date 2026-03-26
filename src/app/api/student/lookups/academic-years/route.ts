import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
    console.log('[GET /api/student/lookups/academic-years] Request hit');
    try {
        const years = await prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' },
            select: {
                id: true,
                year_name: true,
                semesters: {
                    select: {
                        id: true,
                        semester_number: true,
                        is_active: true
                    },
                    orderBy: {
                        semester_number: 'asc'
                    }
                }
            }
        });
        return successResponse(years);
    } catch (e: any) {
        return errorResponse('Failed to fetch academic years', 500, e.message);
    }
}
