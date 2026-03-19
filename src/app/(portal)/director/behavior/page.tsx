import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BehaviorFeature } from '@/features/teacher/components/BehaviorFeature';

export default async function DirectorBehaviorPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') {
        redirect('/login');
    }

    return (
        <BehaviorFeature session={session} />
    );
}
