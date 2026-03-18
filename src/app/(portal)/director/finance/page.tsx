import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FinanceFeature } from '@/features/director/components/CrudFeatures';

export default async function DirectorFinance() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <FinanceFeature />;
}
