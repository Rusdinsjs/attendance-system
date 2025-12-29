
// Admin Dashboard - Main Container
import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminAPI, getUploadUrl } from '../api/client';
import {
    LayoutDashboard, Users, FileText, LogOut, Menu, X,
    UserCheck, MapPinned, Settings, Building, Bell,
    ChevronDown, ChevronRight, ClipboardCheck, Cog, Monitor, Briefcase
} from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import UserAvatar from '../components/UserAvatar';
import ConfirmLogoutModal from '../components/ConfirmLogoutModal';

// Import all sub-pages as components
// Import all sub-pages as components
const DashboardView = lazy(() => import('../views/admin/DashboardView'));
const UsersView = lazy(() => import('../views/admin/UsersView'));
const ReportsView = lazy(() => import('../views/admin/ReportsView'));
const FaceVerificationView = lazy(() => import('../views/admin/FaceVerificationView'));
const TransferRequestsView = lazy(() => import('../views/admin/TransferRequestsView'));
const OfficeView = lazy(() => import('../views/admin/OfficeView'));
const KioskManagementView = lazy(() => import('../views/admin/KioskManagementView'));
const SettingsView = lazy(() => import('../views/admin/SettingsView'));
const EmployeeView = lazy(() => import('../views/admin/EmployeeView'));

// Define the available tabs
type TabId =
    | 'dashboard'
    | 'employees'
    | 'users'
    | 'face-verifications'
    | 'transfer-requests'
    | 'reports'
    | 'offices'
    | 'kiosks'
    | 'settings';

interface NavItem {
    id: TabId;
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

// Navigation structure
const navItems: NavEntry[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'employees', icon: Briefcase, label: 'Data Karyawan' },
    { id: 'users', icon: Users, label: 'Users' },
    {
        id: 'approval',
        label: 'Approval',
        icon: ClipboardCheck,
        showBadge: true,
        children: [
            { id: 'face-verifications', icon: UserCheck, label: 'Verifikasi Wajah' },
            { id: 'transfer-requests', icon: MapPinned, label: 'Pindah Lokasi' },
        ]
    },
    { id: 'reports', icon: FileText, label: 'Reports' },
    {
        id: 'settings_group',
        label: 'Pengaturan',
        icon: Settings,
        children: [
            { id: 'offices', icon: Building, label: 'Lokasi Kantor' },
            { id: 'kiosks', icon: Monitor, label: 'Manajemen Kiosk' },
            { id: 'settings', icon: Cog, label: 'System' },
        ]
    },
];

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ approval: true, settings_group: false });
    const [notifOpen, setNotifOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    // Data states
    const [pendingCounts, setPendingCounts] = useState({ faceVerifications: 0, transferRequests: 0 });
    const [companySettings, setCompanySettings] = useState<{ name: string; logo: string | null }>({ name: 'AttendX', logo: null });

    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

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

    // Render Navigation Item
    const renderNavItem = (item: NavItem) => (
        <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === item.id
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-300 hover:bg-slate-800'
                }`}
        >
            <item.icon size={20} />
            {sidebarOpen && <span>{item.label}</span>}
        </button>
    );

    // Render Navigation Group
    const renderNavGroup = (group: NavGroup) => {
        const isChildActive = group.children.some(child => activeTab === child.id);
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
                            <button
                                key={child.id}
                                onClick={() => setActiveTab(child.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${activeTab === child.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                    }`}
                            >
                                <child.icon size={16} />
                                <span className="flex-1 text-left">{child.label}</span>
                                {child.id === 'face-verifications' && pendingCounts.faceVerifications > 0 && (
                                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {pendingCounts.faceVerifications}
                                    </span>
                                )}
                                {child.id === 'transfer-requests' && pendingCounts.transferRequests > 0 && (
                                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {pendingCounts.transferRequests}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Render Content based on Active Tab
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardView />;
            case 'employees': return <EmployeeView />;
            case 'users': return <UsersView />;
            case 'face-verifications': return <FaceVerificationView />;
            case 'transfer-requests': return <TransferRequestsView />;
            case 'reports': return <ReportsView />;
            case 'offices': return <OfficeView />;
            case 'kiosks': return <KioskManagementView />;
            case 'settings': return <SettingsView />;
            default: return <DashboardView />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex font-sans text-slate-200">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    bg-slate-900 border-r border-slate-800 text-white 
                    transition-all duration-300 ease-in-out flex flex-col
                    ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
                `}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    {/* Show Logo when Open OR on Mobile (since it's a drawer) */}
                    {(sidebarOpen || window.innerWidth < 1024) && (
                        companySettings.logo ? (
                            <div className="flex items-center gap-3">
                                <img src={getUploadUrl(companySettings.logo)!} alt="Logo" className="w-8 h-8 object-contain rounded" />
                                <span className="text-lg font-bold text-white truncate max-w-[140px]">{companySettings.name}</span>
                            </div>
                        ) : (
                            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                {companySettings.name}
                            </span>
                        )
                    )}

                    {/* Desktop Toggle Button (Inside Sidebar) */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white hidden lg:block ml-auto"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white lg:hidden ml-auto"
                    >
                        <X size={20} />
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
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 gap-4">

                    {/* Mobile Toggle Button */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white lg:hidden"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1" /> {/* Spacer */}

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
                                                    onClick={() => { setActiveTab('face-verifications'); setNotifOpen(false); }}
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
                                                    onClick={() => { setActiveTab('transfer-requests'); setNotifOpen(false); }}
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
                        <UserAvatar
                            name={user?.name}
                            avatarUrl={user?.avatar_url}
                            size="md"
                        />
                        <div className="hidden sm:block">
                            <p className="text-sm font-medium text-white">{user?.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </header>

                {/* Main Content Pane */}
                <main className="flex-1 overflow-auto bg-slate-950 p-6">
                    <ErrorBoundary>
                        <Suspense fallback={
                            <div className="flex h-full items-center justify-center text-slate-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mb-3"></div>
                                <span className="ml-3">Loading...</span>
                            </div>
                        }>
                            {renderContent()}
                        </Suspense>
                    </ErrorBoundary>
                </main>
            </div>

            {/* Logout Confirmation Modal */}
            <ConfirmLogoutModal
                isOpen={logoutModalOpen}
                userName={user?.name}
                onCancel={() => setLogoutModalOpen(false)}
                onConfirm={confirmLogout}
            />
        </div>
    );
}
