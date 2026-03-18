import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SubjectsFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorSubjects() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <SubjectsFeature />;
}
