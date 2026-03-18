import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EvaluationFeature } from '@/features/director/components/EvaluationFeature';

export default async function DirectorEvaluation() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <EvaluationFeature />;
}
