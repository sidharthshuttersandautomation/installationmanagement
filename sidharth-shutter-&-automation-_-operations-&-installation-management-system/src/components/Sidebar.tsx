import React from 'react';
import { useApp } from '../context/AppContext';
import { SidharthLogo } from './SidharthLogo';
import {
  LayoutDashboard,
  HardHat,
  TrendingUp,
  Truck,
  FileText,
  Users,
  DollarSign,
  BarChart3,
  Search,
  Database,
  PlusCircle,
  Eye,
  AlertCircle,
  Clock,
  Award,
  Factory,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
}

const getInitials = (name: string): string => {
  if (!name) return 'U';
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
}) => {
  const { currentUser, unreadNotificationsCount, notifications, activeSites } = useApp();

  const getMenuItems = (): MenuItem[] => {
    switch (currentUser.role) {
      case 'admin':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'active_sites', label: 'Active Sites', icon: HardHat, badge: activeSites.length },
          { id: 'sales_report', label: 'Sales Report', icon: TrendingUp },
          { id: 'logistics_production', label: 'Logistics & Production', icon: Truck },
          { id: 'management_reports', label: 'Management Reports', icon: FileText },
          { id: 'worker_analytics', label: 'Worker & Employee Analytics', icon: Users },
          { id: 'budget_reports', label: 'Budget Reports', icon: DollarSign },
          { id: 'sales_analytics', label: 'Sales Analytics (Reps)', icon: BarChart3 },
          { id: 'field_logs_inspector', label: 'Field Logs Inspector', icon: Search },
          { id: 'master_database', label: 'Master Database', icon: Database },
        ];

      case 'salesperson':
        return [
          { id: 'my_sales', label: 'My Sales', icon: TrendingUp },
          { id: 'log_visit_order', label: 'Log Visit & Order Deal', icon: PlusCircle },
          { id: 'track_progress', label: 'Track Site Progress', icon: Eye },
        ];

      case 'supervisor':
        const pendingVisits = notifications.filter(
          (n) => n.targetRoles.includes('supervisor') && !n.read && n.level === 'urgent'
        ).length;

        return [
          {
            id: 'new_requests',
            label: 'New Installation Requests',
            icon: AlertCircle,
            badge: pendingVisits > 0 ? pendingVisits : undefined,
            badgeColor: 'bg-rose-500',
          },
          { id: 'view_logs_status', label: 'View Logs & Update Status', icon: ClipboardCheck },
          { id: 'handover_dashboard', label: 'Handover Date Dashboard', icon: Clock },
          { id: 'crew_analytics', label: 'Crew Analytics & Availability', icon: Award },
        ];

      case 'logistics':
      case 'production':
        return [
          { id: 'production_tracking', label: 'Production Tracking', icon: Factory },
          { id: 'dispatch_manager', label: 'Dispatch Manager', icon: Truck },
        ];

      case 'budget':
        return [
          { id: 'budget_allocation', label: 'Budget Allocation', icon: DollarSign },
          { id: 'expense_tracker', label: 'Site Expense Tracker', icon: BarChart3 },
          { id: 'delay_budget_impact', label: 'Delay Cost & Impact Analysis', icon: Clock },
          { id: 'contingency_requests', label: 'Contingency Approvals', icon: ShieldCheck },
          { id: 'drive_sheets_ledger', label: 'Drive & Sheets Ledger Sync', icon: Database },
        ];

      case 'worker':
        return [
          { id: 'my_work', label: 'My Work Dashboard', icon: HardHat },
          { id: 'log_daily_tasks', label: 'Log Daily Tasks & Punch Timer', icon: Clock },
        ];

      default:
        return [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside
      className={`bg-[#EBF1F8] border-r border-slate-300 transition-all duration-300 flex flex-col shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header inside Sidebar */}
      <div className="p-3 bg-white border-b border-slate-300 flex items-center justify-between">
        {!isCollapsed ? (
          <div className="px-1 py-0.5">
            <SidharthLogo size="sm" variant="dark" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#10418A] flex items-center justify-center font-black text-white text-xs mx-auto shadow-xs">
            S
          </div>
        )}
      </div>

      {/* Profile Bar in Sidebar - Shows user initials and name (no blue box with ID) */}
      <div className="p-3.5 border-b border-slate-300/80 bg-white/60 flex items-center justify-between">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#10418A] via-[#164e9e] to-[#00A859] text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm ring-2 ring-white"
              title={`${currentUser.name} (${currentUser.role})`}
            >
              {getInitials(currentUser.name)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#10418A] truncate" title={currentUser.name}>
                {currentUser.name}
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate capitalize flex items-center gap-1.5">
                <span>{currentUser.designationTag || currentUser.role.replace('_', ' ')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00A859] inline-block" title="Active Status" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#10418A] via-[#164e9e] to-[#00A859] text-white flex items-center justify-center font-extrabold text-xs mx-auto shadow-sm ring-2 ring-white cursor-pointer"
            title={`${currentUser.name} (${currentUser.role})`}
            onClick={() => setIsCollapsed(false)}
          >
            {getInitials(currentUser.name)}
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#10418A] hover:bg-white transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all group cursor-pointer ${
                isActive
                  ? 'bg-[#10418A] text-white shadow-sm'
                  : 'text-slate-700 hover:text-[#10418A] hover:bg-white/80'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-[#10418A]/70 group-hover:text-[#10418A]'
                }`}
              />

              {!isCollapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}

              {!isCollapsed && item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full text-white ${
                    item.badgeColor || 'bg-[#00A859]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-300/80 bg-white/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="font-semibold text-[#10418A]">Sidharth Shutter</span>
          <span className="font-mono text-[#00A859] font-bold">● Live Portal</span>
        </div>
      )}
    </aside>
  );
};
