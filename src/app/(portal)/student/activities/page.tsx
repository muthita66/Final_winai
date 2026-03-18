import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ActivitiesFeature } from '@/features/student/components/ActivitiesFeature';

export default async function ActivitiesPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <ActivitiesFeature session={session} />
    );
}
