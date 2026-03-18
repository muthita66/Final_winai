import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RegistrationFeature } from '@/features/student/components/RegistrationFeature';

export default async function RegistrationPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    // We can pass the session directly since we made it awaitable
    return (
        <RegistrationFeature session={session} />
    );
}
