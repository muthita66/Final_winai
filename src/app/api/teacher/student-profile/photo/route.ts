import { TeacherStudentsService } from '@/features/teacher/students.service';
import { errorResponse, successResponse } from '@/lib/api-response';
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'uploads', 'student-photos');
const PUBLIC_URL_BASE = '/uploads/student-photos';
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeExtension(fileName: string, mimeType?: string | null) {
    const ext = path.extname(fileName || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return ext;

    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    return null;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const teacher_id = Number(formData.get('teacher_id'));
        const student_id = Number(formData.get('student_id') || formData.get('id'));
        const file = formData.get('file');

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (!student_id || Number.isNaN(student_id)) return errorResponse('student_id required', 400);
        if (!(file instanceof File)) return errorResponse('file required', 400);
        if (file.size <= 0) return errorResponse('empty file', 400);
        if (file.size > MAX_SIZE_BYTES) return errorResponse('file too large (max 5MB)', 400);

        const canAccess = await TeacherStudentsService.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) return errorResponse('Student not found in advisory list', 403);

        const ext = normalizeExtension(file.name, file.type);
        if (!ext) return errorResponse('unsupported image type', 400);

        await fs.mkdir(PUBLIC_DIR, { recursive: true });

        const existing = await fs.readdir(PUBLIC_DIR).catch(() => []);
        const prefix = `student-${student_id}.`;
        await Promise.all(
            existing
                .filter((name) => name.startsWith(prefix))
                .map((name) => fs.unlink(path.join(PUBLIC_DIR, name)).catch(() => { }))
        );

        const fileName = `student-${student_id}${ext}`;
        const filePath = path.join(PUBLIC_DIR, fileName);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        return successResponse({
            photo_url: `${PUBLIC_URL_BASE}/${fileName}`,
        }, 'Photo uploaded');
    } catch (error: any) {
        return errorResponse('Failed to upload photo', 500, error.message);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const student_id = Number(searchParams.get('student_id'));

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
        if (!student_id || Number.isNaN(student_id)) return errorResponse('student_id required', 400);

        const canAccess = await TeacherStudentsService.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) return errorResponse('Student not found in advisory list', 403);

        const existing = await fs.readdir(PUBLIC_DIR).catch(() => []);
        const prefix = `student-${student_id}.`;
        let deleted = false;

        await Promise.all(
            existing
                .filter((name) => name.startsWith(prefix))
                .map(async (name) => {
                    await fs.unlink(path.join(PUBLIC_DIR, name)).catch(() => { });
                    deleted = true;
                })
        );

        if (!deleted) return errorResponse('Photo not found', 404);

        return successResponse(null, 'Photo deleted');
    } catch (error: any) {
        return errorResponse('Failed to delete photo', 500, error.message);
    }
}

