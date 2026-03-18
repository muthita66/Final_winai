import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdvisorEvaluationHubFeature } from '@/features/student/components/AdvisorEvaluationHubFeature';

export default async function StudentAdvisorEvaluationPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <AdvisorEvaluationHubFeature session={session} />
    );
}
