import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProjectsFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorProjects() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <ProjectsFeature />;
}
