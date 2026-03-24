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
            <main className="flex-1 ml-64 relative min-w-0 overflow-x-hidden">
                <div className="h-full overflow-y-auto px-4 py-8 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
}
