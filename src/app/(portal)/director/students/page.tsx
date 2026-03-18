import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudentsFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorStudents() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <StudentsFeature />;
}
