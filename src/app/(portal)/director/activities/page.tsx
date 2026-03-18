import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ActivitiesFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorActivities() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <ActivitiesFeature />;
}
