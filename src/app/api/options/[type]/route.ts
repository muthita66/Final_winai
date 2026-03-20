import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { successResponse, errorResponse } from "@/lib/api-response";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
    try {
        const { type } = await params;
        console.log("OPTIONS API TYPE:", type);

        if (type === "grades") {
            // Fetch grade levels from the correct table name 'levels'
            const query = await prisma.$queryRaw`SELECT id, name AS label FROM levels ORDER BY id ASC`;
            return successResponse(query);
        }

        if (type === "classrooms") {
            const classrooms = await prisma.classrooms.findMany({
                include: { levels: true },
                orderBy: [{ grade_level_id: 'asc' }, { room_name: 'asc' }]
            });
            const data = classrooms.map((c: any) => ({
                id: c.id,
                label: `${c.levels?.name || ''} ${c.room_name}`.trim(),
                level: c.levels?.name || ''
            }));
            return successResponse(data);
        }

        if (type === "subjects") {
            const subjects = await prisma.subjects.findMany({
                orderBy: { subject_code: 'asc' },
                select: { id: true, subject_code: true, subject_name: true }
            });
            const data = subjects.map((s: any) => ({
                id: s.id,
                label: `${s.subject_code} ${s.subject_name}`,
            }));
            return successResponse(data);
        }

        if (type === "learning-groups") {
            const groups = await prisma.learning_subject_groups.findMany({
                orderBy: { group_name: 'asc' },
                select: { id: true, group_name: true }
            });
            const data = groups.map((g: any) => ({
                id: g.id,
                label: g.group_name,
            }));
            return successResponse(data);
        }

        return errorResponse("Unknown option type", 400);

    } catch (e: any) {
        return errorResponse("Failed to fetch options", 500, e.message);
    }
}
