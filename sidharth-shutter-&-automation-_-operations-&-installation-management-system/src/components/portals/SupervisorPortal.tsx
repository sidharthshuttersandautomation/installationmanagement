import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SiteItem, DailyLogEntry, WorkerProfile, TaskCategory, SiteStatus, DelayReason, DELAY_REASONS } from '../../types';
import { ExcelDrawer, ColumnDef } from '../ExcelDrawer';
import { DelayDropdown } from '../DelayDropdown';
import {
  FileSpreadsheet,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Calendar,
  Clock,
  HardHat,
  Users,
  Award,
  Star,
  ChevronRight,
  Plus,
  Send,
  Camera,
  Check,
  AlertCircle,
  Flag,
} from 'lucide-react';

interface SupervisorPortalProps {
  activeTab: string;
}

export const SupervisorPortal: React.FC<SupervisorPortalProps> = ({ activeTab }) => {
  const {
    currentUser,
    activeSites,
    dailyLogs,
    workers,
    notifications,
    updateSiteStatus,
    addSitePhoto,
    handoverSite,
    logDailyTask,
  } = useApp();

  // Excel Drawer State
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelTitle, setExcelTitle] = useState('Supervisor Data Export');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<ColumnDef<any>[]>([]);
  const [excelFileName, setExcelFileName] = useState('supervisor_data');

  // View Logs & Update Status state
  const [selectedSiteId, setSelectedSiteId] = useState<string>(activeSites[0]?.id || '');
  const [newProgress, setNewProgress] = useState<number>(activeSites[0]?.progress || 50);
  const [newStatus, setNewStatus] = useState<SiteStatus>(activeSites[0]?.status || 'in_progress');
  const [selectedDelayReason, setSelectedDelayReason] = useState<DelayReason>('Client Site Unavailability');
  const [delayJustificationInput, setDelayJustificationInput] = useState('');
  const [supervisorNote, setSupervisorNote] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [updateSaved, setUpdateSaved] = useState(false);

  // Post-Completion Handover & Rating Modal State
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverSiteId, setHandoverSiteId] = useState<string>(activeSites[0]?.id || '');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [workerRatingsState, setWorkerRatingsState] = useState<
    Record<
      string,
      {
        score: number;
        punctuality: number;
        workmanship: number;
        safety: number;
        speed: number;
        notes: string;
      }
    >
  >({});

  const currentSite = activeSites.find((s) => s.id === selectedSiteId) || activeSites[0];
  const currentLogs = dailyLogs.filter((l) => l.siteId === currentSite?.id);

  const openExcel = (title: string, data: any[], columns: ColumnDef<any>[], fileName: string) => {
    setExcelTitle(title);
    setExcelData(data);
    setExcelColumns(columns);
    setExcelFileName(fileName);
    setExcelOpen(true);
  };

  /* -------------------------------------------------------------------------- */
  /*                 TAB 1: NEW INSTALLATION REQUESTS TAB                       */
  /* -------------------------------------------------------------------------- */
  const renderNewRequestsTab = () => {
    const siteVisitRequests = notifications.filter(
      (n) => n.targetRoles.includes('supervisor') && n.title.includes('Site Visit Request')
    );

    const dispatchedOrders = activeSites.filter((s) => s.production.isDispatched);

    const requestCols: ColumnDef<any>[] = [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Alert Title' },
      { key: 'message', label: 'Message Details' },
      { key: 'timestamp', label: 'Timestamp' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              New Installation & Alignment Requests
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Priority action notifications for upcoming project surveys and material arrivals.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Supervisor Action Notifications', notifications, requestCols, 'supervisor_requests')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* 2 Action-Required Notification Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action Card 1: New Site Visit Requests */}
          <div className="p-5 rounded-xl bg-white border border-rose-200 hover:border-rose-500/50 transition-all space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-700 font-semibold">
                    🚨 [{siteVisitRequests.length}] New Site Visit Requests Awaiting Supervisor Action!
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sales deals confirmed. Initial site survey & structural baseline required.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {siteVisitRequests.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No pending site visit requests at this time.
                </p>
              ) : (
                siteVisitRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="font-semibold text-slate-800">{req.title}</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{req.message}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-slate-500">{req.timestamp}</span>
                      <button
                        onClick={() => alert('Site survey scheduled. Survey manifest logged.')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors cursor-pointer"
                      >
                        Acknowledge & Schedule Survey
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Card 2: Orders Dispatched — Team Alignment Required */}
          <div className="p-5 rounded-xl bg-white border border-amber-500/30 hover:border-amber-400 transition-all space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-800">
                    🚚 [{dispatchedOrders.length}] Orders Dispatched — Team Alignment Required!
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Materials in transit. Align installation crew & offloading equipment.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {dispatchedOrders.map((site) => (
                <div
                  key={site.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[#10418A]">{site.id}</span>
                      <span className="font-semibold text-slate-800 ml-1.5">{site.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      In Transit
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    <div>Vehicle Reg: <strong className="text-slate-800 font-mono">{site.production.vehicleRegNumber}</strong></div>
                    <div>Address: {site.deliveryAddress}</div>
                  </div>

                  {site.production.vehiclePhoto && (
                    <img
                      src={site.production.vehiclePhoto}
                      alt="Dispatched Truck"
                      className="w-full h-24 object-cover rounded border border-slate-200"
                    />
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Target Handover: {site.targetHandoverDate}
                    </span>
                    <button
                      onClick={() => alert(`Crew assigned to receive shipment at ${site.name}.`)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors cursor-pointer"
                    >
                      Confirm Crew Alignment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                  TAB 2: VIEW LOGS & UPDATE STATUS TAB                      */
  /* -------------------------------------------------------------------------- */
  const renderViewLogsTab = () => {
    // Dropdown filters ONLY active ongoing and on-hold sites (completed/handed-over are filtered out)
    const ongoingAndOnHoldSites = activeSites.filter(
      (s) => s.status === 'in_progress' || s.status === 'on_hold' || s.status === 'upcoming'
    );

    const logCols: ColumnDef<DailyLogEntry>[] = [
      { key: 'id', label: 'Log ID' },
      { key: 'date', label: 'Date' },
      { key: 'workerName', label: 'Worker' },
      { key: 'taskCategory', label: 'Task Category' },
      { key: 'hoursWorked', label: 'Hours', align: 'right' },
      { key: 'description', label: 'Description' },
    ];

    const handleSaveSiteUpdate = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentSite) return;

      const finalHoldReason =
        selectedDelayReason === 'Other' && delayJustificationInput.trim()
          ? `On Hold: Other — ${delayJustificationInput.trim()}`
          : `On Hold: ${selectedDelayReason}`;

      updateSiteStatus(
        currentSite.id,
        newStatus,
        newProgress,
        newStatus === 'on_hold' ? finalHoldReason : undefined,
        delayJustificationInput || undefined
      );

      if (supervisorNote.trim()) {
        logDailyTask({
          siteId: currentSite.id,
          siteName: currentSite.name,
          date: new Date().toISOString().slice(0, 10),
          workerId: currentUser.id,
          workerName: currentUser.name,
          workerRole: 'Site Supervisor',
          taskCategory: 'Site Survey',
          description: `[Supervisor Daily Review]: ${supervisorNote} ${
            newStatus === 'on_hold' ? `(Delay Flag: ${selectedDelayReason})` : ''
          }`,
          startTime: '09:00 AM',
          endTime: '05:00 PM',
          hoursWorked: 8.0,
          delayCategory: selectedDelayReason,
          siteRemarks: delayJustificationInput,
        });
        setSupervisorNote('');
      }

      setUpdateSaved(true);
      setTimeout(() => setUpdateSaved(false), 2000);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Site Status & Daily Logs Console</h1>
            <p className="text-xs text-slate-600 mt-1">
              Active ongoing & on-hold sites only (completed projects archived to Master Database).
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Site Daily Logs', currentLogs, logCols, 'supervisor_daily_logs')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Ongoing & On-Hold Site Dropdown */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-700">Select Active Site:</span>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                const s = ongoingAndOnHoldSites.find((site) => site.id === e.target.value);
                if (s) {
                  setNewProgress(s.progress);
                  setNewStatus(s.status);
                  setDelayJustificationInput(s.delayJustification || '');
                }
              }}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-[#10418A]"
            >
              {ongoingAndOnHoldSites.map((site) => (
                <option key={site.id} value={site.id}>
                  [{site.id}] {site.name} — {site.status.replace('_', ' ').toUpperCase()} ({site.progress}%)
                </option>
              ))}
            </select>
          </div>

          {currentSite && (
            <button
              onClick={() => {
                setHandoverSiteId(currentSite.id);
                // Pre-populate rating state for assigned workers
                const initialMap: Record<string, any> = {};
                currentSite.assignedWorkers.forEach((w) => {
                  initialMap[w.workerId] = {
                    score: 9.0,
                    punctuality: 9.0,
                    workmanship: 9.0,
                    safety: 9.5,
                    speed: 9.0,
                    notes: 'Demonstrated high technical competence during installation.',
                  };
                });
                setWorkerRatingsState(initialMap);
                setHandoverModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Handover Site (Archive)</span>
            </button>
          )}
        </div>

        {currentSite && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Update Status Form */}
            <form
              onSubmit={handleSaveSiteUpdate}
              className="p-5 rounded-xl bg-white border border-slate-200 space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">Update Site Telemetry & Status</h3>

              {updateSaved && (
                <div className="p-2.5 rounded bg-emerald-50 border border-[#00A859]/30 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> Changes successfully saved!
                </div>
              )}

              {/* Progress slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Installation Progress</span>
                  <span className="font-mono text-[#10418A] font-bold">{newProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newProgress}
                  onChange={(e) => setNewProgress(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Status toggles */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 block">Site Operating Status</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewStatus('in_progress')}
                    className={`p-2 rounded-lg border font-medium cursor-pointer ${
                      newStatus === 'in_progress'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    In-Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('on_hold')}
                    className={`p-2 rounded-lg border font-medium cursor-pointer ${
                      newStatus === 'on_hold'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    On-Hold
                  </button>
                </div>
              </div>

              {/* Mandatory Hold Reason if On Hold */}
              {newStatus === 'on_hold' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 animate-fadeIn space-y-2">
                  <DelayDropdown
                    value={selectedDelayReason}
                    onChange={setSelectedDelayReason}
                    otherRemarks={delayJustificationInput}
                    onOtherRemarksChange={setDelayJustificationInput}
                    label="Primary Delay Reason Category (Mandatory) *"
                    required
                  />
                </div>
              )}

              {/* Delay Justification / Schedule Notes if In-Progress */}
              {newStatus === 'in_progress' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 font-semibold block">
                    Daily Schedule &amp; Execution Notes
                  </label>
                  <input
                    type="text"
                    value={delayJustificationInput}
                    onChange={(e) => setDelayJustificationInput(e.target.value)}
                    placeholder="e.g. Foundation brackets aligned; electrical hoist ready..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
                  />
                </div>
              )}

              {/* Daily Supervisor Notes */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 block">
                  Add Daily Supervisor Verification Note
                </label>
                <textarea
                  rows={2}
                  value={supervisorNote}
                  onChange={(e) => setSupervisorNote(e.target.value)}
                  placeholder="e.g. Verified torque check on all 36 foundation anchors..."
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#10418A]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold bg-indigo-600 hover:bg-[#10418A] text-white rounded-lg transition-colors cursor-pointer"
              >
                Save Site Telemetry
              </button>
            </form>

            {/* Daily Logs Feed for Site */}
            <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Field Logs & Worker Submissions ({currentLogs.length})
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Assigned Crew: {currentSite.assignedWorkers.length}
                </span>
              </div>

              {currentLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No logs recorded for this site yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {currentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{log.workerName}</span>
                          <span className="text-slate-600 font-mono text-[11px]">
                            ({log.workerRole})
                          </span>
                        </div>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {log.date} · {log.startTime} - {log.endTime} ({log.hoursWorked} hrs)
                        </span>
                      </div>

                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        <strong className="text-[#10418A]">[{log.taskCategory}]:</strong>{' '}
                        {log.description}
                      </p>

                      {/* Photo previews */}
                      {(log.punchInPhoto || log.punchOutPhoto) && (
                        <div className="flex gap-3 pt-1">
                          {log.punchInPhoto && (
                            <div>
                              <span className="text-[10px] text-slate-500 block">Arrival Punch:</span>
                              <img
                                src={log.punchInPhoto}
                                alt="Arrival"
                                className="w-20 h-14 object-cover rounded border border-slate-200 mt-0.5"
                              />
                            </div>
                          )}
                          {log.punchOutPhoto && (
                            <div>
                              <span className="text-[10px] text-slate-500 block">Departure Punch:</span>
                              <img
                                src={log.punchOutPhoto}
                                alt="Departure"
                                className="w-20 h-14 object-cover rounded border border-slate-200 mt-0.5"
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
        )}

        {/* Post-Completion Handover & Mandatory 1-10 Worker Rating Modal */}
        {handoverModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#00A859]" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Post-Completion Site Handover & Worker Performance Scorecard
                  </h3>
                </div>
                <button
                  onClick={() => setHandoverModalOpen(false)}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                <p className="text-xs text-slate-600">
                  Submitting handover will permanently archive this site to the Master Database and record
                  your 1-10 performance ratings in each worker's profile.
                </p>

                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">
                    Client Handover Sign-off Notes *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Commissioning tests passed at 100%. Client Facility Director signed handover certificate."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Rate Assigned Crew Members (Scale 1–10)
                  </h4>

                  {currentSite?.assignedWorkers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No assigned workers on this site.</p>
                  ) : (
                    currentSite?.assignedWorkers.map((w) => {
                      const r = workerRatingsState[w.workerId] || {
                        score: 9.0,
                        punctuality: 9.0,
                        workmanship: 9.0,
                        safety: 9.0,
                        speed: 9.0,
                        notes: '',
                      };

                      return (
                        <div
                          key={w.workerId}
                          className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-800">{w.name}</span>
                              <span className="text-[11px] font-mono text-slate-600 ml-2">
                                [{w.workerId} · {w.role}]
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-600">Overall Score:</span>
                              <span className="font-bold font-mono text-[#00A859] text-sm">
                                {r.score} / 10
                              </span>
                            </div>
                          </div>

                          {/* 4 Metric Sub-sliders */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <span className="text-[10px] text-slate-600 block">
                                Punctuality: {r.punctuality}
                              </span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.5"
                                value={r.punctuality}
                                onChange={(e) =>
                                  setWorkerRatingsState({
                                    ...workerRatingsState,
                                    [w.workerId]: { ...r, punctuality: Number(e.target.value) },
                                  })
                                }
                                className="w-full accent-indigo-500"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-600 block">
                                Workmanship: {r.workmanship}
                              </span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.5"
                                value={r.workmanship}
                                onChange={(e) =>
                                  setWorkerRatingsState({
                                    ...workerRatingsState,
                                    [w.workerId]: { ...r, workmanship: Number(e.target.value) },
                                  })
                                }
                                className="w-full accent-indigo-500"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-600 block">
                                Safety/PPE: {r.safety}
                              </span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.5"
                                value={r.safety}
                                onChange={(e) =>
                                  setWorkerRatingsState({
                                    ...workerRatingsState,
                                    [w.workerId]: { ...r, safety: Number(e.target.value) },
                                  })
                                }
                                className="w-full accent-indigo-500"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-600 block">
                                Speed: {r.speed}
                              </span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.5"
                                value={r.speed}
                                onChange={(e) =>
                                  setWorkerRatingsState({
                                    ...workerRatingsState,
                                    [w.workerId]: { ...r, speed: Number(e.target.value) },
                                  })
                                }
                                className="w-full accent-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={r.notes}
                              onChange={(e) =>
                                setWorkerRatingsState({
                                  ...workerRatingsState,
                                  [w.workerId]: { ...r, notes: e.target.value },
                                })
                              }
                              placeholder="Supervisor performance comments & commended tasks..."
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-800"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
                <button
                  onClick={() => setHandoverModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const ratingsList = (currentSite?.assignedWorkers || []).map((w) => {
                      const r = workerRatingsState[w.workerId] || {
                        score: 9.0,
                        punctuality: 9.0,
                        workmanship: 9.0,
                        safety: 9.0,
                        speed: 9.0,
                        notes: 'Demonstrated solid field performance.',
                      };
                      return {
                        workerId: w.workerId,
                        score: Number(
                          (
                            (r.punctuality + r.workmanship + r.safety + r.speed) /
                            4
                          ).toFixed(1)
                        ),
                        metrics: {
                          punctuality: r.punctuality,
                          workmanship: r.workmanship,
                          safety: r.safety,
                          speed: r.speed,
                        },
                        notes: r.notes || 'Good performance throughout installation.',
                      };
                    });

                    handoverSite(
                      handoverSiteId,
                      handoverNotes || 'Handover completed successfully.',
                      ratingsList
                    );
                    setHandoverModalOpen(false);
                  }}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                >
                  Confirm Handover & Archive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                 TAB 3: HANDOVER DATE DASHBOARD TAB (GANTT)                 */
  /* -------------------------------------------------------------------------- */
  const renderHandoverDashboardTab = () => {
    const today = new Date().toISOString().slice(0, 10);

    const ganttCols: ColumnDef<SiteItem>[] = [
      { key: 'id', label: 'Site ID' },
      { key: 'name', label: 'Site Name' },
      { key: 'status', label: 'Status' },
      { key: 'targetHandoverDate', label: 'Target Handover' },
      { key: 'delayDays', label: 'Delay (Days)', align: 'right' },
      { key: 'delayJustification', label: 'Delay Justification' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Handover Date Timeline & Gantt Monitor</h1>
            <p className="text-xs text-slate-600 mt-1">
              Automated "Danger Flags" (🚨) on sites exceeding target handover dates with mandatory delay justification logs.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Handover Timeline Gantt', activeSites, ganttCols, 'handover_gantt_timeline')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Visual Timeline / Gantt Cards */}
        <div className="space-y-4">
          {activeSites.map((site) => {
            const isExceeded = site.targetHandoverDate < today || (site.delayDays && site.delayDays > 0);

            return (
              <div
                key={site.id}
                className={`p-5 rounded-xl bg-white border transition-all ${
                  isExceeded
                    ? 'border-rose-500/40 shadow-lg shadow-rose-950/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {isExceeded ? (
                      <span className="p-2 rounded-lg bg-rose-500/15 text-rose-600 border border-rose-200 font-bold flex items-center gap-1 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>DANGER FLAG 🚨</span>
                      </span>
                    ) : (
                      <span className="p-2 rounded-lg bg-emerald-50 text-[#00A859] border border-[#00A859]/30 font-bold flex items-center gap-1 text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ON SCHEDULE</span>
                      </span>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#10418A]">{site.id}</span>
                        <h3 className="text-base font-semibold text-slate-900">{site.name}</h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Client: {site.clientName} · Location: {site.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>
                      Target Handover:{' '}
                      <strong className={isExceeded ? 'text-rose-600' : 'text-slate-800'}>
                        {site.targetHandoverDate}
                      </strong>
                    </span>
                    {isExceeded && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 font-bold">
                        +{site.delayDays || 7} Days Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Delay Justification if Exceeded */}
                {isExceeded && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-rose-600" />
                      <span>Mandatory Delay Justification Logged by Team:</span>
                    </div>
                    <p className="text-rose-200/90 leading-relaxed pl-5">
                      "{site.delayJustification || 'Heavy monsoon and site utility delay. Dry-out protocol enforced prior to panel commissioning.'}"
                    </p>
                  </div>
                )}

                {/* Visual Gantt Bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Kickoff: {site.createdAt}</span>
                    <span>Progress: {site.progress}%</span>
                    <span>Deadline: {site.targetHandoverDate}</span>
                  </div>
                  <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${site.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*            TAB 4: EMPLOYEE ANALYTICS & AVAILABILITY TAB                    */
  /* -------------------------------------------------------------------------- */
  const renderCrewAnalyticsTab = () => {
    const roles: ('Installer' | 'Helper' | 'Team Lead' | 'Painter' | 'Electrician')[] = [
      'Installer',
      'Helper',
      'Team Lead',
      'Painter',
      'Electrician',
    ];

    // Real-time crew availability counters
    const crewCounters = roles.map((role) => {
      const total = workers.filter((w) => w.designation === role).length;
      const deployed = workers.filter((w) => w.designation === role && w.status === 'Deployed').length;
      const available = workers.filter((w) => w.designation === role && w.status === 'Available').length;
      return { role, total, deployed, available };
    });

    // Task Analytics & Hall of Fame: Top 3 Efficiency Badges
    const taskCategories: TaskCategory[] = [
      'Civil Mounting',
      'Site Survey',
      'Wiring & Electrical',
      'Testing',
    ];

    const workerCols: ColumnDef<WorkerProfile>[] = [
      { key: 'id', label: 'Worker ID' },
      { key: 'name', label: 'Worker Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'status', label: 'Status' },
      { key: 'totalHours', label: 'Total Hours', align: 'right' },
      { key: 'sitesVisitedCount', label: 'Sites Visited', align: 'right' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Crew Availability & Task Hall of Fame</h1>
            <p className="text-xs text-slate-600 mt-1">
              Real-time crew deployment breakdown and Top 3 efficiency badges across execution tasks.
            </p>
          </div>

          <button
            onClick={() =>
              openExcel('Supervisor Crew Directory', workers, workerCols, 'supervisor_crew_analytics')
            }
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#00A859] bg-emerald-50 hover:bg-emerald-500/20 border border-[#00A859]/30 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / Raw Data View</span>
          </button>
        </div>

        {/* Real-time Crew Availability Counter */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#10418A]" />
              <span>Real-Time Crew Availability Breakdown</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {workers.length} Total Registered Personnel
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {crewCounters.map((item) => (
              <div
                key={item.role}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="font-semibold text-slate-800">{item.role}s</div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-lg font-bold text-slate-900">{item.total}</span>
                  <span className="text-[11px] text-slate-500">Total</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono pt-1 border-t border-slate-200">
                  <span className="text-[#10418A]">{item.deployed} Deployed</span>
                  <span className="text-[#00A859] font-bold">{item.available} Free</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Analytics & Hall of Fame: Top 3 Efficiency Badges */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Task Analytics & Hall of Fame (Top 3 Performers Per Category)</span>
            </h3>
            <span className="text-xs font-mono text-amber-600">★ Efficiency Badges</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskCategories.map((task) => {
              // Find top 3 workers with highest speed rating or completed units in this task
              const ranked = [...workers]
                .map((w) => {
                  const eff = w.taskEfficiency.find((te) => te.task === task);
                  return {
                    worker: w,
                    score: eff ? eff.avgSpeedScore : 8.0,
                    units: eff ? eff.completedUnits : 10,
                  };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

              return (
                <div
                  key={task}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="font-semibold text-slate-800 border-b border-slate-200 pb-2">
                    {task}
                  </div>

                  <div className="space-y-2">
                    {ranked.map((item, idx) => (
                      <div
                        key={item.worker.id}
                        className="flex items-center justify-between p-2 rounded bg-white border border-slate-200/80"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-medium text-slate-800">{item.worker.name}</span>
                            <span className="text-[10px] text-slate-500 block">
                              {item.worker.designation}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono text-[#00A859] font-bold">
                          {item.score}/10
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {activeTab === 'new_requests' && renderNewRequestsTab()}
      {activeTab === 'view_logs_status' && renderViewLogsTab()}
      {activeTab === 'handover_dashboard' && renderHandoverDashboardTab()}
      {activeTab === 'crew_analytics' && renderCrewAnalyticsTab()}

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
