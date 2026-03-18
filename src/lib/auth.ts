import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'fallback-secret-key-for-dev-only-change-in-prod';
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(key);
}

export async function decrypt(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    return await decrypt(session);
}

export async function setSessionCookie(payload: any) {
    const session = await encrypt(payload);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const cookieStore = await cookies();
    cookieStore.set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
}

export async function clearSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.set('session', '', { expires: new Date(0), httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
}
