import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SiteItem, DailyLogEntry, WorkerProfile, DealItem, DelayReason, DELAY_REASONS } from '../../types';
import { DelayDropdown } from '../DelayDropdown';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import { SiteProgressGauge, BudgetUtilizationMeter, DonutDistributionChart } from '../VisualMeters';
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Truck,
  Users,
  Search,
  ChevronRight,
  MapPin,
  Calendar,
  Building2,
  Building,
  Database,
  Eye,
  ShieldCheck,
  X,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';

interface AdminPortalProps {
  activeTab: string;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ activeTab }) => {
  const { sites, activeSites, masterSites, deals, workers, dailyLogs, updateSiteStatus } = useApp();

  // Excel Drawer state
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('Raw Dataset Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('export');

  // Modal inspection states for Dashboard KPI cards
  const [selectedSiteModal, setSelectedSiteModal] = useState<SiteItem | null>(null);
  const [kpiModalType, setKpiModalType] = useState<'in_progress' | 'on_hold' | 'upcoming' | null>(null);

  // Active Sites Tab state
  const [selectedActiveSiteId, setSelectedActiveSiteId] = useState<string>(
    activeSites[0]?.id || ''
  );

  // Sales Report filters
  const [salesTimePeriod, setSalesTimePeriod] = useState<string>('3 Months');
  const [salesSubTab, setSalesSubTab] = useState<'overview' | 'expenses'>('overview');

  // Management Reports subtab and site filter
  const [mgmtSiteFilter, setMgmtSiteFilter] = useState<string>('all');
  const [mgmtSubTab, setMgmtSubTab] = useState<'production' | 'installation'>('production');

  // Worker Analytics selector
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(workers[0]?.id || 'WRK001');

  // Sales Analytics (Per Salesperson) filter
  const [selectedRepId, setSelectedRepId] = useState<string>('SP001');
  const [repTimePeriod, setRepTimePeriod] = useState<string>('Quarterly');

  // Field Logs Inspector search
  const [inspectorSearch, setInspectorSearch] = useState<string>('');
  const [inspectorSiteFilter, setInspectorSiteFilter] = useState<string>('all');

  // Budget Reports Section selector & Delay filter
  const [budgetSubTab, setBudgetSubTab] = useState<'overview' | 'delay_impact' | 'sheets_drive' | 'site_inspector'>('overview');
  const [adminDelayFilter, setAdminDelayFilter] = useState<DelayReason | 'all'>('all');

  // KPI Calculations
  const totalSalesRevenue = useMemo(() => {
    return deals
      .filter((d) => d.status === 'Confirmed')
      .reduce((sum, d) => sum + d.value, 0);
  }, [deals]);

  const sitesInProgress = useMemo(() => {
    return activeSites.filter((s) => s.status === 'in_progress');
  }, [activeSites]);

  const sitesOnHold = useMemo(() => {
    return activeSites.filter((s) => s.status === 'on_hold');
  }, [activeSites]);

  const upcomingSites = useMemo(() => {
    return activeSites.filter((s) => s.status === 'upcoming');
  }, [activeSites]);

  const totalBudgetSpent = useMemo(() => {
    return sites.reduce((sum, s) => {
      const b = s.budget;
      return sum + (b.spentFood + b.spentTravel + b.spentLodging + b.spentOther);
    }, 0);
  }, [sites]);

  const totalSitesCompleted = useMemo(() => {
    return masterSites.length;
  }, [masterSites]);

  // Open Excel Drawer with preconfigured columns
  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  /* -------------------------------------------------------------------------- */
  /*                             TAB 1: DASHBOARD                               */
  /* -------------------------------------------------------------------------- */
  const renderDashboardTab = () => {
    const siteCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      { key: 'clientName', label: 'Client' },
      { key: 'location', label: 'Location' },
      { key: 'status', label: 'Status' },
      { key: 'progress', label: 'Progress (%)', align: 'right' },
      { key: 'dealValue', label: 'Deal Value ($)', align: 'right', formatForExport: (v) => v || 0 },
      { key: 'targetHandoverDate', label: 'Target Handover' },
    ];

    return (
      <div className="space-y-6">
        {/* Header & Excel Drawer Trigger */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Operations Command Center</h1>
            <p className="text-xs text-slate-600 mt-1">
              Cross-portal executive overview of active contracts, installations, and field budgets.
            </p>
          </div>

          <button
            onClick={() => openExcel('Master Projects Overview', sites, siteCols, 'master_projects')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* 6 Interactive Animated KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KPI 1: Total Sales */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total Confirmed Revenue</span>
              <DollarSign className="w-4 h-4 text-[#00A859]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                ${totalSalesRevenue.toLocaleString()}
              </span>
              <span className="text-xs text-[#00A859] flex items-center font-mono">
                <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Aggregated across all regional sales deals
            </p>
          </div>

          {/* KPI 2: Sites In-Progress (Clickable Card) */}
          <div
            onClick={() => setKpiModalType('in_progress')}
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-[#10418A]/30 hover:bg-blue-50/50 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="group-hover:text-[#10418A] transition-colors">Sites In-Progress</span>
              <HardHat className="w-4 h-4 text-[#10418A]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {sitesInProgress.length}
              </span>
              <span className="text-xs text-[#10418A] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>View Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Click to view live site progress bars & worker rosters
            </p>
          </div>

          {/* KPI 3: Sites On Hold (Clickable Card) */}
          <div
            onClick={() => setKpiModalType('on_hold')}
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-blue-50/50 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="group-hover:text-amber-600 transition-colors">Sites On Hold</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {sitesOnHold.length}
              </span>
              <span className="text-xs text-amber-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Delay Analysis</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Click to inspect hold reasons, last visitor info & issue photos
            </p>
          </div>

          {/* KPI 4: Total Site Budget Spent */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total Field Budget Spent</span>
              <DollarSign className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                ${totalBudgetSpent.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 font-mono">
                of ${(sites.reduce((a, s) => a + s.budget.allocated, 0)).toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Real-time sum of food, travel, lodging & crew expenses
            </p>
          </div>

          {/* KPI 5: Total Sites Completed */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Handed-Over & Archived</span>
              <CheckCircle2 className="w-4 h-4 text-[#00A859]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {totalSitesCompleted}
              </span>
              <span className="text-xs text-[#00A859] font-mono">100% Commissioned</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Archived in Master Database with clean audit trails
            </p>
          </div>

          {/* KPI 6: Upcoming Sites (Interactive Card) */}
          <div
            onClick={() => setKpiModalType('upcoming')}
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-[#1E5BB5]/30 hover:bg-blue-50/50 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="group-hover:text-[#1E5BB5] transition-colors">Upcoming Sites</span>
              <Clock className="w-4 h-4 text-[#1E5BB5]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {upcomingSites.length}
              </span>
              <span className="text-xs text-[#1E5BB5] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Queued Launches</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Click to view expected launch dates & production orders
            </p>
          </div>
        </div>

        {/* Visual Overview: Interactive Donut Chart Distribution */}
        <div className="p-6 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Site Distribution Matrix</h2>
              <p className="text-xs text-slate-600">
                Visual breakdown of Total vs In-Progress vs On Hold vs Completed projects
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Active: {activeSites.length} | Archived: {masterSites.length}
            </span>
          </div>

          <DonutDistributionChart
            total={sites.length}
            inProgress={sitesInProgress.length}
            onHold={sitesOnHold.length}
            completed={masterSites.length}
            upcoming={upcomingSites.length}
          />
        </div>

        {/* Modal for In-Progress, On-Hold, or Upcoming drilldowns */}
        {kpiModalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    {kpiModalType === 'in_progress' && 'In-Progress Sites Detailed Inspector'}
                    {kpiModalType === 'on_hold' && 'On-Hold Sites Delay & Root-Cause Inspector'}
                    {kpiModalType === 'upcoming' && 'Upcoming Sites Pipeline'}
                  </h3>
                </div>
                <button
                  onClick={() => setKpiModalType(null)}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {(kpiModalType === 'in_progress'
                  ? sitesInProgress
                  : kpiModalType === 'on_hold'
                  ? sitesOnHold
                  : upcomingSites
                ).map((site) => (
                  <div
                    key={site.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#10418A]">{site.id}</span>
                          <span className="text-sm font-semibold text-slate-800">{site.name}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {site.clientName} · {site.location} ({site.region})
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-700">
                          Progress: <strong className="text-[#10418A]">{site.progress}%</strong>
                        </span>
                        <span className="text-xs text-slate-600 font-mono">
                          Target: {site.targetHandoverDate}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#10418A] h-full rounded-full transition-all duration-500"
                        style={{ width: `${site.progress}%` }}
                      />
                    </div>

                    {/* Delay info if on hold with interactive DelayDropdown */}
                    {site.status === 'on_hold' && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 text-xs text-amber-900 space-y-2">
                        <DelayDropdown
                          value={(site.holdReason as DelayReason) || 'Client Requested Delay'}
                          onChange={(newReason) => {
                            const newStatus = newReason === 'No Delay' ? 'in_progress' : 'on_hold';
                            updateSiteStatus(
                              site.id,
                              newStatus,
                              site.progress,
                              newReason,
                              site.delayJustification,
                              newReason === 'No Delay' ? 0 : site.delayDays
                            );
                          }}
                          otherRemarks={site.delayJustification}
                          onOtherRemarksChange={(remarks) => {
                            updateSiteStatus(
                              site.id,
                              site.status,
                              site.progress,
                              site.holdReason,
                              remarks,
                              site.delayDays
                            );
                          }}
                          label="Delay Reason Category (Change dropdown to update hold reason)"
                        />
                        {site.delayJustification && (
                          <p className="text-slate-700 pl-2 text-[11px] bg-white p-2 rounded border border-amber-200">
                            <strong>Justification Note:</strong> {site.delayJustification}
                          </p>
                        )}
                        {site.lastVisitorInfo && (
                          <p className="text-slate-500 text-[11px] pl-1 font-mono">
                            Last Visitor: {site.lastVisitorInfo} · Overdue: +{site.delayDays || 0} days
                          </p>
                        )}
                      </div>
                    )}

                    {/* Assigned Workers */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Supervisor:</span>
                        <span className="text-slate-700 font-medium">
                          {site.assignedSupervisorName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Assigned Crew:</span>
                        {site.assignedWorkers.length === 0 ? (
                          <span className="text-slate-500 italic">None currently deployed</span>
                        ) : (
                          <span className="text-slate-700">
                            {site.assignedWorkers.map((w) => `${w.name} (${w.role})`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Photos if any */}
                    {site.photos.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] text-slate-600 mb-1.5 block">Recent Site Photos:</span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {site.photos.map((p) => (
                            <div key={p.id} className="relative group shrink-0">
                              <img
                                src={p.url}
                                alt={p.caption}
                                className="w-24 h-16 object-cover rounded border border-slate-200"
                              />
                              <div className="text-[9px] text-slate-600 mt-0.5 max-w-[96px] truncate">
                                {p.caption}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white flex justify-end">
                <button
                  onClick={() => setKpiModalType(null)}
                  className="px-4 py-2 text-xs bg-slate-800 text-slate-800 rounded-lg hover:bg-slate-700"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                          TAB 2: ACTIVE SITES                               */
  /* -------------------------------------------------------------------------- */
  const renderActiveSitesTab = () => {
    const currentSite = activeSites.find((s) => s.id === selectedActiveSiteId) || activeSites[0];

    const siteCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      { key: 'clientName', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'progress', label: 'Progress (%)', align: 'right' },
      {
        key: 'budget',
        label: 'Budget Allocated ($)',
        align: 'right',
        formatForExport: (b) => b?.allocated || 0,
      },
      {
        key: 'budget',
        label: 'Budget Spent ($)',
        align: 'right',
        formatForExport: (b) =>
          b ? b.spentFood + b.spentTravel + b.spentLodging + b.spentOther : 0,
      },
      { key: 'targetHandoverDate', label: 'Target Handover' },
    ];

    const currentSiteLogs = dailyLogs.filter((l) => l.siteId === currentSite?.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Active Sites Operations Monitor</h1>
            <p className="text-xs text-slate-600 mt-1">
              Live telemetry, real-time meters, daily logs, and workforce rosters for ongoing projects.
            </p>
          </div>

          <button
            onClick={() => openExcel('Active Sites Telemetry', activeSites, siteCols, 'active_sites')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Dynamic Site Selector Dropdown */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-700">Select Ongoing Site:</span>
            <select
              value={selectedActiveSiteId}
              onChange={(e) => setSelectedActiveSiteId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-[#10418A]"
            >
              {activeSites.map((site) => (
                <option key={site.id} value={site.id}>
                  [{site.id}] {site.name} — {site.status.replace('_', ' ').toUpperCase()} ({site.progress}%)
                </option>
              ))}
            </select>
          </div>

          {currentSite && (
            <div className="flex items-center gap-4 text-xs text-slate-600 font-mono">
              <span>Client: <strong className="text-slate-800">{currentSite.clientName}</strong></span>
              <span>Supervisor: <strong className="text-slate-800">{currentSite.assignedSupervisorName}</strong></span>
              <span>Target: <strong className="text-slate-800">{currentSite.targetHandoverDate}</strong></span>
            </div>
          )}
        </div>

        {currentSite && (
          <>
            {/* Site Delay & Hold Management with DelayDropdown */}
            <div className="p-4 rounded-xl bg-white border-2 border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <DelayDropdown
                  value={
                    (currentSite.holdReason as DelayReason) ||
                    (currentSite.status === 'on_hold' ? 'Client Requested Delay' : 'No Delay')
                  }
                  onChange={(newReason) => {
                    const newStatus = newReason === 'No Delay' ? 'in_progress' : 'on_hold';
                    updateSiteStatus(
                      currentSite.id,
                      newStatus,
                      currentSite.progress,
                      newReason,
                      currentSite.delayJustification,
                      newReason === 'No Delay' ? 0 : (currentSite.delayDays || 3)
                    );
                  }}
                  otherRemarks={currentSite.delayJustification}
                  onOtherRemarksChange={(remarks) => {
                    updateSiteStatus(
                      currentSite.id,
                      currentSite.status,
                      currentSite.progress,
                      currentSite.holdReason,
                      remarks,
                      currentSite.delayDays
                    );
                  }}
                  label="Site Delay / Operational Hold Category (Select from Dropdown to update live status)"
                />
              </div>
              <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 md:border-l md:pl-4 border-slate-200">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Operational Status
                  </div>
                  <div
                    className={`text-xs font-black font-mono mt-1 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-2xs ${
                      currentSite.status === 'on_hold'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {currentSite.status === 'on_hold' ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>SITE ON HOLD (+{currentSite.delayDays || 0}d)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ACTIVE ON TRACK</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Meters: Site Progress Gauge & Budget Utilization Meter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Meter 1: Site Progress Gauge */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center">
                <SiteProgressGauge
                  progress={currentSite.progress}
                  status={currentSite.status}
                  label="Live Site Progress Gauge Meter"
                />
              </div>

              {/* Meter 2: Budget Utilization Meter */}
              <div className="md:col-span-2 p-5 rounded-xl bg-white border border-slate-200 flex flex-col justify-center">
                <BudgetUtilizationMeter
                  spent={
                    currentSite.budget.spentFood +
                    currentSite.budget.spentTravel +
                    currentSite.budget.spentLodging +
                    currentSite.budget.spentOther
                  }
                  allocated={currentSite.budget.allocated}
                />

                {/* Sub-breakdown of expenses */}
                <div className="grid grid-cols-4 gap-2 pt-4 mt-2 border-t border-slate-200 text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Food</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      ${currentSite.budget.spentFood.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Travel</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      ${currentSite.budget.spentTravel.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Lodging</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      ${currentSite.budget.spentLodging.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Contingency</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      ${currentSite.budget.contingency.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Logs & Workforce Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Workforce Roster */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#10418A]" />
                    <span>Deployed Workforce</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {currentSite.assignedWorkers.length} workers
                  </span>
                </div>

                {currentSite.assignedWorkers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No workers currently deployed to this site.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/60">
                    {currentSite.assignedWorkers.map((w) => (
                      <div key={w.workerId} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-800">{w.name}</div>
                          <div className="text-[11px] text-slate-600 font-mono">
                            {w.workerId} · {w.role}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          Since {w.deployedSince}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supervisor Notes */}
                <div className="pt-3 border-t border-slate-200 text-xs">
                  <span className="text-slate-600 font-medium block mb-1">Supervisor Notes:</span>
                  <p className="text-slate-700 italic text-[11px] leading-relaxed">
                    "{currentSite.delayJustification || 'Daily progress aligned with technical drawing standards. Civil mounting inspected.'}"
                  </p>
                </div>
              </div>

              {/* Interactive Daily Log Feed */}
              <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Daily Worker Activity Feed & Visual Logs
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {currentSiteLogs.length} logged entries
                  </span>
                </div>

                {currentSiteLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No daily logs recorded yet for this site.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {currentSiteLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{log.workerName}</span>
                            <span className="text-[11px] font-mono text-[#10418A]">
                              ({log.workerRole})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
                            <span>{log.date}</span>
                            <span>{log.startTime} - {log.endTime} ({log.hoursWorked} hrs)</span>
                          </div>
                        </div>

                        <p className="text-slate-700 text-[11px] leading-relaxed">
                          <strong className="text-slate-600">[{log.taskCategory}]:</strong> {log.description}
                        </p>

                        {/* Punch In / Out photos */}
                        {(log.punchInPhoto || log.punchOutPhoto) && (
                          <div className="flex gap-2 pt-1">
                            {log.punchInPhoto && (
                              <div className="text-[10px] text-slate-600">
                                <span>Arrival Punch:</span>
                                <img
                                  src={log.punchInPhoto}
                                  alt="Punch In"
                                  className="w-16 h-12 object-cover rounded border border-slate-200 mt-0.5"
                                />
                              </div>
                            )}
                            {log.punchOutPhoto && (
                              <div className="text-[10px] text-slate-600">
                                <span>Departure Punch:</span>
                                <img
                                  src={log.punchOutPhoto}
                                  alt="Punch Out"
                                  className="w-16 h-12 object-cover rounded border border-slate-200 mt-0.5"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Photo Gallery */}
            {currentSite.photos.length > 0 && (
              <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Live Site Photo Timeline</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {currentSite.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="p-2 text-xs">
                        <p className="font-medium text-slate-700 truncate">{photo.caption}</p>
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {photo.timestamp} · tag: {photo.tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                          TAB 3: SALES REPORT                               */
  /* -------------------------------------------------------------------------- */
  const renderSalesReportTab = () => {
    const timePeriods = ['15 Days', '1 Month', '3 Months', 'Quarterly', '6 Months', '1 Year'];

    const dealCols: ColumnDef<DealItem>[] = [
      { key: 'id', label: 'Deal ID' },
      { key: 'client', label: 'Client' },
      { key: 'siteName', label: 'Project Site' },
      { key: 'region', label: 'Region' },
      { key: 'productCategory', label: 'Category' },
      { key: 'value', label: 'Deal Value ($)', align: 'right' },
      { key: 'status', label: 'Status' },
      { key: 'salespersonName', label: 'Salesperson' },
      { key: 'createdAt', label: 'Created Date' },
    ];

    // Regional breakdown
    const regions = ['Metro', 'North', 'West', 'South', 'Central'];
    const regionalData = regions.map((region) => {
      const regionDeals = deals.filter((d) => d.region === region && d.status === 'Confirmed');
      const total = regionDeals.reduce((a, b) => a + b.value, 0);
      return { region, count: regionDeals.length, total };
    });

    // Product Category breakdown
    const categories = Array.from(new Set(deals.map((d) => d.productCategory)));
    const categoryData = categories.map((cat) => {
      const catDeals = deals.filter((d) => d.productCategory === cat && d.status === 'Confirmed');
      const total = catDeals.reduce((a, b) => a + b.value, 0);
      return { category: cat, count: catDeals.length, total };
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Executive Sales & Analytics Report</h1>
            <p className="text-xs text-slate-600 mt-1">
              Consolidated revenue streams, geographical reach charts, and project daily expense summaries.
            </p>
          </div>

          <button
            onClick={() => openExcel('Sales Deals & Analytics', deals, dealCols, 'sales_report')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Quick Filter Buttons & Sub-Tab Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-600 mr-2">Time Period:</span>
            {timePeriods.map((period) => (
              <button
                key={period}
                onClick={() => setSalesTimePeriod(period)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  salesTimePeriod === period
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setSalesSubTab('overview')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                salesSubTab === 'overview'
                  ? 'bg-slate-800 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales Analytics
            </button>
            <button
              onClick={() => setSalesSubTab('expenses')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                salesSubTab === 'expenses'
                  ? 'bg-slate-800 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Site Expense Summaries
            </button>
          </div>
        </div>

        {salesSubTab === 'overview' ? (
          <>
            {/* Trend KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-600">Total Confirmed Value ({salesTimePeriod})</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    ${totalSalesRevenue.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#00A859] flex items-center font-mono">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +18.4%
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-600">Win Rate / Conversion</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    75.0%
                  </span>
                  <span className="text-xs text-[#00A859] flex items-center font-mono">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +5.2%
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-600">Avg Deal Size</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    ${Math.round(totalSalesRevenue / Math.max(1, deals.filter(d => d.status === 'Confirmed').length)).toLocaleString()}
                  </span>
                  <span className="text-xs text-[#10418A] font-mono">High-Capex Turnkey</span>
                </div>
              </div>
            </div>

            {/* Geographical Sales Reach & Product Category Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Geographical Sales Map / Reach Chart */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#10418A]" />
                    <span>Geographical Sales Reach & Regions</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">Regional Drill-Down</span>
                </div>

                <div className="space-y-3">
                  {regionalData.map((reg) => {
                    const pct = Math.round((reg.total / Math.max(1, totalSalesRevenue)) * 100);
                    return (
                      <div key={reg.region} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium">{reg.region} Region</span>
                          <span className="font-mono text-slate-800">
                            ${reg.total.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#10418A] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Product Category Performance */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#00A859]" />
                    <span>Product Category Breakdown</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">Confirmed Revenue</span>
                </div>

                <div className="space-y-3">
                  {categoryData.map((cat) => {
                    const pct = Math.round((cat.total / Math.max(1, totalSalesRevenue)) * 100);
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium truncate max-w-[200px]">
                            {cat.category}
                          </span>
                          <span className="font-mono text-slate-800">
                            ${cat.total.toLocaleString()} ({cat.count} sites)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Consolidated Site Daily Expense Summaries */
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Site Daily Expense Summaries & Real-Time Burn
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 text-slate-600 font-mono">
                  <tr>
                    <th className="py-2 px-3">Site ID</th>
                    <th className="py-2 px-3">Project Site</th>
                    <th className="py-2 px-3 text-right">Food Spent</th>
                    <th className="py-2 px-3 text-right">Travel Spent</th>
                    <th className="py-2 px-3 text-right">Lodging Spent</th>
                    <th className="py-2 px-3 text-right">Other/Equip</th>
                    <th className="py-2 px-3 text-right">Total Spent</th>
                    <th className="py-2 px-3 text-right">Allocated</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 font-sans">
                  {sites.map((s) => {
                    const totalSpent =
                      s.budget.spentFood +
                      s.budget.spentTravel +
                      s.budget.spentLodging +
                      s.budget.spentOther;
                    const isOver = totalSpent > s.budget.allocated;

                    return (
                      <tr key={s.id} className="hover:bg-blue-50/50">
                        <td className="py-2.5 px-3 font-mono text-[#10418A]">{s.id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{s.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${s.budget.spentFood.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${s.budget.spentTravel.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${s.budget.spentLodging.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${s.budget.spentOther.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ${totalSpent.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ${s.budget.allocated.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                              isOver
                                ? 'bg-rose-500/20 text-rose-600'
                                : 'bg-emerald-500/20 text-[#00A859]'
                            }`}
                          >
                            {isOver ? 'Over Budget' : 'Nominal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                    TAB 4: LOGISTICS & PRODUCTION REPORTS                   */
  /* -------------------------------------------------------------------------- */
  const renderLogisticsProductionTab = () => {
    const trackingCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site' },
      {
        key: 'production',
        label: 'Order ID',
        formatForExport: (p) => p?.orderId || '',
      },
      {
        key: 'production',
        label: 'Mfg Duration (Days)',
        align: 'right',
        formatForExport: (p) => p?.manufacturingDays || 0,
      },
      {
        key: 'production',
        label: 'Build Progress (%)',
        align: 'right',
        formatForExport: (p) => p?.completionPct || 0,
      },
      {
        key: 'production',
        label: 'Target Dispatch Date',
        formatForExport: (p) => p?.targetDispatchDate || '',
      },
      {
        key: 'production',
        label: 'Dispatched?',
        formatForExport: (p) => (p?.isDispatched ? 'Yes' : 'No'),
      },
      {
        key: 'production',
        label: 'Vehicle Reg #',
        formatForExport: (p) => p?.vehicleRegNumber || '—',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Logistics & Production Master Pipeline</h1>
            <p className="text-xs text-slate-600 mt-1">
              Per-site manufacturing progress, lead times, target dispatch schedules, and tracking manifests.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Logistics & Production Pipeline', sites, trackingCols, 'logistics_production')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Per-site tracking cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sites.map((site) => {
            const p = site.production;
            return (
              <div
                key={site.id}
                className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#10418A]">{site.id}</span>
                      <span className="text-sm font-semibold text-slate-800">{site.name}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Delivery to: {site.deliveryAddress}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                      p.isDispatched
                        ? 'bg-emerald-50 text-[#00A859] border border-[#00A859]/30'
                        : 'bg-blue-50 text-[#10418A] border border-[#10418A]/30'
                    }`}
                  >
                    {p.isDispatched ? 'Dispatched' : 'In Manufacturing'}
                  </span>
                </div>

                {/* Specs */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <div className="text-[11px] text-slate-500 mb-0.5">Item Specs & Category:</div>
                  <div className="font-medium text-slate-800">{p.itemSpecs}</div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Production Build Status</span>
                    <span className="font-mono text-slate-800 font-semibold">{p.completionPct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#10418A] h-full rounded-full transition-all duration-500"
                      style={{ width: `${p.completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Dispatch Details */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/80">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Manufacturing Lead Time:</span>
                    <span className="font-mono text-slate-700">{p.manufacturingDays} Days</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Target Dispatch Date:</span>
                    <span className="font-mono text-slate-700">{p.targetDispatchDate}</span>
                  </div>
                </div>

                {/* Tracking info if dispatched */}
                {p.isDispatched && (
                  <div className="p-2.5 rounded bg-slate-50/80 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 text-[11px]">Vehicle: </span>
                      <span className="font-mono text-slate-800 font-medium">
                        {p.vehicleRegNumber || 'In-transit'}
                      </span>
                    </div>
                    {p.trackingUrl && (
                      <a
                        href={p.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#10418A] hover:text-[#10418A] font-semibold flex items-center gap-1 font-mono text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Track Parcel</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                        TAB 5: MANAGEMENT REPORTS                           */
  /* -------------------------------------------------------------------------- */
  const renderManagementReportsTab = () => {
    const filteredSites =
      mgmtSiteFilter === 'all' ? sites : sites.filter((s) => s.id === mgmtSiteFilter);

    const reportCols: ColumnDef<any>[] = [
      { key: 'siteId', label: 'Site ID' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'date', label: 'Date' },
      { key: 'workerName', label: 'Worker' },
      { key: 'taskCategory', label: 'Category' },
      { key: 'hoursWorked', label: 'Hours', align: 'right' },
      { key: 'description', label: 'Log Description' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Executive Management Reports</h1>
            <p className="text-xs text-slate-600 mt-1">
              Site-filtered daily activity feeds, production lead items, and step-by-step installation logs.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Management Field Logs', dailyLogs, reportCols, 'management_daily_logs')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Site Filter Dropdown & Sub-Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-700">Filter By Site:</span>
            <select
              value={mgmtSiteFilter}
              onChange={(e) => setMgmtSiteFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#10418A]"
            >
              <option value="all">All Sites Consolidated</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setMgmtSubTab('production')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                mgmtSubTab === 'production'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sub-Tab 1: Production Details
            </button>
            <button
              onClick={() => setMgmtSubTab('installation')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                mgmtSubTab === 'installation'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sub-Tab 2: Installation Details
            </button>
          </div>
        </div>

        {mgmtSubTab === 'production' ? (
          /* Sub-Tab 1: Production Details */
          <div className="space-y-4">
            {filteredSites.map((site) => {
              const p = site.production;
              return (
                <div
                  key={site.id}
                  className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#10418A]">{site.id}</span>
                        <h3 className="text-base font-semibold text-slate-800">{site.name}</h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">Order ID: {p.orderId}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span>Lead Time: <strong className="text-slate-800">{p.manufacturingDays} Days</strong></span>
                      <span>Target Dispatch: <strong className="text-slate-800">{p.targetDispatchDate}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-slate-600 font-semibold block">Manufacturing Specification:</span>
                      <p className="text-slate-800 leading-relaxed">{p.itemSpecs}</p>
                      <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500 font-mono">
                        <span>Category: {p.productCategory}</span>
                        <span>·</span>
                        <span>Committed: {p.committedDate}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-slate-600 font-semibold block">Dispatch & Fleet Manifest:</span>
                      <div className="space-y-1 text-slate-700">
                        <div>Vehicle Registration: <span className="font-mono text-slate-900">{p.vehicleRegNumber || 'Pending Alignment'}</span></div>
                        <div>Tracking ID: <span className="font-mono text-slate-900">{p.trackingId || 'N/A'}</span></div>
                        <div>Status: <span className="font-mono text-[#10418A]">{p.isDispatched ? 'Dispatched' : 'In Production'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Photos */}
                  {(p.completedProductPhoto || p.vehiclePhoto) && (
                    <div className="pt-2">
                      <span className="text-xs font-medium text-slate-600 block mb-2">Production & Fleet Photos:</span>
                      <div className="flex gap-4 overflow-x-auto pb-1">
                        {p.completedProductPhoto && (
                          <div className="shrink-0">
                            <img
                              src={p.completedProductPhoto}
                              alt="Completed Product"
                              className="w-48 h-32 object-cover rounded-lg border border-slate-200"
                            />
                            <span className="text-[10px] text-slate-600 block mt-1">Completed Product Unit</span>
                          </div>
                        )}
                        {p.vehiclePhoto && (
                          <div className="shrink-0">
                            <img
                              src={p.vehiclePhoto}
                              alt="Dispatch Vehicle"
                              className="w-48 h-32 object-cover rounded-lg border border-slate-200"
                            />
                            <span className="text-[10px] text-slate-600 block mt-1">Loaded Dispatch Vehicle</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Sub-Tab 2: Installation Details */
          <div className="space-y-4">
            {filteredSites.map((site) => {
              const siteLogs = dailyLogs.filter((l) => l.siteId === site.id);
              return (
                <div
                  key={site.id}
                  className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#10418A]">{site.id}</span>
                        <h3 className="text-base font-semibold text-slate-800">{site.name}</h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Supervisor: {site.assignedSupervisorName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#10418A]">{site.progress}%</span>
                      <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#10418A] h-full rounded-full"
                          style={{ width: `${site.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Installation Step Progress */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Step 1</span>
                      <span className="font-semibold text-[#00A859]">Site Survey</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Step 2</span>
                      <span className="font-semibold text-[#00A859]">Civil Mounting</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Step 3</span>
                      <span className="font-semibold text-[#10418A]">Wiring & Electrical</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Step 4</span>
                      <span className="font-semibold text-slate-600">Testing & Handover</span>
                    </div>
                  </div>

                  {/* Logs list */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-600 block">
                      Site Daily Field Logs ({siteLogs.length})
                    </span>
                    {siteLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No logs recorded for this site.</p>
                    ) : (
                      siteLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded bg-slate-50 border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{log.workerName}</span>{' '}
                            <span className="text-slate-600">({log.taskCategory}):</span>{' '}
                            <span className="text-slate-700">{log.description}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 shrink-0">
                            {log.date} · {log.hoursWorked} hrs
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*            TAB 6: WORKER & EMPLOYEE ANALYTICS REPORTS (MERGED)             */
  /* -------------------------------------------------------------------------- */
  const renderWorkerAnalyticsTab = () => {
    const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0];

    const workerCols: ColumnDef<WorkerProfile>[] = [
      { key: 'id', label: 'Worker ID' },
      { key: 'name', label: 'Full Name' },
      { key: 'designation', label: 'Role Designation' },
      { key: 'status', label: 'Availability' },
      { key: 'totalHours', label: 'Total Hours', align: 'right' },
      { key: 'daysWorked', label: 'Days Worked', align: 'right' },
      { key: 'daysTravelled', label: 'Days Travelled', align: 'right' },
      { key: 'sitesVisitedCount', label: 'Sites Visited', align: 'right' },
    ];

    // Compute composite performance score safely
    const safeHours = Number(selectedWorker?.totalHours || 0);
    const safeTravelled = Number(selectedWorker?.daysTravelled || 0);
    const safeWorked = Number(selectedWorker?.daysWorked || 0);
    const perfScore = Math.round(safeHours * 2 + safeTravelled * 15 + safeWorked * 10);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Worker & Employee Analytics Hub</h1>
            <p className="text-xs text-slate-600 mt-1">
              Performance scorecards, supervisor rating history, travel logs, and task efficiency ratings.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Worker Workforce Directory', workers, workerCols, 'worker_workforce_data')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Worker Selector Dropdown */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-700">Select Worker Profile:</span>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-[#10418A]"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.id}] {w.name} — {w.designation} ({w.status})
                </option>
              ))}
            </select>
          </div>

          {selectedWorker && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-600">Total Hours: <strong className="text-[#10418A]">{selectedWorker.totalHours} hrs</strong></span>
              <span className="text-slate-600">Performance Index: <strong className="text-[#00A859]">{perfScore} pts</strong></span>
            </div>
          )}
        </div>

        {selectedWorker && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-500 block">Total Work Hours</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {selectedWorker.totalHours} hrs
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block">
                  {selectedWorker.daysWorked} field days logged
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-500 block">Sites Visited</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {selectedWorker.sitesVisitedCount} Sites
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block">
                  {selectedWorker.onHoldSitesCount} on-hold sites encountered
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-500 block">Travel Engagement</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {selectedWorker.daysTravelled} Transit Days
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block">
                  {selectedWorker.travelHistory.length} recorded transit trips
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <span className="text-xs text-slate-500 block">Current Status</span>
                <span
                  className={`text-xl font-bold font-mono mt-1 block ${
                    selectedWorker.status === 'Deployed'
                      ? 'text-[#10418A]'
                      : 'text-[#00A859]'
                  }`}
                >
                  {selectedWorker.status}
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block truncate">
                  {selectedWorker.currentSiteName || 'Ready for assignment'}
                </span>
              </div>
            </div>

            {/* Supervisor Rating Scorecards */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Supervisor Post-Handover Scorecards & Ratings
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {selectedWorker.ratings.length} formal reviews
                </span>
              </div>

              {selectedWorker.ratings.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No post-handover ratings logged yet for this worker.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedWorker.ratings.map((rating, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{rating.siteName}</span>
                          <span className="text-slate-600 ml-2 font-mono text-[11px]">
                            by {rating.supervisorName} · {rating.date}
                          </span>
                        </div>
                        <span className="text-sm font-bold font-mono text-[#00A859] px-2 py-0.5 rounded bg-emerald-50">
                          {rating.score} / 10
                        </span>
                      </div>

                      {/* 4 Metric sub-scores */}
                      <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                        <div className="p-1.5 rounded bg-white text-center">
                          <span className="text-slate-500 block text-[10px]">Punctuality</span>
                          <span className="text-slate-800">{rating.metrics.punctuality}</span>
                        </div>
                        <div className="p-1.5 rounded bg-white text-center">
                          <span className="text-slate-500 block text-[10px]">Workmanship</span>
                          <span className="text-slate-800">{rating.metrics.workmanship}</span>
                        </div>
                        <div className="p-1.5 rounded bg-white text-center">
                          <span className="text-slate-500 block text-[10px]">Safety (PPE)</span>
                          <span className="text-slate-800">{rating.metrics.safety}</span>
                        </div>
                        <div className="p-1.5 rounded bg-white text-center">
                          <span className="text-slate-500 block text-[10px]">Speed</span>
                          <span className="text-slate-800">{rating.metrics.speed}</span>
                        </div>
                      </div>

                      <p className="text-slate-700 italic text-[11px] pt-1">
                        "{rating.notes}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Travel History */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Travel & Mobility Log</h3>
              {selectedWorker.travelHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No external transit records found.</p>
              ) : (
                <div className="divide-y divide-slate-200 text-xs">
                  {selectedWorker.travelHistory.map((trv) => (
                    <div key={trv.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-800">{trv.from} → {trv.to}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                          Mode: {trv.mode} · Distance: {trv.distanceKm} km
                        </span>
                      </div>
                      <span className="font-mono text-slate-600 text-[11px]">{trv.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                           TAB 7: BUDGET REPORTS                            */
  /* -------------------------------------------------------------------------- */
  const renderBudgetReportsTab = () => {
    const overrunCount = sites.filter(
      (s) =>
        s.budget.spentFood + s.budget.spentTravel + s.budget.spentLodging + s.budget.spentOther >
        s.budget.allocated
    ).length;

    const budgetCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Project Site' },
      {
        key: 'budget',
        label: 'Allocated ($)',
        align: 'right',
        formatForExport: (b) => b?.allocated || 0,
      },
      {
        key: 'budget',
        label: 'Spent Food ($)',
        align: 'right',
        formatForExport: (b) => b?.spentFood || 0,
      },
      {
        key: 'budget',
        label: 'Spent Travel ($)',
        align: 'right',
        formatForExport: (b) => b?.spentTravel || 0,
      },
      {
        key: 'budget',
        label: 'Spent Lodging ($)',
        align: 'right',
        formatForExport: (b) => b?.spentLodging || 0,
      },
      {
        key: 'budget',
        label: 'Contingency ($)',
        align: 'right',
        formatForExport: (b) => b?.contingency || 0,
      },
    ];

    const DAILY_DELAY_BURN_RATE = 1850;
    const totalDelayedDays = sites.reduce((acc, s) => acc + (s.delayDays || 0), 0);
    const totalDelayVarianceCost = totalDelayedDays * DAILY_DELAY_BURN_RATE;

    const filteredDelayedSites = sites.filter((s) => {
      if (adminDelayFilter === 'all') {
        return s.status === 'on_hold' || (s.delayDays && s.delayDays > 0) || s.holdReason;
      }
      return s.holdReason === adminDelayFilter;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Enterprise Budget &amp; Variance Management</h1>
            <p className="text-xs text-slate-600 mt-1">
              Executive budget telemetry, delay-driven cost variance inspection, Google Sheets live sync, and site audits.
            </p>
          </div>

          <button
            onClick={() => openExcel('Budget Reports Dataset', sites, budgetCols, 'budget_reports')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Section Selector Pills */}
        <div className="bg-white border border-slate-200 p-1.5 rounded-xl flex flex-wrap items-center gap-1 shadow-xs">
          <button
            onClick={() => setBudgetSubTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              budgetSubTab === 'overview'
                ? 'bg-[#10418A] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Executive Overview &amp; KPIs</span>
          </button>

          <button
            onClick={() => setBudgetSubTab('delay_impact')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              budgetSubTab === 'delay_impact'
                ? 'bg-[#10418A] text-white shadow-xs ring-2 ring-amber-400/50'
                : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Delay Cost &amp; Impact Analysis</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono">
              Delay Dropdown
            </span>
          </button>

          <button
            onClick={() => setBudgetSubTab('sheets_drive')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              budgetSubTab === 'sheets_drive'
                ? 'bg-[#10418A] text-white shadow-xs ring-2 ring-emerald-400/50'
                : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sheets Sync &amp; Drive Receipts</span>
          </button>

          <button
            onClick={() => setBudgetSubTab('site_inspector')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              budgetSubTab === 'site_inspector'
                ? 'bg-[#10418A] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Site-by-Site Inspector</span>
          </button>
        </div>

        {/* SECTION 1: OVERVIEW */}
        {budgetSubTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-600">Total Confirmed Sales</span>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  ${totalSalesRevenue.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Top-line project order value</p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-600">Total Field Installation Spend</span>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  ${totalBudgetSpent.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Combined operational &amp; travel disbursements
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-600">Delay-Driven Cost Overrun</span>
                <div className="mt-2 text-2xl font-bold font-mono text-rose-600 tabular-nums">
                  ${totalDelayVarianceCost.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  From {totalDelayedDays} crew delay days ($1,850/day)
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-600">Budget Overrun Flag Count</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
                    {overrunCount} Sites
                  </span>
                  <span className="text-xs text-rose-600 flex items-center font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Requires Approval
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sites exceeding baseline budget allocations
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: DELAY IMPACT WITH DELAY DROPDOWN */}
        {budgetSubTab === 'delay_impact' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Filter Delay Variance by Delay Reason</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select a category to pinpoint root-cause financial leaks.
                </p>
              </div>

              <div className="w-full md:w-80">
                <select
                  value={adminDelayFilter}
                  onChange={(e) => setAdminDelayFilter(e.target.value as DelayReason | 'all')}
                  className="w-full bg-slate-50 border-2 border-[#10418A]/40 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#10418A]"
                >
                  <option value="all">🔍 All Delay Reasons ({sites.filter(s => s.status === 'on_hold' || (s.delayDays && s.delayDays > 0)).length} Delayed Projects)</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 'No Delay' ? '🟢 No Delay' : `⚠️ ${r}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Delayed Projects List with DelayDropdown */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900">
                Filtered Delayed Projects ({filteredDelayedSites.length})
              </h3>

              <div className="space-y-3">
                {filteredDelayedSites.map((site) => {
                  const days = site.delayDays || 0;
                  const delayCost = days * DAILY_DELAY_BURN_RATE;

                  return (
                    <div
                      key={site.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#10418A]">{site.id}</span>
                            <span className="text-sm font-bold text-slate-800">{site.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                              {site.status.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 mt-0.5 block">
                            Client: {site.clientName} · Target Handover: {site.targetHandoverDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span>Delay: <strong className="text-amber-700">{days} Days</strong></span>
                          <span>Delay Variance: <strong className="text-rose-600">+${delayCost.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      {/* Interactive DelayDropdown row */}
                      <div className="pt-2 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <span className="text-xs text-slate-600">
                          <strong>Active Hold Category:</strong> {site.holdReason || 'Client Site Unavailability'}
                        </span>
                        <div className="w-full md:w-72">
                          <DelayDropdown
                            value={(site.holdReason as DelayReason) || 'Client Site Unavailability'}
                            onChange={(newReason) => {
                              updateSiteStatus(
                                site.id,
                                site.status,
                                site.progress,
                                newReason,
                                site.delayJustification,
                                site.delayDays
                              );
                            }}
                            label=""
                            showIcon={false}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: SHEETS & DRIVE */}
        {budgetSubTab === 'sheets_drive' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#00A859]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Google Sheets Cloud Sync Status
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ● 2-Way Sync Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                The enterprise budget ledger is automatically synchronized with Google Sheets for accountant access and Google Drive for scanned invoices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs font-bold text-[#10418A] uppercase">Google Drive Receipts Folder</span>
                <p className="text-xs text-slate-600">
                  All technician vouchers, food allowances, and hotel invoices are archived with cryptographic SHA256 hashes.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-500">
                  📁 /Sidharth_Shutter/Budget_Receipts_2026/
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs font-bold text-[#00A859] uppercase">Future SQL Migration Ready</span>
                <p className="text-xs text-slate-600">
                  Relational table schema is prepared for PostgreSQL / Cloud SQL double-entry ledger integration.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-500">
                  🗄️ Table: site_budget_allocations
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SITE-BY-SITE INSPECTOR (OR DEFAULT OVERVIEW FALLBACK) */}
        {(budgetSubTab === 'overview' || budgetSubTab === 'site_inspector') && (
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900">Site-by-Site Budget Inspector</h3>

            <div className="space-y-4">
              {sites.map((site) => {
                const b = site.budget;
                const totalSpent = b.spentFood + b.spentTravel + b.spentLodging + b.spentOther;
                const variance = b.allocated - totalSpent;
                const isOver = variance < 0;

                return (
                  <div
                    key={site.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#10418A]">{site.id}</span>
                          <span className="text-sm font-semibold text-slate-800">{site.name}</span>
                        </div>
                        <span className="text-xs text-slate-600 mt-0.5 block">
                          Client: {site.clientName} · Handover: {site.targetHandoverDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span>Allocated: <strong className="text-slate-700">${b.allocated.toLocaleString()}</strong></span>
                        <span>Spent: <strong className={isOver ? 'text-rose-600' : 'text-slate-900'}>${totalSpent.toLocaleString()}</strong></span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            isOver ? 'bg-rose-500/20 text-rose-600' : 'bg-emerald-500/20 text-[#00A859]'
                          }`}
                        >
                          Variance: {isOver ? `-$${Math.abs(variance).toLocaleString()}` : `+$${variance.toLocaleString()}`}
                        </span>
                      </div>
                    </div>

                    {/* Over-budget justifications if any */}
                    {b.contingencyJustification && (
                      <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <strong>Contingency Justification:</strong> {b.contingencyJustification}
                        {b.contingencyApproved ? (
                          <span className="ml-2 text-[#00A859] font-mono">[Approved by Budget Mgr]</span>
                        ) : (
                          <span className="ml-2 text-amber-600 font-mono">[Pending Review]</span>
                        )}
                      </div>
                    )}

                    {/* Itemized expenses grid */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-slate-500 text-[10px] block">Food</span>
                        <span className="font-mono text-slate-800">${b.spentFood.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-slate-500 text-[10px] block">Travel</span>
                        <span className="font-mono text-slate-800">${b.spentTravel.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-slate-500 text-[10px] block">Lodging</span>
                        <span className="font-mono text-slate-800">${b.spentLodging.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-slate-500 text-[10px] block">Contingency Pool</span>
                        <span className="font-mono text-slate-800">${b.contingency.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                  TAB 8: SALES ANALYTICS (PER SALESPERSON)                  */
  /* -------------------------------------------------------------------------- */
  const renderSalesAnalyticsTab = () => {
    const salesReps = [
      { id: 'SP001', name: 'Vikram Malhotra', target: 200000 },
      { id: 'SP002', name: 'Ananya Roy', target: 180000 },
    ];

    const currentRep = salesReps.find((r) => r.id === selectedRepId) || salesReps[0];
    const repDeals = deals.filter((d) => d.salespersonId === currentRep.id);
    const confirmedDeals = repDeals.filter((d) => d.status === 'Confirmed');
    const closedRevenue = confirmedDeals.reduce((a, b) => a + b.value, 0);
    const conversionRate = Math.round(
      (confirmedDeals.length / Math.max(1, repDeals.length)) * 100
    );

    const dealCols: ColumnDef<DealItem>[] = [
      { key: 'id', label: 'Deal ID' },
      { key: 'client', label: 'Client' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'value', label: 'Value ($)', align: 'right' },
      { key: 'status', label: 'Status' },
      { key: 'productCategory', label: 'Category' },
      { key: 'createdAt', label: 'Date' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sales Representative Performance</h1>
            <p className="text-xs text-slate-600 mt-1">
              Targets vs actual performance charts, conversion rates, and closed contract portfolios.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel(`${currentRep.name} Closed Deals`, repDeals, dealCols, 'rep_sales_analytics')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Select Salesperson:</span>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#10418A]"
              >
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.id}] {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Period:</span>
              <select
                value={repTimePeriod}
                onChange={(e) => setRepTimePeriod(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#10418A]"
              >
                <option value="1 Month">Last Month</option>
                <option value="Quarterly">Current Quarter</option>
                <option value="1 Year">Full Year</option>
              </select>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-600">
            Total Pipeline Deals: <strong className="text-slate-800">{repDeals.length}</strong>
          </span>
        </div>

        {/* Target vs Actual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600">Closed Sales Revenue</span>
            <div className="mt-2 text-2xl font-bold font-mono text-[#00A859] tabular-nums">
              ${closedRevenue.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Target: ${currentRep.target.toLocaleString()} ({Math.round((closedRevenue / currentRep.target) * 100)}% achieved)
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600">Conversion Rate</span>
            <div className="mt-2 text-2xl font-bold font-mono text-[#10418A] tabular-nums">
              {conversionRate}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {confirmedDeals.length} won / {repDeals.length} total opportunities
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600">Quarterly Target Quota</span>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
              ${currentRep.target.toLocaleString()}
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (closedRevenue / currentRep.target) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Closed Deal Cards */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Deals & Opportunities Portfolio ({currentRep.name})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {repDeals.map((deal) => (
              <div
                key={deal.id}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{deal.siteName}</span>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                      deal.status === 'Confirmed'
                        ? 'bg-emerald-500/20 text-[#00A859]'
                        : deal.status === 'Lost'
                        ? 'bg-rose-500/20 text-rose-600'
                        : 'bg-amber-500/20 text-amber-600'
                    }`}
                  >
                    {deal.status}
                  </span>
                </div>
                <div className="text-slate-600">Client: {deal.client} · {deal.location}</div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <span className="font-mono text-slate-700 font-semibold">${deal.value.toLocaleString()}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{deal.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                 TAB 9: ADVANCED FIELD LOGS INSPECTOR                       */
  /* -------------------------------------------------------------------------- */
  const renderFieldLogsInspectorTab = () => {
    const filteredLogs = dailyLogs.filter((log) => {
      const matchesSearch =
        inspectorSearch === '' ||
        log.workerName.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
        log.siteName.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
        log.description.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
        log.taskCategory.toLowerCase().includes(inspectorSearch.toLowerCase());

      const matchesSite = inspectorSiteFilter === 'all' || log.siteId === inspectorSiteFilter;

      return matchesSearch && matchesSite;
    });

    const inspectorCols: ColumnDef<DailyLogEntry>[] = [
      { key: 'id', label: 'Log ID' },
      { key: 'siteId', label: 'Site ID' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'date', label: 'Date' },
      { key: 'workerName', label: 'Worker Name' },
      { key: 'workerRole', label: 'Worker Role' },
      { key: 'taskCategory', label: 'Task Category' },
      { key: 'hoursWorked', label: 'Hours', align: 'right' },
      { key: 'startTime', label: 'Start' },
      { key: 'endTime', label: 'End' },
      { key: 'description', label: 'Description' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Master Field Logs Inspector</h1>
            <p className="text-xs text-slate-600 mt-1">
              Complete audit trail across all historical datasets, sales reps, workers deployed, and photo timelines.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Master Field Audit Log', dailyLogs, inspectorCols, 'master_field_audit_trail')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Search & Site filter */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={inspectorSearch}
              onChange={(e) => setInspectorSearch(e.target.value)}
              placeholder="Search across workers, task types, notes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Filter Site:</span>
            <select
              value={inspectorSiteFilter}
              onChange={(e) => setInspectorSiteFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#10418A]"
            >
              <option value="all">All Sites (Past & Present)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit trail list */}
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const relatedSite = sites.find((s) => s.id === log.siteId);

            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#10418A]">{log.siteId}</span>
                      <span className="font-semibold text-slate-800">{log.siteName}</span>
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      Worker: <strong className="text-slate-700">{log.workerName}</strong> ({log.workerRole}) · Sales Rep:{' '}
                      <strong className="text-slate-700">{relatedSite?.salespersonName || 'Unassigned'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
                    <span>{log.date}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-800">
                      {log.startTime} - {log.endTime} ({log.hoursWorked} hrs)
                    </span>
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                  <strong className="text-[#10418A]">[{log.taskCategory}]:</strong> {log.description}
                </p>

                {/* Photos if present */}
                {(log.punchInPhoto || log.punchOutPhoto) && (
                  <div className="flex gap-4 pt-1">
                    {log.punchInPhoto && (
                      <div>
                        <span className="text-[10px] text-slate-500 block">Arrival Punch Photo:</span>
                        <img
                          src={log.punchInPhoto}
                          alt="Punch In"
                          className="w-24 h-16 object-cover rounded border border-slate-200 mt-1"
                        />
                      </div>
                    )}
                    {log.punchOutPhoto && (
                      <div>
                        <span className="text-[10px] text-slate-500 block">Departure Punch Photo:</span>
                        <img
                          src={log.punchOutPhoto}
                          alt="Punch Out"
                          className="w-24 h-16 object-cover rounded border border-slate-200 mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                         TAB 10: MASTER DATABASE                            */
  /* -------------------------------------------------------------------------- */
  const renderMasterDatabaseTab = () => {
    const masterCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Project Name' },
      { key: 'clientName', label: 'Client' },
      { key: 'location', label: 'Location' },
      { key: 'dealValue', label: 'Contract Value ($)', align: 'right' },
      {
        key: 'budget',
        label: 'Budget Allocated ($)',
        align: 'right',
        formatForExport: (b) => b?.allocated || 0,
      },
      {
        key: 'budget',
        label: 'Final Team Spend ($)',
        align: 'right',
        formatForExport: (b) =>
          b ? b.spentFood + b.spentTravel + b.spentLodging + b.spentOther : 0,
      },
      { key: 'actualHandoverDate', label: 'Handover Date' },
      { key: 'handoverRatingAvg', label: 'Supervisor Rating Avg', align: 'center' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Central Master Database (Archived Projects)</h1>
            <p className="text-xs text-slate-600 mt-1">
              Permanent central archive of all completed, handed-over, and decommissioned customer projects.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Master Archive Database', masterSites, masterCols, 'master_archive_database')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Master archived list */}
        <div className="space-y-4">
          {masterSites.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              No handed-over projects archived yet.
            </div>
          ) : (
            masterSites.map((site) => {
              const b = site.budget;
              const totalSpent = b.spentFood + b.spentTravel + b.spentLodging + b.spentOther;

              return (
                <div
                  key={site.id}
                  className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#00A859]">ARCHIVED</span>
                        <span className="text-xs font-mono text-slate-500">[{site.id}]</span>
                        <h3 className="text-base font-semibold text-slate-900">{site.name}</h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {site.clientName} · {site.deliveryAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-[#00A859] font-semibold px-2 py-0.5 rounded bg-emerald-50">
                        Handover: {site.actualHandoverDate}
                      </span>
                      <span className="text-[#10418A]">
                        Score: {site.handoverRatingAvg || 9.5} / 10
                      </span>
                    </div>
                  </div>

                  {/* Financials & Team */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Contract Value</span>
                      <span className="font-mono text-slate-900 font-semibold text-sm">
                        ${site.dealValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Final Field Spend</span>
                      <span className="font-mono text-slate-900 font-semibold text-sm">
                        ${totalSpent.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Supervisor Lead</span>
                      <span className="text-slate-800 font-medium">
                        {site.assignedSupervisorName}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Sales Representative</span>
                      <span className="text-slate-800 font-medium">{site.salespersonName}</span>
                    </div>
                  </div>

                  {/* Handover notes */}
                  {site.handoverNotes && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <strong className="text-slate-600">Final Handover Notes:</strong> {site.handoverNotes}
                    </div>
                  )}

                  {/* Photo attachments */}
                  {site.photos.length > 0 && (
                    <div>
                      <span className="text-[11px] text-slate-600 block mb-1">Commissioning Photos:</span>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {site.photos.map((p) => (
                          <div key={p.id} className="shrink-0">
                            <img
                              src={p.url}
                              alt={p.caption}
                              className="w-28 h-20 object-cover rounded border border-slate-200"
                            />
                            <span className="text-[10px] text-slate-600 block mt-0.5 truncate max-w-[112px]">
                              {p.caption}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'active_sites' && renderActiveSitesTab()}
      {activeTab === 'sales_report' && renderSalesReportTab()}
      {activeTab === 'logistics_production' && renderLogisticsProductionTab()}
      {activeTab === 'management_reports' && renderManagementReportsTab()}
      {activeTab === 'worker_analytics' && renderWorkerAnalyticsTab()}
      {activeTab === 'budget_reports' && renderBudgetReportsTab()}
      {activeTab === 'sales_analytics' && renderSalesAnalyticsTab()}
      {activeTab === 'field_logs_inspector' && renderFieldLogsInspectorTab()}
      {activeTab === 'master_database' && renderMasterDatabaseTab()}

      {/* Universal Dynamic Excel Drawer */}
      <ExcelDrawer
        isOpen={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={excelTitle}
        subtitle="Dynamic tabular view with full-text search, column filters, and 1-click Excel download."
        data={excelData}
        columns={excelColumns}
        exportFileName={excelFileName}
      />
    </div>
  );
};
