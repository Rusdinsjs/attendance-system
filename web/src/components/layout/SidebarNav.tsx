import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Types
export interface NavItemConfig {
    id: string;
    icon: LucideIcon;
    label: string;
}

export interface NavGroupConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    children: NavItemConfig[];
    showBadge?: boolean;
}

export type NavEntry = NavItemConfig | NavGroupConfig;

export const isNavGroup = (entry: NavEntry): entry is NavGroupConfig => {
    return 'children' in entry;
};

// NavItem Component
interface SidebarNavItemProps {
    item: NavItemConfig;
    isActive: boolean;
    onClick: () => void;
    collapsed?: boolean;
}

export function SidebarNavItem({ item, isActive, onClick, collapsed = false }: SidebarNavItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
        >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
        </button>
    );
}

// NavGroup Component
interface SidebarNavGroupProps {
    group: NavGroupConfig;
    activeTab: string;
    isOpen: boolean;
    collapsed?: boolean;
    badgeCount?: number;
    childBadges?: Record<string, number>;
    onToggle: () => void;
    onItemClick: (id: string) => void;
}

export function SidebarNavGroup({
    group,
    activeTab,
    isOpen,
    collapsed = false,
    badgeCount = 0,
    childBadges = {},
    onToggle,
    onItemClick,
}: SidebarNavGroupProps) {
    const isChildActive = group.children.some(child => activeTab === child.id);

    return (
        <div>
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isChildActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'
                    }`}
            >
                <group.icon size={20} />
                {!collapsed && (
                    <>
                        <span className="flex-1 text-left">{group.label}</span>
                        {group.showBadge && badgeCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {badgeCount}
                            </span>
                        )}
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </>
                )}
            </button>
            {isOpen && !collapsed && (
                <div className="ml-4 mt-1 space-y-1">
                    {group.children.map(child => (
                        <button
                            key={child.id}
                            onClick={() => onItemClick(child.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${activeTab === child.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                }`}
                        >
                            <child.icon size={16} />
                            <span className="flex-1 text-left">{child.label}</span>
                            {childBadges[child.id] && childBadges[child.id] > 0 && (
                                <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                    {childBadges[child.id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
