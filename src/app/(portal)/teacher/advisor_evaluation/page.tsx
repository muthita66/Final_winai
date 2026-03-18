import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdvisorEvaluationFeature } from '@/features/teacher/components/AdvisorEvaluationFeature';

export default async function TeacherAdvisorEvaluation() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <AdvisorEvaluationFeature session={session} />;
}
