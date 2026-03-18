import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ActorsFeature from '@/features/director/components/ActorsFeature';

export default async function DirectorActorsPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <ActorsFeature />;
}
