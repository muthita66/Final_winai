import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ConductFeature } from '@/features/student/components/ConductFeature';

export default async function ConductPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <ConductFeature session={session} />
    );
}
