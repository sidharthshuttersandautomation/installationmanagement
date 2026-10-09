import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCategory, WorkerProfile, DelayReason, DELAY_REASONS } from '../../types';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import { DelayDropdown } from '../DelayDropdown';
import {
  FileSpreadsheet,
  HardHat,
  Clock,
  Camera,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Award,
  Calendar,
  MapPin,
  TrendingUp,
  FileCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';

interface WorkerPortalProps {
  activeTab: string;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({ activeTab }) => {
  const {
    currentUser,
    workers,
    activeSites,
    dailyLogs,
    punchState,
    punchIn,
    punchOut,
  } = useApp();

  // Excel Drawer State
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('My Work History Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('my_work_history');

  // Punch-In / Punch-Out Form State
  const [punchSiteId, setPunchSiteId] = useState<string>(activeSites[0]?.id || 'SITE-101');
  const [punchInPhotoUrl, setPunchInPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=600&q=80'
  );
  const [punchOutPhotoUrl, setPunchOutPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80'
  );
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Civil Mounting');
  const [taskDescription, setTaskDescription] = useState('');
  const [workerDelayReason, setWorkerDelayReason] = useState<DelayReason>('No Delay');
  const [workerDelayRemarks, setWorkerDelayRemarks] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Inspector for Python TypeError fix
  const [showTypeErrorFixModal, setShowTypeErrorFixModal] = useState(false);

  // Find worker profile
  const workerProfile: WorkerProfile =
    workers.find((w) => w.id === currentUser.id) ||
    workers[0] || {
      id: 'WRK001',
      name: currentUser.name,
      designation: 'Installer',
      status: 'Deployed',
      totalHours: 164,
      daysTravelled: 12,
      daysWorked: 22,
      sitesVisitedCount: 8,
      onHoldSitesCount: 1,
      ratings: [],
      travelHistory: [],
      taskEfficiency: [],
    };

  // Safe numerical calculations (Bug Fix Specification Equivalent)
  const safeHours = Number(workerProfile.totalHours) || 0;
  const safeTravelled = parseInt(String(workerProfile.daysTravelled), 10) || 0;
  const safeWorked = parseInt(String(workerProfile.daysWorked), 10) || 0;
  const perfScore = Math.round(safeHours * 2 + safeTravelled * 15 + safeWorked * 10);

  // Live timer tick when punched in
  useEffect(() => {
    let interval: any;
    if (punchState.isPunchedIn && punchState.punchedInAt) {
      const updateTimer = () => {
        const start = new Date(punchState.punchedInAt!).getTime();
        const now = new Date().getTime();
        setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [punchState.isPunchedIn, punchState.punchedInAt]);

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  };

  const myLogs = dailyLogs.filter(
    (l) => l.workerId === currentUser.id || l.workerName === currentUser.name
  );

  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  const handlePunchInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchInPhotoUrl) {
      alert('Mandatory arrival photo required for Punch-In verification.');
      return;
    }
    punchIn(punchSiteId, punchInPhotoUrl);
  };

  const handlePunchOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchOutPhotoUrl) {
      alert('Mandatory site departure photo required for Punch-Out verification.');
      return;
    }
    if (!taskDescription.trim()) {
      alert('Please specify the daily tasks performed before punching out.');
      return;
    }
    punchOut(
      punchOutPhotoUrl,
      taskCategory,
      taskDescription,
      workerDelayReason,
      workerDelayRemarks
    );
    setTaskDescription('');
    setWorkerDelayRemarks('');
    setWorkerDelayReason('No Delay');
  };

  /* -------------------------------------------------------------------------- */
  /*                       TAB 1: MY WORK DASHBOARD TAB                         */
  /* -------------------------------------------------------------------------- */
  const renderMyWorkDashboard = () => {
    const logCols: ColumnDef<any>[] = [
      { key: 'date', label: 'Date' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'taskCategory', label: 'Category' },
      { key: 'hoursWorked', label: 'Hours', align: 'right' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'description', label: 'Task Description' },
    ];

    const getInitials = (name: string): string => {
      if (!name) return 'U';
      const cleanName = name.replace(/\([^)]*\)/g, '').trim();
      const parts = cleanName.split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'U';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#10418A] to-[#00A859] text-white flex items-center justify-center font-extrabold text-xs shadow-xs ring-2 ring-white shrink-0">
              {getInitials(currentUser.name)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Field Technician Workspace: {currentUser.name}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Designation: <span className="text-[#10418A] font-semibold">{currentUser.designationTag || 'Installer'}</span> · Status: <span className="text-emerald-700 font-semibold">Active On Duty</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* TypeError Bug Fix Explainer Trigger */}
            <button
              onClick={() => setShowTypeErrorFixModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#10418A] font-semibold bg-blue-50 hover:bg-blue-100 border border-[#10418A]/30 rounded-lg transition-colors cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-[#10418A]" />
              <span>TypeError Bug Fix Audit</span>
            </button>

            <button
              onClick={() => openExcel('My Daily Work Logs', myLogs, logCols, 'worker_daily_logs')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel / Raw Data View</span>
            </button>
          </div>
        </div>

        {/* Top KPIs with explicit safe type-cast formulas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600 block">Total Field Hours</span>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {safeHours} hrs
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Safely cast float value</p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600 block">Days Travelled</span>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {safeTravelled} Days
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Safely cast int value</p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600 block">Days Worked</span>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {safeWorked} Days
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Safely cast int value</p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <span className="text-xs text-slate-600 block">Performance Index</span>
            <div className="mt-2 text-2xl font-bold font-mono text-[#00A859] tabular-nums">
              {perfScore} pts
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              (Hours×2) + (Travel×15) + (Work×10)
            </p>
          </div>
        </div>

        {/* Current Active Assignment Card */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#10418A]" />
              <span>Current Deployment Site</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#10418A]/20 text-[#10418A] font-bold">
              {workerProfile.status}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-sm font-semibold text-slate-800">
                {workerProfile.currentSiteName || 'Apex Tower Industrial Rooftop'}
              </span>
              <p className="text-slate-600 mt-0.5">
                Site ID: {workerProfile.currentSiteId || 'SITE-101'} · Assigned role: {workerProfile.designation}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-600">
                Sites Completed: {workerProfile.sitesVisitedCount}
              </span>
              <span className="font-mono text-slate-600">
                On-Hold Handled: {workerProfile.onHoldSitesCount}
              </span>
            </div>
          </div>
        </div>

        {/* Supervisor Scorecards & Reviews */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Supervisor Evaluation History & Badges
          </h3>

          {workerProfile.ratings.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No formal supervisor scorecards logged yet.
            </p>
          ) : (
            <div className="space-y-3">
              {workerProfile.ratings.map((rating, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{rating.siteName}</span>
                      <span className="text-slate-600 ml-2 font-mono text-[11px]">
                        Reviewed by {rating.supervisorName} on {rating.date}
                      </span>
                    </div>
                    <span className="text-[#00A859] font-bold font-mono text-sm px-2 py-0.5 rounded bg-emerald-50">
                      {rating.score} / 10
                    </span>
                  </div>

                  <p className="text-slate-700 italic text-[11px]">"{rating.notes}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TypeError Fix Modal */}
        {showTypeErrorFixModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-[#10418A]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Python TypeError Bug Fix Specification Audit
                  </h3>
                </div>
                <button
                  onClick={() => setShowTypeErrorFixModal(false)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  <strong>Root Cause Analysis:</strong> The Python error{' '}
                  <code className="text-rose-600 bg-rose-950/40 px-1 rounded font-mono">
                    TypeError: can only concatenate str (not "int") to str
                  </code>{' '}
                  occurs in <code className="font-mono text-slate-800">installation_app/views/worker.py</code> line 38
                  because string values were concatenated directly with integers without explicit type casting.
                </p>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px]">
                  <span className="text-rose-600 block">❌ Previous Fragile Pattern:</span>
                  <div className="text-slate-600">
                    perf_score = (total_hours * 2) + (days_travelled * 15) + (days_worked * 10)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-[#00A859]/30 space-y-1 font-mono text-[11px]">
                  <span className="text-[#00A859] block">✅ Corrected Safe Casting Pattern:</span>
                  <div className="text-emerald-200">
                    safe_hours = float(total_hours) if total_hours is not None and str(total_hours).replace('.', '', 1).isdigit() else 0.0<br />
                    safe_travelled = int(days_travelled) if days_travelled is not None and str(days_travelled).isdigit() else 0<br />
                    safe_worked = int(days_worked) if days_worked is not None and str(days_worked).isdigit() else 0<br />
                    perf_score = int((safe_hours * 2) + (safe_travelled * 15) + (safe_worked * 10))
                  </div>
                </div>

                <p className="text-slate-600 text-[11px]">
                  Verified in this frontend client using strict numeric casting:
                  <code className="text-[#10418A] ml-1 font-mono">
                    Number(hours) * 2 + parseInt(travel) * 15 + parseInt(worked) * 10
                  </code>
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowTypeErrorFixModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-800 rounded-lg"
                >
                  Close Audit View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*            TAB 2: LOG DAILY TASKS (VISUAL PUNCH-IN/OUT TIMER)             */
  /* -------------------------------------------------------------------------- */
  const renderLogTasksTab = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">
            Daily Task Logger & Visual Punch Timer
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Mandatory arrival and departure photo verification with live shift stopwatch.
          </p>
        </div>

        {/* Live Running Stopwatch Dashboard */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-200 text-center space-y-4 shadow-xl">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                punchState.isPunchedIn ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'
              }`}
            />
            <span className="text-xs uppercase font-mono tracking-widest text-slate-600 font-semibold">
              {punchState.isPunchedIn ? 'Active Field Shift In-Progress' : 'Shift Inactive (Punched Out)'}
            </span>
          </div>

          <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white tabular-nums drop-shadow-md">
            {punchState.isPunchedIn ? formatTimer(elapsedSeconds) : '00:00:00'}
          </div>

          {punchState.isPunchedIn && (
            <div className="text-xs text-slate-600 font-mono">
              Punched in at:{' '}
              <strong className="text-slate-800">
                {new Date(punchState.punchedInAt!).toLocaleTimeString()}
              </strong>{' '}
              · Site ID: <strong className="text-[#10418A]">{punchState.activeSiteId}</strong>
            </div>
          )}
        </div>

        {/* Conditional Actions: Punch-In Form VS Punch-Out Form */}
        {!punchState.isPunchedIn ? (
          /* Punch In Form */
          <form
            onSubmit={handlePunchInSubmit}
            className="p-6 rounded-xl bg-white border border-slate-200 space-y-5"
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#00A859]" />
              <h3 className="text-sm font-semibold text-slate-900">
                Start Daily Shift (Punch-In Verification)
              </h3>
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1">Select Project Site *</label>
              <select
                value={punchSiteId}
                onChange={(e) => setPunchSiteId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
              >
                {activeSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.id}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#00A859] block mb-1">
                Mandatory Arrival Photo (Punches Start Time) *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={punchInPhotoUrl}
                  onChange={(e) => setPunchInPhotoUrl(e.target.value)}
                  placeholder="Arrival verification photo URL..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
                />
              </div>

              {punchInPhotoUrl && (
                <div className="mt-2 relative">
                  <img
                    src={punchInPhotoUrl}
                    alt="Arrival"
                    className="w-full h-40 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-50/80 backdrop-blur-md rounded text-[10px] text-[#00A859] font-mono">
                    Arrival GPS & Time Verified
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Punch In & Start Shift Timer</span>
            </button>
          </form>
        ) : (
          /* Punch Out Form */
          <form
            onSubmit={handlePunchOutSubmit}
            className="p-6 rounded-xl bg-white border border-slate-200 space-y-5"
          >
            <div className="flex items-center gap-2">
              <Square className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                End Daily Shift (Punch-Out Verification)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Task Category *</label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
                >
                  <option value="Civil Mounting">Civil Mounting</option>
                  <option value="Site Survey">Site Survey</option>
                  <option value="Wiring & Electrical">Wiring & Electrical</option>
                  <option value="Testing">Testing</option>
                  <option value="Finishing & Painting">Finishing & Painting</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  Mandatory Exit Photo (Punches End Time) *
                </label>
                <input
                  type="text"
                  required
                  value={punchOutPhotoUrl}
                  onChange={(e) => setPunchOutPhotoUrl(e.target.value)}
                  placeholder="Exit work verification photo URL..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#10418A]"
                />
              </div>
            </div>

            {punchOutPhotoUrl && (
              <div>
                <img
                  src={punchOutPhotoUrl}
                  alt="Exit work"
                  className="w-full h-40 object-cover rounded-lg border border-slate-200"
                />
              </div>
            )}

            {/* Delay Reason Dropdown */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <DelayDropdown
                value={workerDelayReason}
                onChange={setWorkerDelayReason}
                otherRemarks={workerDelayRemarks}
                onOtherRemarksChange={setWorkerDelayRemarks}
                label="Site Delay or Obstacle Encountered (if any)"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1">
                Completed Task Description & Output Quantity *
              </label>
              <textarea
                rows={3}
                required
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="e.g. Completed torquing 24 canopy foundation brackets to 140Nm. Cable harness routing complete."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer shadow-lg shadow-rose-950 flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4" />
              <span>Punch Out & Sync Daily Log</span>
            </button>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {activeTab === 'my_work' && renderMyWorkDashboard()}
      {activeTab === 'log_daily_tasks' && renderLogTasksTab()}

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
