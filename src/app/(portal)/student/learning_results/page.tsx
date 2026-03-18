import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LearningResultsFeature } from '@/features/student/components/LearningResultsFeature';

export default async function LearningResultsPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <LearningResultsFeature session={session} />
    );
}
