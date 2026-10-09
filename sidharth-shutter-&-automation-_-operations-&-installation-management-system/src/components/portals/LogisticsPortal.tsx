import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SiteItem, DelayReason } from '../../types';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import { DelayDropdown } from '../DelayDropdown';
import {
  FileSpreadsheet,
  Truck,
  Factory,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Send,
  ExternalLink,
  Shield,
  Check,
} from 'lucide-react';

interface LogisticsPortalProps {
  activeTab: string;
}

export const LogisticsPortal: React.FC<LogisticsPortalProps> = ({ activeTab }) => {
  const {
    sites,
    activeSites,
    commitProductionTimeline,
    dispatchOrder,
    sendPreDispatchReminder,
    updateSiteStatus,
  } = useApp();

  // Excel Drawer State
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('Production & Logistics Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('logistics_production_data');

  // Production Tracking form state
  const [selectedSiteId, setSelectedSiteId] = useState<string>(activeSites[0]?.id || '');
  const [mfgDays, setMfgDays] = useState<number>(18);
  const [committedDate, setCommittedDate] = useState('2026-10-22');
  const [targetDispatchDate, setTargetDispatchDate] = useState('2026-10-25');
  const [completionPct, setCompletionPct] = useState<number>(65);
  const [timelineSaved, setTimelineSaved] = useState(false);
  const [prodDelayReason, setProdDelayReason] = useState<DelayReason>('No Delay');
  const [prodDelayRemarks, setProdDelayRemarks] = useState('');

  // Dispatch Manager form state
  const [dispatchSiteId, setDispatchSiteId] = useState<string>(activeSites[0]?.id || '');
  const [vehicleReg, setVehicleReg] = useState('MH-12-QE-9920');
  const [trackingId, setTrackingId] = useState('TRK-IN-984401');
  const [trackingUrl, setTrackingUrl] = useState('https://opsflow.io/track/TRK-IN-984401');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState(
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
  );
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  const currentSite = activeSites.find((s) => s.id === selectedSiteId) || activeSites[0];
  const dispatchSite = activeSites.find((s) => s.id === dispatchSiteId) || activeSites[0];

  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  const handleSaveTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSite) return;

    commitProductionTimeline(
      currentSite.id,
      mfgDays,
      committedDate,
      targetDispatchDate,
      completionPct
    );

    if (prodDelayReason !== 'No Delay') {
      updateSiteStatus(
        currentSite.id,
        'on_hold',
        currentSite.progress,
        prodDelayReason,
        prodDelayRemarks,
        3
      );
    }

    setTimelineSaved(true);
    setTimeout(() => setTimelineSaved(false), 2000);
  };

  const handleExecuteDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchSite) return;

    dispatchOrder(
      dispatchSite.id,
      vehicleReg,
      trackingId,
      trackingUrl,
      vehiclePhotoUrl
    );

    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 2500);
  };

  /* -------------------------------------------------------------------------- */
  /*                  PANEL 1: PRODUCTION TRACKING PANEL                        */
  /* -------------------------------------------------------------------------- */
  const renderProductionTracking = () => {
    const prodCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Project Site' },
      { key: 'deliveryAddress', label: 'Delivery Address' },
      {
        key: 'production',
        label: 'Order ID',
        formatForExport: (p) => p?.orderId || '',
      },
      {
        key: 'production',
        label: 'Mfg Days',
        align: 'right',
        formatForExport: (p) => p?.manufacturingDays || 0,
      },
      {
        key: 'production',
        label: 'Build Completion (%)',
        align: 'right',
        formatForExport: (p) => p?.completionPct || 0,
      },
      {
        key: 'production',
        label: 'Target Dispatch',
        formatForExport: (p) => p?.targetDispatchDate || '',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Production Scheduling & Timelines</h1>
            <p className="text-xs text-slate-600 mt-1">
              Commit manufacturing duration & milestones. Updates automatically alert Salesperson tracking.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Production Orders', activeSites, prodCols, 'production_orders_dataset')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Top Info Banner on Privacy */}
        <div className="p-3.5 rounded-lg bg-blue-50 border border-[#10418A]/20 text-xs text-[#10418A] font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#10418A]" />
            <span>
              Orders Confirmed by Sales appear here automatically with product specs and delivery address (financial values hidden).
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Commit Form */}
          <form
            onSubmit={handleSaveTimeline}
            className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#10418A]" />
              <span>Input Production Timeline Commitment</span>
            </h3>

            {timelineSaved && (
              <div className="p-2.5 rounded bg-emerald-50 border border-[#00A859]/30 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                <Check className="w-4 h-4" /> Timeline committed & Sales alerted!
              </div>
            )}

            <div>
              <label className="text-xs text-slate-600 block mb-1">Select Order / Site *</label>
              <select
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(e.target.value);
                  const s = activeSites.find((site) => site.id === e.target.value);
                  if (s) {
                    setMfgDays(s.production.manufacturingDays);
                    setCommittedDate(s.production.committedDate);
                    setTargetDispatchDate(s.production.targetDispatchDate);
                    setCompletionPct(s.production.completionPct);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                {activeSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.production.orderId}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            {currentSite && (
              <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="text-[11px] text-slate-500">Destination Address:</div>
                <div className="text-slate-700 font-medium">{currentSite.deliveryAddress}</div>
                <div className="text-[11px] text-slate-500 pt-1">Product Specs:</div>
                <div className="text-slate-800 font-medium">{currentSite.production.itemSpecs}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Mfg Days *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={mfgDays}
                  onChange={(e) => setMfgDays(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Build Status (%)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={completionPct}
                  onChange={(e) => setCompletionPct(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Committed Date *</label>
                <input
                  type="date"
                  required
                  value={committedDate}
                  onChange={(e) => setCommittedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Target Dispatch *</label>
                <input
                  type="date"
                  required
                  value={targetDispatchDate}
                  onChange={(e) => setTargetDispatchDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Delay & Hold Status Dropdown */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <DelayDropdown
                value={prodDelayReason}
                onChange={setProdDelayReason}
                otherRemarks={prodDelayRemarks}
                onOtherRemarksChange={setProdDelayRemarks}
                label="Manufacturing Bottleneck / Delay Reason (Dropdown)"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-[#10418A] text-white rounded-lg transition-colors cursor-pointer shadow-md"
            >
              Commit Timeline & Notify Salesperson
            </button>
          </form>

          {/* Active Orders List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Active Factory Build Pipeline ({activeSites.length})
            </h3>

            {activeSites.map((site) => {
              const p = site.production;
              return (
                <div
                  key={site.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#10418A]">{p.orderId}</span>
                        <span className="font-semibold text-slate-800">{site.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Address: {site.deliveryAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => sendPreDispatchReminder(site.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 border border-amber-500/30 rounded cursor-pointer flex items-center gap-1"
                        title="Trigger 3-Day Pre-Arrival Alert"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Send 3-Day Reminder Flag</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">Manufacturing Completion</span>
                      <span className="font-mono text-slate-800 font-bold">{p.completionPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#10418A] h-full rounded-full transition-all duration-500"
                        style={{ width: `${p.completionPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-[11px] font-mono text-slate-600">
                    <div>Lead: {p.manufacturingDays} Days</div>
                    <div>Committed: {p.committedDate}</div>
                    <div>Target Dispatch: {p.targetDispatchDate}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                     PANEL 2: DISPATCH MANAGER                              */
  /* -------------------------------------------------------------------------- */
  const renderDispatchManager = () => {
    const dispatchCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      {
        key: 'production',
        label: 'Dispatched?',
        formatForExport: (p) => (p?.isDispatched ? 'Yes' : 'No'),
      },
      {
        key: 'production',
        label: 'Vehicle Reg',
        formatForExport: (p) => p?.vehicleRegNumber || '',
      },
      {
        key: 'production',
        label: 'Tracking ID',
        formatForExport: (p) => p?.trackingId || '',
      },
      {
        key: 'production',
        label: 'Dispatch Date',
        formatForExport: (p) => p?.dispatchDate || '',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fleet Dispatch & Manifest Manager</h1>
            <p className="text-xs text-slate-600 mt-1">
              Assign dispatch vehicles, upload loaded transit photos, and trigger urgent crew alignment alerts.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Dispatch Manifests', activeSites, dispatchCols, 'dispatch_manifests')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dispatch Form */}
          <form
            onSubmit={handleExecuteDispatch}
            className="p-6 rounded-xl bg-white border border-slate-200 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00A859]" />
              <span>Execute Vehicle Dispatch</span>
            </h3>

            {dispatchSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-[#00A859]/30 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00A859]" />
                <span>
                  High-Priority Alert dispatched to Supervisor: "Order Dispatched — Urgent Team Alignment Required!"
                </span>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-600 block mb-1">Select Project Site *</label>
              <select
                value={dispatchSiteId}
                onChange={(e) => setDispatchSiteId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                {activeSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.id}] {s.name} — Status: {s.production.isDispatched ? 'Already Dispatched' : 'Ready'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Dispatch Vehicle Reg # *</label>
                <input
                  type="text"
                  required
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  placeholder="e.g. MH-12-QE-9920"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Parcel Tracking ID *</label>
                <input
                  type="text"
                  required
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="e.g. TRK-IN-984401"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1">Live Tracking URL</label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://opsflow.io/track/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1">
                Loaded Vehicle Photo URL (Pre-Dispatch Verification)
              </label>
              <input
                type="text"
                value={vehiclePhotoUrl}
                onChange={(e) => setVehiclePhotoUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
              />
              {vehiclePhotoUrl && (
                <div className="mt-2">
                  <img
                    src={vehiclePhotoUrl}
                    alt="Loaded Vehicle"
                    className="w-full h-32 object-cover rounded-lg border border-slate-200"
                  />
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Confirm Dispatch & Trigger High-Priority Alert</span>
              </button>
            </div>
          </form>

          {/* Alert System Logic Overview */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Cross-Portal Automated Alert Rules
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-semibold text-amber-600 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>3 Days Before Dispatch:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Automated reminder triggers on Admin, Logistics, and Supervisor dashboards to ensure
                  receiving bay readiness, offloading forklift booking, and staging area clearance.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-semibold text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Upon Dispatch:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Supervisor gets high-priority alert: "Order Dispatched — Urgent Team Alignment Required",
                  including tracking link, vehicle photo, driver contact, and estimated arrival time.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-semibold text-[#10418A] flex items-center gap-1.5">
                  <Factory className="w-4 h-4" />
                  <span>Production Commitment:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Production manager logs lead time and committed date $\rightarrow$ automatically synchronizes
                  into Salesperson's status tracker.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {activeTab === 'production_tracking' && renderProductionTracking()}
      {activeTab === 'dispatch_manager' && renderDispatchManager()}

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
