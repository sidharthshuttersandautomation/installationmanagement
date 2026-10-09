import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DealItem, SiteItem, DealStatus } from '../../types';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import {
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Building,
  Check,
  Shield,
  Send,
  Calendar,
  Lock,
} from 'lucide-react';

interface SalespersonPortalProps {
  activeTab: string;
}

export const SalespersonPortal: React.FC<SalespersonPortalProps> = ({ activeTab }) => {
  const {
    currentUser,
    deals,
    sites,
    dailyLogs,
    notifications,
    createDeal,
    confirmDeal,
    loseDeal,
  } = useApp();

  // Excel Drawer State
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('My Deals Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('my_sales_deals');

  // Form State for Log Visit & Order Deal Tab
  const [client, setClient] = useState('');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [region, setRegion] = useState<'North' | 'South' | 'West' | 'East' | 'Central' | 'Metro'>('Metro');
  const [productCategory, setProductCategory] = useState('Commercial Solar Framing');
  const [productSpecs, setProductSpecs] = useState('');
  const [dealValue, setDealValue] = useState<number>(45000);
  const [dealStatus, setDealStatus] = useState<DealStatus>('Negotiation');
  const [lostReason, setLostReason] = useState('');
  const [targetCloseDate, setTargetCloseDate] = useState('2026-10-30');
  const [notes, setNotes] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Track Site Progress state
  const [selectedSiteId, setSelectedSiteId] = useState<string>(sites[0]?.id || '');

  // Filter deals for current salesperson
  const myDeals = deals.filter(
    (d) => d.salespersonId === currentUser.id || d.salespersonName === currentUser.name
  );

  const confirmedDeals = myDeals.filter((d) => d.status === 'Confirmed');
  const totalRevenue = confirmedDeals.reduce((a, b) => a + b.value, 0);
  const pipelineValue = myDeals
    .filter((d) => d.status === 'Negotiation' || d.status === 'Draft')
    .reduce((a, b) => a + b.value, 0);

  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (dealStatus === 'Lost' && !lostReason.trim()) {
      alert('Please provide a mandatory "Reason for Lost Deal" before proceeding.');
      return;
    }

    createDeal({
      client,
      siteName,
      location,
      region,
      productCategory,
      productSpecs: productSpecs || `${productCategory} standard installation`,
      value: Number(dealValue) || 0,
      status: dealStatus,
      lostReason: dealStatus === 'Lost' ? lostReason : undefined,
      salespersonId: currentUser.id,
      salespersonName: currentUser.name,
      targetCloseDate,
      notes,
    });

    // If deal status was immediately set to Confirmed, also run confirm workflow
    if (dealStatus === 'Confirmed') {
      const generatedSite = sites.find((s) => s.name === siteName);
      if (generatedSite) {
        // Site already tied
      }
    }

    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setClient('');
      setSiteName('');
      setLocation('');
      setProductSpecs('');
      setLostReason('');
      setNotes('');
    }, 2000);
  };

  /* -------------------------------------------------------------------------- */
  /*                            TAB 1: MY SALES TAB                             */
  /* -------------------------------------------------------------------------- */
  const renderMySalesTab = () => {
    const dealCols: ColumnDef<DealItem>[] = [
      { key: 'id', label: 'Deal ID' },
      { key: 'client', label: 'Client' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'location', label: 'Location' },
      { key: 'value', label: 'Value ($)', align: 'right' },
      { key: 'status', label: 'Status' },
      { key: 'productCategory', label: 'Category' },
      { key: 'createdAt', label: 'Date Logged' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Sales Dashboard</h1>
            <p className="text-xs text-slate-600 mt-1">
              Sales pipeline, quota attainment, and closed contract revenue for {currentUser.name}.
            </p>
          </div>

          <button
            onClick={() => openExcel('My Sales Deals', myDeals, dealCols, 'my_sales_deals')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Top KPI section styled with subtle glassmorphism borders, drop shadows, and high-contrast metric text */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white backdrop-blur-md border border-slate-200/80 shadow-lg shadow-black/20 hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>My Confirmed Revenue</span>
              <DollarSign className="w-4 h-4 text-[#00A859]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono text-white tabular-nums tracking-tight">
                ${totalRevenue.toLocaleString()}
              </span>
              <span className="text-xs text-[#00A859] font-mono flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Won
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              {confirmedDeals.length} successfully closed project contracts
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white backdrop-blur-md border border-slate-200/80 shadow-lg shadow-black/20 hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Active Pipeline Value</span>
              <Clock className="w-4 h-4 text-[#10418A]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono text-white tabular-nums tracking-tight">
                ${pipelineValue.toLocaleString()}
              </span>
              <span className="text-xs text-[#10418A] font-mono">In Progress</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              {myDeals.filter((d) => d.status !== 'Confirmed' && d.status !== 'Lost').length} active negotiation deals
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white backdrop-blur-md border border-slate-200/80 shadow-lg shadow-black/20 hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Win Rate Ratio</span>
              <CheckCircle2 className="w-4 h-4 text-[#1E5BB5]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono text-white tabular-nums tracking-tight">
                {Math.round((confirmedDeals.length / Math.max(1, myDeals.length)) * 100)}%
              </span>
              <span className="text-xs text-[#1E5BB5] font-mono">Conversion</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Total Opportunities: {myDeals.length}
            </p>
          </div>
        </div>

        {/* Live Status Bar for Manufacturing Milestones & Dispatch */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#10418A]" />
              <span>Live Milestone Ticker & Dispatch Alerts</span>
            </span>
            <span className="text-slate-600 font-mono text-[11px]">Real-time Updates</span>
          </div>

          <div className="space-y-2">
            {notifications
              .filter((n) => n.targetRoles.includes('salesperson'))
              .slice(0, 3)
              .map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="font-semibold text-slate-800">{n.title}:</span>
                    <span className="text-slate-600 truncate max-w-lg">{n.message}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{n.timestamp.slice(11)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* My Deals List */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">My Pipeline & Closed Projects</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myDeals.map((deal) => (
              <div
                key={deal.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-[#10418A]">{deal.id}</span>
                    <h4 className="text-sm font-semibold text-slate-800">{deal.siteName}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Client: {deal.client} · {deal.location}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${
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

                <div className="text-xs text-slate-700">
                  <span className="text-slate-500 block text-[11px]">Product Specs:</span>
                  <p className="truncate">{deal.productSpecs}</p>
                </div>

                {deal.lostReason && (
                  <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                    <strong>Reason for Lost Deal:</strong> {deal.lostReason}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                  <span className="font-mono text-slate-900 font-bold text-sm">
                    ${deal.value.toLocaleString()}
                  </span>

                  {deal.status !== 'Confirmed' && deal.status !== 'Lost' && (
                    <button
                      onClick={() => confirmDeal(deal.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Deal (Trigger Alert)</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                     TAB 2: LOG VISIT & ORDER DEAL TAB                      */
  /* -------------------------------------------------------------------------- */
  const renderLogVisitTab = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Log Site Visit & Register Deal</h1>
          <p className="text-xs text-slate-600 mt-1">
            Register newly negotiated site requirements. Marking a deal "Confirmed" automatically notifies
            Logistics, Production, and Supervisor portals.
          </p>
        </div>

        {formSubmitted && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-[#00A859]/30 text-emerald-800 font-semibold text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#00A859] shrink-0" />
            <div>
              <p className="font-semibold">Deal successfully logged!</p>
              <p className="text-[#00A859]/80 mt-0.5">
                Automated cross-portal notifications dispatched to Logistics, Production & Supervisor.
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className="p-6 rounded-xl bg-white border border-slate-200 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client Organization *
              </label>
              <input
                type="text"
                required
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Apex Industrial Parks Ltd"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Project Site Name *
              </label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. Sector 18 Logistics Bay"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Site Location / City *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Pune, MH"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Region Sector *
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                <option value="Metro">Metro</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="West">West</option>
                <option value="Central">Central</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Contract Deal Value ($) *
              </label>
              <input
                type="number"
                required
                min={1000}
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Product Category *
              </label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                <option value="Commercial Solar Framing">Commercial Solar Framing</option>
                <option value="Power Enclosures">Power Enclosures</option>
                <option value="HVAC & Cold Chain">HVAC & Cold Chain</option>
                <option value="Heavy Machinery Gantries">Heavy Machinery Gantries</option>
                <option value="Material Handling">Material Handling</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Target Close Date *
              </label>
              <input
                type="date"
                required
                value={targetCloseDate}
                onChange={(e) => setTargetCloseDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Product Technical Specifications (Passed to Logistics & Production)
            </label>
            <textarea
              rows={2}
              value={productSpecs}
              onChange={(e) => setProductSpecs(e.target.value)}
              placeholder="e.g. 40kW Modular Rooftop Racks, Grade 316 Stainless Steel with seismic anchor bracket plates"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
            />
          </div>

          {/* Deal Status Selector with Dynamic Form Logic */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-2">
                Deal Status *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Draft', 'Negotiation', 'Confirmed', 'Lost'] as DealStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setDealStatus(status)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      dealStatus === status
                        ? status === 'Confirmed'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : status === 'Lost'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                          : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Form Logic: When changing Deal Status to "Lost", dynamically reveal mandatory multi-line text box */}
            {dealStatus === 'Lost' && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-500/25 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Mandatory: Reason for Lost Deal</span>
                </div>
                <p className="text-[11px] text-rose-700 font-semibold/80">
                  Please describe the competitive loss reason, price gap, or client technical rejection factors.
                </p>
                <textarea
                  rows={3}
                  required
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="e.g. Competitor provided alternative aluminium extrusion at 15% lower price point..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-rose-500/40 rounded-lg text-slate-900 placeholder:text-rose-700 font-semibold/50 focus:outline-none focus:border-rose-400"
                />
              </div>
            )}

            {dealStatus === 'Confirmed' && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-500/20 text-xs text-emerald-800 font-semibold flex items-start gap-2">
                <Check className="w-4 h-4 text-[#00A859] mt-0.5 shrink-0" />
                <div>
                  <strong>Automated Cross-Portal Event Trigger:</strong>
                  <p className="text-[11px] text-[#00A859]/80 mt-0.5">
                    Submitting this will immediately dispatch specs and address to Logistics & Production (financial value hidden) and alert the Supervisor for site survey.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Internal Notes / Site Access Restrictions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rooftop crane access requires weekend road closure permit."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#10418A]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-[#10418A] rounded-lg transition-colors cursor-pointer shadow-md shadow-indigo-950"
            >
              <Send className="w-4 h-4" />
              <span>Submit Deal Record</span>
            </button>
          </div>
        </form>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                       TAB 3: TRACK SITE PROGRESS TAB                       */
  /* -------------------------------------------------------------------------- */
  const renderTrackProgressTab = () => {
    const currentSite = sites.find((s) => s.id === selectedSiteId) || sites[0];
    const currentLogs = dailyLogs.filter((l) => l.siteId === currentSite?.id);

    const siteCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      { key: 'clientName', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'progress', label: 'Installation Progress (%)', align: 'right' },
      {
        key: 'production',
        label: 'Mfg Build (%)',
        align: 'right',
        formatForExport: (p) => p?.completionPct || 0,
      },
      {
        key: 'production',
        label: 'Dispatched?',
        formatForExport: (p) => (p?.isDispatched ? 'Yes' : 'No'),
      },
      { key: 'targetHandoverDate', label: 'Target Handover' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Live Project Execution Tracking</h1>
            <p className="text-xs text-slate-600 mt-1">
              Manufacturing milestones, dispatch vehicles, installation logs, and photo verification.
            </p>
          </div>

          <button
            onClick={() => openExcel('Site Execution Progress', sites, siteCols, 'sales_site_progress')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Privacy Guard Notice */}
        <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong className="text-slate-700">Privacy Guard Enforced:</strong> Operational budgets, internal worker payroll, and lodging receipts are strictly hidden from Sales view.
          </span>
        </div>

        {/* Site Picker */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-700">Select Site:</span>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-[#10418A]"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.id}] {s.name} — Status: {s.status.toUpperCase()} ({s.progress}%)
              </option>
            ))}
          </select>
        </div>

        {currentSite && (
          <div className="space-y-6">
            {/* Manufacturing & Dispatch Status Card */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#10418A]">{currentSite.id}</span>
                    <h3 className="text-base font-semibold text-slate-900">{currentSite.name}</h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Client: {currentSite.clientName} · Address: {currentSite.deliveryAddress}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span>Target Handover: <strong className="text-slate-800">{currentSite.targetHandoverDate}</strong></span>
                  <span className={`px-2 py-0.5 rounded font-semibold ${
                    currentSite.status === 'on_hold'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {currentSite.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Delay Reason Alert if on hold */}
              {currentSite.status === 'on_hold' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Hold Reason:</span> {currentSite.holdReason || 'Client Requested Delay'}
                    {currentSite.delayJustification && ` · Note: ${currentSite.delayJustification}`}
                  </div>
                </div>
              )}

              {/* 2 Progress Bars: Manufacturing vs Field Installation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">1. Manufacturing Stage</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {currentSite.production.completionPct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#10418A] h-full rounded-full transition-all duration-500"
                      style={{ width: `${currentSite.production.completionPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-mono">
                    <span>Target Dispatch: {currentSite.production.targetDispatchDate}</span>
                    <span>Lead: {currentSite.production.manufacturingDays}d</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">2. On-Site Installation Stage</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {currentSite.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${currentSite.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-mono">
                    <span>Supervisor: {currentSite.assignedSupervisorName}</span>
                    <span>Crew: {currentSite.assignedWorkers.length} assigned</span>
                  </div>
                </div>
              </div>

              {/* Dispatch Tracking Info */}
              {currentSite.production.isDispatched && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-500/20 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#00A859]" />
                    <span className="text-emerald-800 font-semibold font-medium">
                      Materials In Transit on Vehicle {currentSite.production.vehicleRegNumber}
                    </span>
                  </div>
                  {currentSite.production.trackingUrl && (
                    <a
                      href={currentSite.production.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00A859] hover:text-emerald-800 font-semibold font-mono underline"
                    >
                      Track Parcel #{currentSite.production.trackingId}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Daily Log Feed for Salesperson */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Supervisor Daily Field Logs ({currentLogs.length})
              </h3>

              {currentLogs.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No site logs filed yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">
                          [{log.taskCategory}]
                        </span>{' '}
                        <span className="text-slate-700">{log.description}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {log.date}
                      </span>
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {activeTab === 'my_sales' && renderMySalesTab()}
      {activeTab === 'log_visit_order' && renderLogVisitTab()}
      {activeTab === 'track_progress' && renderTrackProgressTab()}

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
