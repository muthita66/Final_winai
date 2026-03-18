import { AuthService } from '@/features/auth/auth.service';
import { setSessionCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const { code, password, role } = await request.json();

        if (!code || !password || !role) {
            return errorResponse('Missing required fields: code, password, or role', 400);
        }

        const payload = await AuthService.authenticateUser(code, password, role);

        // Set HTTPOnly Cookie
        await setSessionCookie(payload);

        return successResponse(payload, 'Login successful');
    } catch (error: any) {
        console.error('POST /api/auth/login error:', error);
        return errorResponse(error.message || 'Authentication failed', 401);
    }
}
