import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdvisorsFeature } from '@/features/director/components/AdvisorsFeature';

export default async function DirectorAdvisors() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <AdvisorsFeature />;
}
