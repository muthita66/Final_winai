import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { HealthFeature } from '@/features/student/components/HealthFeature';

export default async function HealthPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <HealthFeature session={session} />
    );
}
