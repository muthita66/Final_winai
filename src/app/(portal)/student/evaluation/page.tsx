import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EvaluationFeature } from '@/features/student/components/EvaluationFeature';

export default async function EvaluationPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <EvaluationFeature session={session} />
    );
}
