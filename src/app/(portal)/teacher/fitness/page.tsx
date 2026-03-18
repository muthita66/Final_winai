import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FitnessFeature } from '@/features/teacher/components/FitnessFeature';

export default async function TeacherFitness() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <FitnessFeature session={session} />;
}
