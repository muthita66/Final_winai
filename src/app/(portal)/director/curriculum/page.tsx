import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CurriculumFeature } from '@/features/director/components/CurriculumFeature';

export default async function DirectorCurriculum() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <CurriculumFeature />;
}
