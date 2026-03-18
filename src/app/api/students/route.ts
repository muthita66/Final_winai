import { StudentService } from '@/features/student/student.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        // API is very thin - it only handles HTTP Request/Response logic
        // Complex logic is delegated to the service (`StudentService`)
        const students = await StudentService.getAllStudents();

        return successResponse(students, 'Students retrieved successfully');
    } catch (error: any) {
        console.error('GET /api/students error:', error);
        return errorResponse('Failed to retrieve students', 500, error.message);
    }
}
