import { Bell, UserCheck, MapPinned } from 'lucide-react';

interface NotificationItem {
    id: string;
    icon: typeof UserCheck;
    iconColor: string;
    iconBg: string;
    title: string;
    count: number;
}

interface NotificationDropdownProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    items: NotificationItem[];
    onItemClick: (itemId: string) => void;
}

export default function NotificationDropdown({ isOpen, onToggle, onClose, items, onItemClick }: NotificationDropdownProps) {
    const totalCount = items.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className="p-2 hover:bg-slate-800 rounded-full relative transition-colors text-slate-400 hover:text-white"
            >
                <Bell size={22} />
                {totalCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-medium shadow-sm shadow-red-500/50">
                        {totalCount > 9 ? '9+' : totalCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-800">
                        <h3 className="font-semibold text-white">Notifikasi</h3>
                    </div>
                    <div className="p-2">
                        {totalCount === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">
                                Tidak ada approval pending
                            </p>
                        ) : (
                            items.filter(item => item.count > 0).map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { onItemClick(item.id); onClose(); }}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors group"
                                >
                                    <div className={`p-2 ${item.iconBg} rounded-full group-hover:opacity-80 ${item.iconColor} transition-colors`}>
                                        <item.icon size={18} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-slate-200">{item.title}</p>
                                        <p className="text-xs text-slate-500">{item.count} menunggu approval</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Pre-configured notification items for common use
export const createApprovalNotifications = (faceVerifications: number, transferRequests: number): NotificationItem[] => [
    {
        id: 'face-verifications',
        icon: UserCheck,
        iconColor: 'text-orange-500',
        iconBg: 'bg-orange-500/10',
        title: 'Verifikasi Wajah',
        count: faceVerifications,
    },
    {
        id: 'transfer-requests',
        icon: MapPinned,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-500/10',
        title: 'Pindah Lokasi',
        count: transferRequests,
    },
];
