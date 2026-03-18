import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProfileFeature } from '@/features/student/components/ProfileFeature';

export default async function ProfilePage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <ProfileFeature session={session} />
    );
}
