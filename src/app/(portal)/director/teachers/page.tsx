import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TeachersFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorTeachers() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <TeachersFeature />;
}
