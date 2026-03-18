import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex pt-16 h-screen">
            <Header />
            <Sidebar />
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
