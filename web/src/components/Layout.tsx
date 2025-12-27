// Main Layout with Sidebar and Header Notifications
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminAPI, getUploadUrl } from '../api/client';
import {
    LayoutDashboard, Users, FileText, LogOut, Menu, X,
    UserCheck, MapPinned, Settings, Building, Bell,
    ChevronDown, ChevronRight, ClipboardCheck, Cog, Monitor, Briefcase
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
    to: string;
    icon: any;
    label: string;
}

interface NavGroup {
    id: string;
    label: string;
    icon: any;
    children: NavItem[];
    showBadge?: boolean;
}

type NavEntry = NavItem | NavGroup;

const isNavGroup = (entry: NavEntry): entry is NavGroup => {
    return 'children' in entry;
};

// Navigation structure with nested menus
const navItems: NavEntry[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/employees', icon: Briefcase, label: 'Data Karyawan' },
    { to: '/users', icon: Users, label: 'Users' },
    {
        id: 'approval',
        label: 'Approval',
        icon: ClipboardCheck,
        showBadge: true,
        children: [
            { to: '/face-verifications', icon: UserCheck, label: 'Verifikasi Wajah' },
            { to: '/transfer-requests', icon: MapPinned, label: 'Pindah Lokasi' },
        ]
    },
    { to: '/reports', icon: FileText, label: 'Reports' },
    {
        id: 'settings',
        label: 'Pengaturan',
        icon: Settings,
        children: [
            { to: '/offices', icon: Building, label: 'Lokasi Kantor' },
            { to: '/kiosks', icon: Monitor, label: 'Manajemen Kiosk' },
            { to: '/settings', icon: Cog, label: 'System' },
        ]
    },
];

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ approval: true, settings: false });
    const [notifOpen, setNotifOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [pendingCounts, setPendingCounts] = useState({ faceVerifications: 0, transferRequests: 0 });
    const [companySettings, setCompanySettings] = useState<{ name: string; logo: string | null }>({ name: 'AttendX', logo: null });
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminAPI.getSettings();
                const s = res.data.settings || {};
                setCompanySettings({
                    name: s.company_name || 'AttendX',
                    logo: s.company_logo || null
                });
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        fetchSettings();
    }, []);

    // Fetch pending counts
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [faceRes, transferRes] = await Promise.all([
                    adminAPI.getFaceVerifications(),
                    adminAPI.getTransferRequests()
                ]);
                setPendingCounts({
                    faceVerifications: faceRes.data?.length || 0,
                    transferRequests: transferRes.data?.length || 0
                });
            } catch (err) {
                console.error('Failed to fetch pending counts:', err);
            }
        };
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const totalPending = pendingCounts.faceVerifications + pendingCounts.transferRequests;

    // Auto-expand relevant group based on current page
    useEffect(() => {
        navItems.forEach(entry => {
            if (isNavGroup(entry)) {
                const hasActiveChild = entry.children.some(child => location.pathname === child.to);
                if (hasActiveChild) {
                    setOpenGroups(prev => ({ ...prev, [entry.id]: true }));
                }
            }
        });
    }, [location.pathname]);

    const handleLogout = () => {
        setLogoutModalOpen(true);
    };

    const confirmLogout = () => {
        logout();
        navigate('/login');
        setLogoutModalOpen(false);
    };

    const toggleGroup = (groupId: string) => {
        setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const renderNavItem = (item: NavItem) => (
        <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
            }
        >
            <item.icon size={20} />
            {sidebarOpen && <span>{item.label}</span>}
        </NavLink>
    );

    const renderNavGroup = (group: NavGroup) => {
        const isChildActive = group.children.some(child => location.pathname === child.to);
        const isOpen = openGroups[group.id] || false;

        return (
            <div key={group.id}>
                <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isChildActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                >
                    <group.icon size={20} />
                    {sidebarOpen && (
                        <>
                            <span className="flex-1 text-left">{group.label}</span>
                            {group.showBadge && totalPending > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {totalPending}
                                </span>
                            )}
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </>
                    )}
                </button>
                {isOpen && sidebarOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                        {group.children.map(child => (
                            <NavLink
                                key={child.to}
                                to={child.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${isActive
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                    }`
                                }
                            >
                                <child.icon size={16} />
                                <span className="flex-1">{child.label}</span>
                                {child.to === '/face-verifications' && pendingCounts.faceVerifications > 0 && (
                                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {pendingCounts.faceVerifications}
                                    </span>
                                )}
                                {child.to === '/transfer-requests' && pendingCounts.transferRequests > 0 && (
                                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {pendingCounts.transferRequests}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 flex font-sans text-slate-200">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-20'
                    } bg-slate-900 border-r border-slate-800 text-white transition-all duration-300 flex flex-col`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    {sidebarOpen && (
                        companySettings.logo ? (
                            <div className="flex items-center gap-3">
                                <img src={getUploadUrl(companySettings.logo)!} alt="Logo" className="w-8 h-8 object-contain rounded" />
                                <span className="text-lg font-bold text-white truncate max-w-[140px]">{companySettings.name}</span>
                            </div>
                        ) : (
                            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{companySettings.name}</span>
                        )
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto global-scrollbar">
                    {navItems.map((entry) =>
                        isNavGroup(entry) ? renderNavGroup(entry) : renderNavItem(entry)
                    )}
                </nav>

                {/* User & Logout */}
                <div className="p-4 border-t border-slate-800">
                    {sidebarOpen && (
                        <div className="mb-3 px-2">
                            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                            <p className="text-xs text-slate-500">{user?.role}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content with Header */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-end px-6 gap-4">
                    {/* Notification Bell */}
                    <div className="relative">
                        <button
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="p-2 hover:bg-slate-800 rounded-full relative transition-colors text-slate-400 hover:text-white"
                        >
                            <Bell size={22} />
                            {totalPending > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-medium shadow-sm shadow-red-500/50">
                                    {totalPending > 9 ? '9+' : totalPending}
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown */}
                        {notifOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-4 border-b border-slate-800">
                                    <h3 className="font-semibold text-white">Notifikasi</h3>
                                </div>
                                <div className="p-2">
                                    {totalPending === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-6">
                                            Tidak ada approval pending
                                        </p>
                                    ) : (
                                        <>
                                            {pendingCounts.faceVerifications > 0 && (
                                                <button
                                                    onClick={() => { navigate('/face-verifications'); setNotifOpen(false); }}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors group"
                                                >
                                                    <div className="p-2 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 text-orange-500 transition-colors">
                                                        <UserCheck size={18} />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="text-sm font-medium text-slate-200">Verifikasi Wajah</p>
                                                        <p className="text-xs text-slate-500">{pendingCounts.faceVerifications} menunggu approval</p>
                                                    </div>
                                                </button>
                                            )}
                                            {pendingCounts.transferRequests > 0 && (
                                                <button
                                                    onClick={() => { navigate('/transfer-requests'); setNotifOpen(false); }}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors group"
                                                >
                                                    <div className="p-2 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 text-blue-500 transition-colors">
                                                        <MapPinned size={18} />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="text-sm font-medium text-slate-200">Pindah Lokasi</p>
                                                        <p className="text-xs text-slate-500">{pendingCounts.transferRequests} menunggu approval</p>
                                                    </div>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                        {user?.avatar_url ? (
                            <img
                                src={getUploadUrl(user.avatar_url)!}
                                alt={user?.name || 'User'}
                                className="w-9 h-9 rounded-full object-cover border-2 border-cyan-500/50 shadow-lg shadow-cyan-900/20"
                            />
                        ) : (
                            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-900/20">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="hidden sm:block">
                            <p className="text-sm font-medium text-white">{user?.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-slate-950 p-6">
                    <Outlet />
                </main>
            </div>

            {/* Logout Confirmation Modal */}
            {logoutModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 transform scale-100 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <LogOut className="text-red-500" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Konfirmasi Logout</h3>
                            <p className="text-slate-400">
                                Apakah <span className="text-white font-medium">{user?.name}</span> yakin ingin logout?
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setLogoutModalOpen(false)}
                                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-900/20"
                            >
                                Ya, Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
