import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { SidharthLogo } from './SidharthLogo';
import { DatabaseArchitectureModal } from './DatabaseArchitectureModal';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Truck,
  RotateCcw,
  User,
  ExternalLink,
  Check,
  Database,
} from 'lucide-react';

export const TopNav: React.FC = () => {
  const {
    currentUser,
    allUsers,
    switchRole,
    setCurrentUser,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    resetDataToDefault,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);

  const roleOptions: { role: UserRole; label: string; prefix: string }[] = [
    { role: 'admin', label: 'Admin (David Vance)', prefix: 'ADM001' },
    { role: 'salesperson', label: 'Salesperson (Vikram Malhotra)', prefix: 'SP001' },
    { role: 'supervisor', label: 'Supervisor (Rajesh Kumar)', prefix: 'SV001' },
    { role: 'logistics', label: 'Logistics Manager (Devendra Patel)', prefix: 'LGP001' },
    { role: 'production', label: 'Production Manager (Sanjay Verma)', prefix: 'PRM001' },
    { role: 'budget', label: 'Budget Manager (Kavita Iyer)', prefix: 'BM001' },
    { role: 'worker', label: 'Worker - Installer (Arun Joshi)', prefix: 'WRK001' },
  ];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value as UserRole;
    switchRole(selectedRole);
  };

  // Helper to get name initials
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const cleanName = name.replace(/\([^)]*\)/g, '').trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Filter notifications relevant to current user
  const userNotifications = notifications.filter((n) =>
    n.targetRoles.includes(currentUser.role)
  );

  return (
    <header className="h-16 px-6 bg-[#10418A] text-white border-b-2 border-[#0D346E] flex items-center justify-between sticky top-0 z-40 shadow-md">
      {/* Zone 1: Brand Wordmark with Sidharth Logo */}
      <div className="flex items-center gap-4">
        <a
          href="#dashboard"
          className="flex items-center gap-3 bg-white/10 hover:bg-white/15 px-3.5 py-1.5 rounded-xl border border-white/20 transition-all shadow-xs"
          title="Sidharth Shutter & Automation Operations Platform"
        >
          <SidharthLogo size="md" variant="light" />
        </a>
      </div>

      {/* Zone 2: Architecture Hub Badge & Active User Profile */}
      <div className="hidden lg:flex items-center gap-4 text-xs">
        <button
          onClick={() => setShowDbModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-all cursor-pointer shadow-xs"
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Sheets + Drive ⇄ SQL Blueprint</span>
        </button>

        <div className="flex items-center gap-2.5 text-xs text-white pl-3 border-l border-white/20">
          <div
            className="w-7 h-7 rounded-full bg-linear-to-br from-white/30 to-white/10 border border-white/40 text-white flex items-center justify-center font-extrabold text-[11px] shadow-xs"
            title={currentUser.name}
          >
            {getInitials(currentUser.name)}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-white font-bold leading-tight truncate max-w-[150px]">{currentUser.name}</span>
            <span className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">
              {currentUser.role.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 3: Actions - Role Switcher & Notifications */}
      <div className="flex items-center gap-3">
        {/* Mobile Database Button */}
        <button
          onClick={() => setShowDbModal(true)}
          className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-300 cursor-pointer"
          title="Database Architecture"
        >
          <Database className="w-4 h-4" />
        </button>

        {/* Role Switcher Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#0C2F63] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white">
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-blue-200 hidden md:inline font-medium">Switch Role:</span>
          <select
            value={currentUser.role}
            onChange={handleRoleChange}
            className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer pr-1"
          >
            {roleOptions.map((opt) => (
              <option key={opt.role} value={opt.role} className="bg-[#10418A] text-white">
                [{opt.prefix}] {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Automated Event Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#00A859] border-2 border-[#10418A] animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white border border-slate-200 text-slate-800 rounded-xl shadow-2xl py-2 z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#10418A]">Automated Event Alerts</h4>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      {unreadNotificationsCount} unread
                    </span>
                  )}
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-[#00A859] hover:underline font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {userNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No active notifications for {currentUser.role}
                  </div>
                ) : (
                  userNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 ${
                        !notif.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {notif.level === 'urgent' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        ) : notif.level === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : notif.level === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-[#10418A] shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-800 truncate">{notif.title}</span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {notif.timestamp.slice(11)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Real-time cross-portal dispatcher</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reset State Helper */}
        <button
          onClick={() => {
            if (window.confirm('Reset sample data to initial state?')) {
              resetDataToDefault();
            }
          }}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:block"
          title="Reset Demo Data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Database Architecture & SQL Migration Modal */}
      <DatabaseArchitectureModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
      />
    </header>
  );
};
