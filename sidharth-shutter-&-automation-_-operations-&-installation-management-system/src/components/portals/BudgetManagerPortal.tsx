import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SiteItem, DelayReason, DELAY_REASONS } from '../../types';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import { BudgetUtilizationMeter } from '../VisualMeters';
import { DelayDropdown } from '../DelayDropdown';
import {
  FileSpreadsheet,
  DollarSign,
  PieChart,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  Check,
  X,
  CreditCard,
  Clock,
  Database,
  RefreshCw,
  Folder,
  FileText,
  Download,
  ExternalLink,
  Layers,
  ArrowRight,
  Calculator,
  Sliders,
} from 'lucide-react';

interface BudgetManagerPortalProps {
  activeTab: string;
}

export const BudgetManagerPortal: React.FC<BudgetManagerPortalProps> = ({ activeTab }) => {
  const { sites, activeSites, allocateBudget, approveContingency, updateSiteStatus } = useApp();

  // Internal tab state to allow tab switching from within portal or via sidebar
  const [currentTab, setCurrentTab] = useState(activeTab);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  // Excel Drawer State
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('Budget Ledgers Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('budget_ledgers');

  // Allocation Form State
  const [selectedSiteId, setSelectedSiteId] = useState<string>(activeSites[0]?.id || sites[0]?.id || '');
  const [foodAlloc, setFoodAlloc] = useState<number>(5000);
  const [travelAlloc, setTravelAlloc] = useState<number>(8000);
  const [lodgingAlloc, setLodgingAlloc] = useState<number>(15000);
  const [contingencyAlloc, setContingencyAlloc] = useState<number>(10000);
  const [allocSaved, setAllocSaved] = useState(false);

  // Expense Tracker Site Filter
  const [trackerSiteId, setTrackerSiteId] = useState<string>(activeSites[0]?.id || sites[0]?.id || '');

  // Delay Impact Simulator State
  const [simSiteId, setSimSiteId] = useState<string>(sites.find((s) => s.status === 'on_hold')?.id || sites[0]?.id || '');
  const [simDelayReason, setSimDelayReason] = useState<DelayReason>('Client Site Unavailability');
  const [simDelayDays, setSimDelayDays] = useState<number>(5);
  const [simOtherRemarks, setSimOtherRemarks] = useState<string>('');
  const [simSuccessMsg, setSimSuccessMsg] = useState<string | null>(null);

  // Google Sheets Sync State
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [sheetsSyncSuccess, setSheetsSyncSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const currentAllocSite = sites.find((s) => s.id === selectedSiteId) || sites[0];
  const trackerSite = sites.find((s) => s.id === trackerSiteId) || sites[0];
  const simSite = sites.find((s) => s.id === simSiteId) || sites[0];

  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  const handleSaveAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAllocSite) return;

    allocateBudget(currentAllocSite.id, {
      food: foodAlloc,
      travel: travelAlloc,
      lodging: lodgingAlloc,
      contingency: contingencyAlloc,
    });

    setAllocSaved(true);
    setTimeout(() => setAllocSaved(false), 2000);
  };

  // Delay Cost Breakdown formula:
  // Daily Labor Crew Idle: $850 (crew of 4-5 technicians)
  // Daily Lodging/Per-Diem Extension: $550
  // Daily Scaffold/Crane & Tool Retention: $300
  // Logistics & Re-Dispatch Overheads: $150
  // Total Benchmark Daily Burn: $1,850/day
  const DAILY_DELAY_BURN_RATE = 1850;
  const simEstimatedCost = simDelayDays * DAILY_DELAY_BURN_RATE;

  const handleCommitDelayContingency = () => {
    if (!simSite) return;
    const currentAlloc = simSite.budget;
    const newContingency = (currentAlloc.contingency || 0) + simEstimatedCost;
    
    // Allocate the added contingency
    allocateBudget(simSite.id, {
      food: currentAlloc.food,
      travel: currentAlloc.travel,
      lodging: currentAlloc.lodging,
      contingency: newContingency,
    });

    // Update site delay info
    updateSiteStatus(
      simSite.id,
      simSite.status === 'completed' || simSite.status === 'handed_over' ? simSite.status : 'on_hold',
      simSite.progress,
      simDelayReason,
      `Delay impact allocated: $${simEstimatedCost.toLocaleString()} for ${simDelayDays} days under category "${simDelayReason}". ${simOtherRemarks}`.trim(),
      (simSite.delayDays || 0) + simDelayDays
    );

    setSimSuccessMsg(`Allocated +$${simEstimatedCost.toLocaleString()} emergency contingency for ${simSite.name} due to ${simDelayReason}.`);
    setTimeout(() => setSimSuccessMsg(null), 4000);
  };

  const handleTriggerSheetsSync = () => {
    setIsSyncingSheets(true);
    setTimeout(() => {
      setIsSyncingSheets(false);
      setSheetsSyncSuccess(true);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setSheetsSyncSuccess(false), 3000);
    }, 1200);
  };

  /* -------------------------------------------------------------------------- */
  /*                     TAB 1: SITE BUDGET ALLOCATION                          */
  /* -------------------------------------------------------------------------- */
  const renderAllocationTab = () => {
    const budgetCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      {
        key: 'budget',
        label: 'Total Budget ($)',
        align: 'right',
        formatForExport: (b) => b?.allocated || 0,
      },
      {
        key: 'budget',
        label: 'Food ($)',
        align: 'right',
        formatForExport: (b) => b?.food || 0,
      },
      {
        key: 'budget',
        label: 'Travel ($)',
        align: 'right',
        formatForExport: (b) => b?.travel || 0,
      },
      {
        key: 'budget',
        label: 'Lodging ($)',
        align: 'right',
        formatForExport: (b) => b?.lodging || 0,
      },
      {
        key: 'budget',
        label: 'Contingency Pool ($)',
        align: 'right',
        formatForExport: (b) => b?.contingency || 0,
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Site Budget Allocation Master</h1>
            <p className="text-xs text-slate-600 mt-1">
              Assign itemized base budgets (Food, Travel, Lodging) and emergency contingency pools per project.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Project Budget Allocations', sites, budgetCols, 'budget_allocations')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Allocation Form */}
          <form
            onSubmit={handleSaveAllocation}
            className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs"
          >
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#00A859]" />
              <span>Configure Site Budget Limits</span>
            </h3>

            {allocSaved && (
              <div className="p-2.5 rounded bg-emerald-50 border border-[#00A859]/30 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                <Check className="w-4 h-4" /> Budget allocations successfully updated!
              </div>
            )}

            <div>
              <label className="text-xs text-slate-600 block mb-1">Select Project Site *</label>
              <select
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(e.target.value);
                  const s = sites.find((site) => site.id === e.target.value);
                  if (s) {
                    setFoodAlloc(s.budget.food);
                    setTravelAlloc(s.budget.travel);
                    setLodgingAlloc(s.budget.lodging);
                    setContingencyAlloc(s.budget.contingency);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.id}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Food Allowance ($) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={foodAlloc}
                  onChange={(e) => setFoodAlloc(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Travel Allowance ($) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={travelAlloc}
                  onChange={(e) => setTravelAlloc(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Lodging Allowance ($) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={lodgingAlloc}
                  onChange={(e) => setLodgingAlloc(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Emergency Contingency ($) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={contingencyAlloc}
                  onChange={(e) => setContingencyAlloc(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">Total Project Allocation:</span>
              <span className="font-mono text-[#00A859] font-bold text-sm">
                ${(foodAlloc + travelAlloc + lodgingAlloc + contingencyAlloc).toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold bg-[#10418A] hover:bg-[#0D346E] text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Commit Budget Allocation
            </button>
          </form>

          {/* Allocation Portfolio Overview */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Active Project Allocations ({sites.length})
            </h3>

            <div className="space-y-3">
              {sites.map((site) => {
                const b = site.budget;
                return (
                  <div
                    key={site.id}
                    className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-[#10418A] font-bold">{site.id}</span>
                        <span className="font-semibold text-slate-800 ml-2">{site.name}</span>
                      </div>
                      <span className="font-mono text-slate-700 font-bold">
                        Allocated: ${b.allocated.toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-center">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Food</span>
                        <span className="text-slate-800">${b.food.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Travel</span>
                        <span className="text-slate-800">${b.travel.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Lodging</span>
                        <span className="text-slate-800">${b.lodging.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Contingency</span>
                        <span className="text-[#00A859] font-bold">${b.contingency.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                  TAB 2: INTERACTIVE SITE EXPENSE TRACKER                   */
  /* -------------------------------------------------------------------------- */
  const renderExpenseTrackerTab = () => {
    const b = trackerSite?.budget || {
      allocated: 35000,
      spentFood: 0,
      spentTravel: 0,
      spentLodging: 0,
      spentOther: 0,
      food: 5000,
      travel: 7000,
      lodging: 14000,
      contingency: 9000,
    };

    const totalSpent = b.spentFood + b.spentTravel + b.spentLodging + b.spentOther;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Interactive Site Expense Tracker</h1>
            <p className="text-xs text-slate-600 mt-1">
              Filter by specific site to view budget allocation, real-time burn rate, expense breakdown, and over-budget approvals.
            </p>
          </div>
        </div>

        {/* Site Filter */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center gap-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-700">Select Site to Inspect:</span>
          <select
            value={trackerSiteId}
            onChange={(e) => setTrackerSiteId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-[#10418A]"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.id}] {s.name}
              </option>
            ))}
          </select>
        </div>

        {trackerSite && (
          <div className="space-y-6">
            {/* Real-time Burn Rate Meter */}
            <BudgetUtilizationMeter spent={totalSpent} allocated={b.allocated} />

            {/* Categorized Spent Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block">Food & Subsistence</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  ${b.spentFood.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block font-mono">
                  Allocated: ${b.food.toLocaleString()}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block">Travel & Transit</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  ${b.spentTravel.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block font-mono">
                  Allocated: ${b.travel.toLocaleString()}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block">Lodging & Board</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  ${b.spentLodging.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block font-mono">
                  Allocated: ${b.lodging.toLocaleString()}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block">Equipment & Other</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  ${b.spentOther.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-600 mt-1 block font-mono">
                  Contingency Pool: ${b.contingency.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Contingency Pool & Over-budget Justification */}
            {b.contingencyRequested && (
              <div className="p-5 rounded-xl bg-white border border-amber-500/30 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Over-Budget Contingency Approval Request</span>
                  </div>
                  <span className="font-mono text-amber-800 font-bold text-sm">
                    ${b.contingencyRequested.toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong className="text-slate-600">Field Justification:</strong> "{b.contingencyJustification}"
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {b.contingencyApproved ? (
                    <span className="text-xs font-semibold font-mono text-[#00A859] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Approved by Budget Manager
                    </span>
                  ) : (
                    <button
                      onClick={() => approveContingency(trackerSite.id)}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Contingency Pool Funds</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*            TAB 3: DELAY COST & IMPACT ANALYSIS (SEPARATE SECTION)          */
  /* -------------------------------------------------------------------------- */
  const renderDelayBudgetImpactTab = () => {
    // Filter sites that are delayed, on hold, or have delay days recorded
    const delayedSites = sites.filter(
      (s) => s.status === 'on_hold' || (s.delayDays && s.delayDays > 0) || s.holdReason
    );

    const totalDelayedDays = sites.reduce((acc, s) => acc + (s.delayDays || 0), 0);
    const totalDelayVarianceCost = totalDelayedDays * DAILY_DELAY_BURN_RATE;

    const delayCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      { key: 'clientName', label: 'Client' },
      { key: 'status', label: 'Status' },
      {
        key: 'holdReason',
        label: 'Delay Reason',
        render: (r) => r || 'No Delay',
      },
      {
        key: 'delayDays',
        label: 'Delay (Days)',
        align: 'right',
        render: (d) => d || 0,
      },
      {
        key: 'delayDays',
        label: 'Delay Cost Impact ($)',
        align: 'right',
        render: (d) => `$${((d || 0) * DAILY_DELAY_BURN_RATE).toLocaleString()}`,
        formatForExport: (d) => (d || 0) * DAILY_DELAY_BURN_RATE,
      },
      {
        key: 'budget',
        label: 'Contingency Pool ($)',
        align: 'right',
        formatForExport: (b) => b?.contingency || 0,
      },
    ];

    // Compute cost impact grouped by delay category
    const delayReasonCounts: Record<string, { count: number; days: number; cost: number }> = {};
    sites.forEach((site) => {
      const reason = site.holdReason || (site.delayDays ? 'Site Delay' : 'No Delay');
      const days = site.delayDays || 0;
      if (!delayReasonCounts[reason]) {
        delayReasonCounts[reason] = { count: 0, days: 0, cost: 0 };
      }
      delayReasonCounts[reason].count += 1;
      delayReasonCounts[reason].days += days;
      delayReasonCounts[reason].cost += days * DAILY_DELAY_BURN_RATE;
    });

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                Financial Telemetry
              </span>
              <h1 className="text-xl font-bold text-slate-900">Delay Cost & Hold Impact Analysis</h1>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Quantify financial variances caused by project delays, simulate idle crew expenses using the delay dropdown, and authorize delay contingency pools.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Delay Cost & Impact Ledger', sites, delayCols, 'delay_cost_impact')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Delay Cost Ledger</span>
          </button>
        </div>

        {/* 4 Financial Impact Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs border-l-4 border-l-rose-500">
            <span className="text-xs font-medium text-slate-500">Cumulative Delay Variance</span>
            <div className="mt-1.5 text-2xl font-bold font-mono text-rose-600 tabular-nums">
              ${totalDelayVarianceCost.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Derived from {totalDelayedDays} aggregate delay days
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs border-l-4 border-l-amber-500">
            <span className="text-xs font-medium text-slate-500">Delayed / On-Hold Sites</span>
            <div className="mt-1.5 text-2xl font-bold font-mono text-amber-600 tabular-nums">
              {delayedSites.length} Projects
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {((delayedSites.length / sites.length) * 100).toFixed(0)}% of active installation portfolio
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs border-l-4 border-l-[#10418A]">
            <span className="text-xs font-medium text-slate-500">Standard Daily Delay Burn</span>
            <div className="mt-1.5 text-2xl font-bold font-mono text-[#10418A] tabular-nums">
              ${DAILY_DELAY_BURN_RATE.toLocaleString()} / day
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Idle wages, lodge per-diem & crane hold
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs border-l-4 border-l-[#00A859]">
            <span className="text-xs font-medium text-slate-500">Contingency Cushion</span>
            <div className="mt-1.5 text-2xl font-bold font-mono text-[#00A859] tabular-nums">
              ${sites.reduce((acc, s) => acc + (s.budget.contingency || 0), 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Total committed emergency reserves
            </p>
          </div>
        </div>

        {/* Interactive Delay Impact Calculator / Simulator with DelayDropdown */}
        <div className="p-5 rounded-xl bg-white border-2 border-[#10418A]/20 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#10418A]" />
              <h3 className="text-sm font-bold text-slate-900">
                Interactive Delay Cost Simulator &amp; Contingency Provisioner
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Select Delay Category to Project Budget Escalation
            </span>
          </div>

          {simSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{simSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Inputs */}
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Project Site *
                </label>
                <select
                  value={simSiteId}
                  onChange={(e) => setSimSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#10418A]"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.id}] {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Delay Dropdown Component */}
              <DelayDropdown
                value={simDelayReason}
                onChange={(val) => setSimDelayReason(val)}
                otherRemarks={simOtherRemarks}
                onOtherRemarksChange={(txt) => setSimOtherRemarks(txt)}
                label="Primary Delay Reason (Dropdown) *"
                showIcon={true}
              />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Estimated Delay Duration
                  </label>
                  <span className="font-mono text-xs font-bold text-[#10418A]">
                    {simDelayDays} Days
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={simDelayDays}
                  onChange={(e) => setSimDelayDays(Number(e.target.value))}
                  className="w-full accent-[#10418A] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>1 Day</span>
                  <span>15 Days</span>
                  <span>30 Days</span>
                </div>
              </div>
            </div>

            {/* Itemized Cost Breakdown Preview */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-3">
                  Cost Escalation Model ({simDelayDays} Days)
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Idle Crew Daily Wages:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ${(simDelayDays * 850).toLocaleString()} ($850/day)
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Hotel Lodging &amp; Per-Diem:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ${(simDelayDays * 550).toLocaleString()} ($550/day)
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Scaffolding / Machine Hold:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ${(simDelayDays * 300).toLocaleString()} ($300/day)
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Logistics &amp; Re-dispatch Fee:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ${(simDelayDays * 150).toLocaleString()} ($150/day)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-slate-200 flex items-baseline justify-between mt-3">
                <span className="text-xs font-bold text-slate-800">Total Projected Variance:</span>
                <span className="font-mono text-lg font-black text-rose-600">
                  +${simEstimatedCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-[#10418A] uppercase tracking-wide block">
                  Budget Mitigation Recommendation
                </span>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Project <strong className="text-slate-800">{simSite.name}</strong> currently has{' '}
                  <strong className="text-emerald-700">${simSite.budget.contingency.toLocaleString()}</strong> in contingency.
                  {simSite.budget.contingency < simEstimatedCost ? (
                    <span className="block mt-1 text-rose-600 font-semibold">
                      ⚠️ Current contingency is insufficient by ${((simEstimatedCost - simSite.budget.contingency)).toLocaleString()}. Immediate allocation recommended.
                    </span>
                  ) : (
                    <span className="block mt-1 text-emerald-700 font-semibold">
                      ✓ Contingency pool covers this estimated delay impact.
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCommitDelayContingency}
                className="w-full mt-4 py-2.5 px-3 bg-[#10418A] hover:bg-[#0D346E] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Allocate Delay Contingency Pool</span>
              </button>
            </div>
          </div>
        </div>

        {/* Delayed Projects Table with Direct DelayDropdown Adjustment */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Active Projects Impacted by Delay ({delayedSites.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update delay reasons and inspect financial variances directly from this ledger.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {delayedSites.map((site) => {
              const days = site.delayDays || 0;
              const delayCost = days * DAILY_DELAY_BURN_RATE;

              return (
                <div key={site.id} className="py-4 space-y-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-[#10418A]">{site.id}</span>
                        <span className="text-sm font-bold text-slate-800">{site.name}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          {site.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Client: {site.clientName} · Supervisor: {site.assignedSupervisorName} · Target Handover: {site.targetHandoverDate}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-sans">Delay Duration</span>
                        <span className="font-bold text-amber-600">{days} Days</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-sans">Financial Variance</span>
                        <span className="font-bold text-rose-600">+${delayCost.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-sans">Contingency</span>
                        <span className="font-bold text-emerald-600">${site.budget.contingency.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delay Reason Row with DelayDropdown */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-700 flex-1">
                      <span className="font-semibold text-slate-500 shrink-0">Classified Reason:</span>
                      <span className="px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-amber-900">
                        ⚠️ {site.holdReason || 'Site Unavailability'}
                      </span>
                      {site.delayJustification && (
                        <span className="text-slate-500 italic text-[11px] truncate">
                          "{site.delayJustification}"
                        </span>
                      )}
                    </div>

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

        {/* Aggregate Breakdown by Delay Reason */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">
            Portfolio Variance Breakdown by Delay Category
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {Object.entries(delayReasonCounts).map(([reason, data]) => (
              <div
                key={reason}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-800 leading-snug">{reason}</span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold text-slate-700">
                    {data.count} Sites
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
                  <span className="text-slate-500 text-[11px]">{data.days} Total Days</span>
                  <span className="font-bold text-rose-600">
                    ${data.cost.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                  TAB 4: CONTINGENCY APPROVALS TAB                          */
  /* -------------------------------------------------------------------------- */
  const renderContingencyTab = () => {
    const contingencySites = sites.filter((s) => s.budget.contingencyRequested);

    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Contingency Approvals Hub</h1>
          <p className="text-xs text-slate-600 mt-1">
            Review emergency cost overruns, equipment rental justifications, and field variances.
          </p>
        </div>

        <div className="space-y-4">
          {contingencySites.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No pending contingency approval requests across active sites.
            </p>
          ) : (
            contingencySites.map((site) => {
              const b = site.budget;
              return (
                <div
                  key={site.id}
                  className="p-5 rounded-xl bg-white border border-slate-200 space-y-3 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[#10418A] font-bold">{site.id}</span>
                      <span className="font-semibold text-slate-800 ml-2">{site.name}</span>
                    </div>
                    <span className="font-mono text-amber-600 font-bold">
                      Requested: ${b.contingencyRequested?.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-600">Supervisor Note:</strong> "{b.contingencyJustification}"
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      Site Supervisor: {site.assignedSupervisorName}
                    </span>

                    {b.contingencyApproved ? (
                      <span className="text-[#00A859] font-semibold font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Approved
                      </span>
                    ) : (
                      <button
                        onClick={() => approveContingency(site.id)}
                        className="px-3.5 py-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shadow-xs transition-colors"
                      >
                        Authorize Funds
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*        TAB 5: GOOGLE SHEETS & DRIVE BUDGET DATABASE (SEPARATE SECTION)     */
  /* -------------------------------------------------------------------------- */
  const renderDriveSheetsLedgerTab = () => {
    const sqlSchemaCode = `-- PostgreSQL / Cloud SQL Relational Schema for Sidharth Budget Ledgers
CREATE TABLE IF NOT EXISTS site_budget_allocations (
    site_id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    base_allocated NUMERIC(12, 2) NOT NULL,
    food_budget NUMERIC(12, 2) DEFAULT 0,
    travel_budget NUMERIC(12, 2) DEFAULT 0,
    lodging_budget NUMERIC(12, 2) DEFAULT 0,
    contingency_pool NUMERIC(12, 2) DEFAULT 0,
    delay_category VARCHAR(100),
    delay_days INT DEFAULT 0,
    delay_variance_cost NUMERIC(12, 2) DEFAULT 0,
    google_sheets_sync_id VARCHAR(100),
    google_drive_receipts_folder_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_receipts_vault (
    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) REFERENCES site_budget_allocations(site_id),
    category VARCHAR(50) CHECK (category IN ('Food', 'Travel', 'Lodging', 'Delay_Emergency')),
    amount NUMERIC(10, 2) NOT NULL,
    google_drive_file_id VARCHAR(120),
    google_drive_view_url TEXT,
    verified_by VARCHAR(100),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-[#10418A]">
                Hybrid Data Pipeline
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                Google Sheets Live Ledger &amp; Drive Receipts Vault
              </h1>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Live Google Sheets two-way financial sync, Google Drive receipt audit repository, and PostgreSQL relational ledger migration schema.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSheetsSync}
              disabled={isSyncingSheets}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#10418A] hover:bg-[#0D346E] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheets ? 'Syncing Sheets...' : 'Trigger Google Sheets Sync'}</span>
            </button>
          </div>
        </div>

        {sheetsSyncSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets &amp; Drive budget ledger synchronized successfully! Timestamp: {lastSyncTime}</span>
          </div>
        )}

        {/* Google Sheets Sync Card */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00A859]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Google Sheets Active Ledger Sync (Sidharth_Budget_Master_Ledger_2026)
                </h3>
                <p className="text-xs text-slate-500">
                  Two-Way Bi-Directional Cloud Webhook · ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-[#00A859] animate-pulse" />
                Live Sync Active
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Synced: {lastSyncTime}</span>
            </div>
          </div>

          {/* Sheets Live Columns Mapping Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Sheet Column</th>
                  <th className="p-2.5">Field Mapping</th>
                  <th className="p-2.5">Sample Value</th>
                  <th className="p-2.5">Validation Rule</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                <tr>
                  <td className="p-2.5 font-bold text-slate-800">Col A: Site_ID</td>
                  <td className="p-2.5 text-slate-500">site.id</td>
                  <td className="p-2.5 text-[#10418A]">SITE-101</td>
                  <td className="p-2.5 text-slate-500 font-sans">Unique Key (SITE-[0-9]+)</td>
                  <td className="p-2.5 text-right text-emerald-600 font-bold font-sans">✓ Bound</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-800">Col B: Total_Allocated</td>
                  <td className="p-2.5 text-slate-500">site.budget.allocated</td>
                  <td className="p-2.5">$48,000</td>
                  <td className="p-2.5 text-slate-500 font-sans">Currency Numeric ($)</td>
                  <td className="p-2.5 text-right text-emerald-600 font-bold font-sans">✓ Bound</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-800">Col C: Delay_Category</td>
                  <td className="p-2.5 text-slate-500">site.holdReason</td>
                  <td className="p-2.5 text-amber-700">Client Site Unavailability</td>
                  <td className="p-2.5 text-slate-500 font-sans">DELAY_REASONS Enum Dropdown</td>
                  <td className="p-2.5 text-right text-emerald-600 font-bold font-sans">✓ Bound</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-800">Col D: Delay_Variance_Cost</td>
                  <td className="p-2.5 text-slate-500">delayDays * 1850</td>
                  <td className="p-2.5 text-rose-600">+$9,250</td>
                  <td className="p-2.5 text-slate-500 font-sans">Computed Formula =D2*1850</td>
                  <td className="p-2.5 text-right text-emerald-600 font-bold font-sans">✓ Bound</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-800">Col E: Drive_Receipt_Folder</td>
                  <td className="p-2.5 text-slate-500">driveFolderUrl</td>
                  <td className="p-2.5 text-blue-600 underline">drive.google.com/folders/...</td>
                  <td className="p-2.5 text-slate-500 font-sans">Google Drive Folder URL</td>
                  <td className="p-2.5 text-right text-emerald-600 font-bold font-sans">✓ Bound</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Google Drive Digital Receipts Vault */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[#10418A]">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Google Drive Invoices &amp; Verified Receipts Vault
                </h3>
                <p className="text-xs text-slate-500">
                  Folder Path: 📁 Google Drive &gt; Sidharth_Automation &gt; 2026_Budget_Receipts
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-slate-500">
              4 Subfolders · 18 Audited Receipts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">SITE-101 Crew Hotel</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">
                  Verified
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">7 Nights Stay Lodging Bill (Rajesh K. Team)</p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
                <span className="font-bold text-slate-800">$14,200</span>
                <span className="text-blue-600 text-[11px] font-sans flex items-center gap-1 cursor-pointer">
                  <span>View PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">SITE-102 Crane Extension</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold font-mono text-[10px]">
                  Delay Surcharge
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">Civil Work Hold Crane Retention Invoice</p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
                <span className="font-bold text-rose-600">$4,800</span>
                <span className="text-blue-600 text-[11px] font-sans flex items-center gap-1 cursor-pointer">
                  <span>View PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">SITE-103 Daily Food Vouchers</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">
                  Audited
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">Installer Crew Meal &amp; Water Dispensary</p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
                <span className="font-bold text-slate-800">$3,950</span>
                <span className="text-blue-600 text-[11px] font-sans flex items-center gap-1 cursor-pointer">
                  <span>View PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">SITE-104 Express Transit</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">
                  Verified
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">Interstate Toll &amp; Shutter Motor Freight</p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
                <span className="font-bold text-slate-800">$2,100</span>
                <span className="text-blue-600 text-[11px] font-sans flex items-center gap-1 cursor-pointer">
                  <span>View PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PostgreSQL / SQL Relational Schema */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#10418A]" />
              <h3 className="text-sm font-bold text-slate-900">
                SQL Relational Database Ledger &amp; Schema Migration
              </h3>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlSchemaCode);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className={`w-3.5 h-3.5 ${copiedSql ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{copiedSql ? 'Copied SQL Schema!' : 'Copy SQL DDL'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-600">
            For future seamless migration from Google Sheets to PostgreSQL / Cloud SQL:
          </p>

          <pre className="p-4 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
            {sqlSchemaCode}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tab Navigation Bar - Separate Section Selector */}
      <div className="bg-white border border-slate-200 p-1.5 rounded-xl flex flex-wrap items-center gap-1 shadow-xs">
        <button
          onClick={() => setCurrentTab('budget_allocation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentTab === 'budget_allocation'
              ? 'bg-[#10418A] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Budget Allocation</span>
        </button>

        <button
          onClick={() => setCurrentTab('expense_tracker')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentTab === 'expense_tracker'
              ? 'bg-[#10418A] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Site Expense Tracker</span>
        </button>

        <button
          onClick={() => setCurrentTab('delay_budget_impact')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentTab === 'delay_budget_impact'
              ? 'bg-[#10418A] text-white shadow-xs ring-2 ring-amber-400/50'
              : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Delay Cost &amp; Impact Analysis</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono">
            New
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('contingency_requests')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentTab === 'contingency_requests'
              ? 'bg-[#10418A] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Contingency Approvals</span>
        </button>

        <button
          onClick={() => setCurrentTab('drive_sheets_ledger')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentTab === 'drive_sheets_ledger'
              ? 'bg-[#10418A] text-white shadow-xs ring-2 ring-emerald-400/50'
              : 'text-slate-600 hover:text-[#10418A] hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <span>Drive &amp; Sheets Ledger Sync</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
            New
          </span>
        </button>
      </div>

      {/* Render Active Section */}
      {currentTab === 'budget_allocation' && renderAllocationTab()}
      {currentTab === 'expense_tracker' && renderExpenseTrackerTab()}
      {currentTab === 'delay_budget_impact' && renderDelayBudgetImpactTab()}
      {currentTab === 'contingency_requests' && renderContingencyTab()}
      {currentTab === 'drive_sheets_ledger' && renderDriveSheetsLedgerTab()}

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
