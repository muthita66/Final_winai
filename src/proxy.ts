import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth'; // Ensure this uses 'jose' as configured

const publicRoutes = ['/login', '/api/auth/login'];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Let public routes pass
    if (publicRoutes.includes(pathname)) {
        return NextResponse.next();
    }

    // Check for session cookie
    const session = request.cookies.get('session')?.value;

    if (!session) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Validate the JWT Token
    const payload = await decrypt(session) as any;
    if (!payload) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based Route Protection
    const role = payload.role;

    if (pathname.startsWith('/student') && role !== 'student') {
        return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
    }
    if (pathname.startsWith('/teacher') && role !== 'teacher') {
        return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
    }
    if (pathname.startsWith('/director') && role !== 'director') {
        return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
    }

    // Role-based API protection
    if (pathname.startsWith('/api/student') && role !== 'student') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (pathname.startsWith('/api/teacher') && role !== 'teacher') {
        // Allow Director to access behavior API
        if (role === 'director' && pathname.startsWith('/api/teacher/behavior')) {
            return NextResponse.next();
        }
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (pathname.startsWith('/api/director') && role !== 'director') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Inject user info into headers so that downstream components/route handlers can access it if needed
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.id.toString());
    requestHeaders.set('x-user-role', payload.role);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    // Exclude Next.js internals, static files, images, and all files with extensions
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|woff|woff2|ttf|eot)).*)'],
};
