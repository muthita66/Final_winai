"use client";
import { useEffect, useState } from "react";
import { fetchApi } from "@/services/api-client";

type ActorInfo = {
    name: string;
    label: string;
    group: string;
    groupLabel: string;
    count: number;
};

type ActorDetail = {
    name: string;
    label: string;
    group: string;
    groupLabel: string;
    data: any[];
};

const GROUP_COLORS: Record<string, { bg: string; border: string; icon: string; gradient: string }> = {
    core: { bg: "bg-blue-50", border: "border-blue-200", icon: "👤", gradient: "from-blue-600 to-indigo-700" },
    academic: { bg: "bg-violet-50", border: "border-violet-200", icon: "📚", gradient: "from-violet-600 to-purple-700" },
    scores: { bg: "bg-amber-50", border: "border-amber-200", icon: "📊", gradient: "from-amber-500 to-orange-600" },
    attendance: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "✅", gradient: "from-cyan-500 to-teal-600" },
    behavior: { bg: "bg-rose-50", border: "border-rose-200", icon: "📋", gradient: "from-rose-500 to-pink-600" },
    schedule: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "📅", gradient: "from-emerald-500 to-green-600" },
    events: { bg: "bg-purple-50", border: "border-purple-200", icon: "🎉", gradient: "from-purple-500 to-fuchsia-600" },
    evaluation: { bg: "bg-teal-50", border: "border-teal-200", icon: "📝", gradient: "from-teal-500 to-cyan-600" },
    master: { bg: "bg-slate-50", border: "border-slate-200", icon: "⚙️", gradient: "from-slate-500 to-gray-600" },
    system: { bg: "bg-red-50", border: "border-red-200", icon: "🔧", gradient: "from-red-500 to-rose-600" },
};

function formatCellValue(value: any): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "✓" : "✗";
    if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) {
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                if (String(value).includes("T") && String(value).includes(":")) {
                    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
                }
                return d.toLocaleDateString("th-TH");
            }
        } catch { /* fall through */ }
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function DataModal({
    open,
    actor,
    onClose,
}: {
    open: boolean;
    actor: ActorDetail | null;
    onClose: () => void;
}) {
    if (!open || !actor) return null;

    const columns = actor.data.length > 0 ? Object.keys(actor.data[0]) : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-7xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{actor.label}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Table: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{actor.name}</code>
                            <span className="mx-2">•</span>
                            {actor.data.length} แถว {actor.data.length >= 100 && <span className="text-amber-600">(แสดง 100 แถวแรก)</span>}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-xl"
                    >
                        ×
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4">
                    {actor.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <div className="text-5xl mb-4">📭</div>
                            <p className="text-lg font-medium">ไม่มีข้อมูลในตารางนี้</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 sticky top-0 z-10">
                                    <th className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 text-xs uppercase tracking-wider">#</th>
                                    {columns.map((col) => (
                                        <th
                                            key={col}
                                            className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 text-xs uppercase tracking-wider whitespace-nowrap"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {actor.data.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{i + 1}</td>
                                        {columns.map((col) => (
                                            <td key={col} className="px-3 py-2 text-slate-700 max-w-[300px] truncate" title={formatCellValue(row[col])}>
                                                {formatCellValue(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium transition-colors"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ActorsFeature() {
    const [actors, setActors] = useState<ActorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActor, setSelectedActor] = useState<ActorDetail | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchApi<ActorInfo[]>("/api/director/actors")
            .then((data) => {
                setActors(data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleClickActor = async (name: string) => {
        setLoadingDetail(true);
        setModalOpen(true);
        try {
            const detail = await fetchApi<ActorDetail>(`/api/director/actors?name=${encodeURIComponent(name)}`);
            setSelectedActor(detail);
        } catch (e: any) {
            alert(e.message || "ไม่สามารถโหลดข้อมูลได้");
            setModalOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedActor(null);
    };

    // Group actors
    const grouped = actors.reduce<Record<string, { groupLabel: string; items: ActorInfo[] }>>((acc, actor) => {
        if (!acc[actor.group]) acc[actor.group] = { groupLabel: actor.groupLabel, items: [] };
        acc[actor.group].items.push(actor);
        return acc;
    }, {});

    const totalCount = actors.reduce((sum, a) => sum + a.count, 0);

    // Filter
    const filteredGrouped = Object.entries(grouped).reduce<Record<string, { groupLabel: string; items: ActorInfo[] }>>((acc, [group, data]) => {
        const filtered = data.items.filter(
            (a) =>
                !search ||
                a.name.toLowerCase().includes(search.toLowerCase()) ||
                a.label.includes(search)
        );
        if (filtered.length > 0) acc[group] = { groupLabel: data.groupLabel, items: filtered };
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล actors...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero */}
            <section className="bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -translate-x-12 translate-y-12" />
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">
                        🗄️ Database Explorer
                    </div>
                    <h1 className="text-3xl font-bold">ข้อมูลทุก Actor ในระบบ</h1>
                    <p className="text-white/70 mt-2">
                        ทั้งหมด {actors.length} ตาราง • {totalCount.toLocaleString("th-TH")} รายการ
                    </p>
                </div>
            </section>

            {/* Search */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <input
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="ค้นหาตาราง... (ชื่อ table / ชื่อไทย)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Grouped Cards */}
            {Object.entries(filteredGrouped).map(([group, { groupLabel, items }]) => {
                const colors = GROUP_COLORS[group] || GROUP_COLORS.master;
                const groupTotal = items.reduce((s, a) => s + a.count, 0);

                return (
                    <div key={group} className="space-y-3">
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-2xl">{colors.icon}</span>
                            <h2 className="text-lg font-bold text-slate-700">{groupLabel}</h2>
                            <span className="text-sm text-slate-400">
                                {items.length} ตาราง • {groupTotal.toLocaleString("th-TH")} records
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {items.map((actor) => (
                                <button
                                    key={actor.name}
                                    onClick={() => handleClickActor(actor.name)}
                                    className={`group relative ${colors.bg} ${colors.border} border rounded-2xl p-4 text-left hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{actor.label}</h3>
                                            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{actor.name}</p>
                                        </div>
                                        <div className={`bg-gradient-to-br ${colors.gradient} text-white text-sm font-bold px-3 py-1 rounded-xl shadow-sm min-w-[48px] text-center`}>
                                            {actor.count.toLocaleString("th-TH")}
                                        </div>
                                    </div>
                                    <div className="absolute bottom-2 right-3 text-slate-300 group-hover:text-slate-500 transition-colors text-xs">
                                        คลิกดูข้อมูล →
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Loading Modal */}
            {modalOpen && loadingDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-slate-600 font-medium">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            )}

            {/* Data Modal */}
            <DataModal open={modalOpen && !loadingDetail} actor={selectedActor} onClose={closeModal} />
        </div>
    );
}
