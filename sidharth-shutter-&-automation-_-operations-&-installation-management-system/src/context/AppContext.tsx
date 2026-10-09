import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  UserRole,
  SiteItem,
  DealItem,
  WorkerProfile,
  DailyLogEntry,
  NotificationItem,
  SiteStatus,
  TaskCategory,
  DelayReason,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_SITES,
  INITIAL_DEALS,
  INITIAL_WORKERS,
  INITIAL_DAILY_LOGS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';

interface PunchState {
  isPunchedIn: boolean;
  punchedInAt: string | null;
  punchInPhoto: string | null;
  activeSiteId: string;
}

interface AppContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  setCurrentUser: (user: UserProfile) => void;
  switchRole: (role: UserRole) => void;
  sites: SiteItem[];
  activeSites: SiteItem[];
  masterSites: SiteItem[];
  deals: DealItem[];
  workers: WorkerProfile[];
  dailyLogs: DailyLogEntry[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  punchState: PunchState;
  
  // Actions
  confirmDeal: (dealId: string) => void;
  loseDeal: (dealId: string, reason: string) => void;
  createDeal: (deal: Omit<DealItem, 'id' | 'createdAt'>) => void;
  commitProductionTimeline: (
    siteId: string,
    manufacturingDays: number,
    committedDate: string,
    targetDispatchDate: string,
    completionPct?: number
  ) => void;
  dispatchOrder: (
    siteId: string,
    vehicleRegNumber: string,
    trackingId: string,
    trackingUrl: string,
    vehiclePhoto?: string
  ) => void;
  sendPreDispatchReminder: (siteId: string) => void;
  handoverSite: (
    siteId: string,
    handoverNotes: string,
    workerRatings: {
      workerId: string;
      score: number;
      metrics: { punctuality: number; workmanship: number; safety: number; speed: number };
      notes: string;
    }[]
  ) => void;
  updateSiteStatus: (
    siteId: string,
    status: SiteStatus,
    progress: number,
    holdReason?: string,
    delayJustification?: string,
    delayDays?: number
  ) => void;
  addSitePhoto: (siteId: string, photo: { url: string; caption: string; tag: 'site' | 'issue' | 'progress' | 'completion' }) => void;
  logDailyTask: (log: Omit<DailyLogEntry, 'id'>) => void;
  punchIn: (siteId: string, photoUrl: string) => void;
  punchOut: (
    photoUrl: string,
    taskCategory: TaskCategory,
    description: string,
    delayCategory?: DelayReason,
    siteRemarks?: string
  ) => void;
  allocateBudget: (
    siteId: string,
    budget: { food: number; travel: number; lodging: number; contingency: number }
  ) => void;
  requestContingency: (siteId: string, amount: number, justification: string) => void;
  approveContingency: (siteId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetDataToDefault: () => void;
}

const STORAGE_KEY = 'opsflow_state_v1';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [allUsers] = useState<UserProfile[]>(INITIAL_USERS);
  
  const [sites, setSites] = useState<SiteItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_sites`);
    return saved ? JSON.parse(saved) : INITIAL_SITES;
  });

  const [deals, setDeals] = useState<DealItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_deals`);
    return saved ? JSON.parse(saved) : INITIAL_DEALS;
  });

  const [workers, setWorkers] = useState<WorkerProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_workers`);
    return saved ? JSON.parse(saved) : INITIAL_WORKERS;
  });

  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
    return saved ? JSON.parse(saved) : INITIAL_DAILY_LOGS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_notifs`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [punchState, setPunchState] = useState<PunchState>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_punch`);
    return saved
      ? JSON.parse(saved)
      : {
          isPunchedIn: false,
          punchedInAt: null,
          punchInPhoto: null,
          activeSiteId: 'SITE-101',
        };
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_sites`, JSON.stringify(sites));
  }, [sites]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_deals`, JSON.stringify(deals));
  }, [deals]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(dailyLogs));
  }, [dailyLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_notifs`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_punch`, JSON.stringify(punchState));
  }, [punchState]);

  const activeSites = sites.filter((s) => s.status !== 'handed_over' && s.status !== 'completed');
  const masterSites = sites.filter((s) => s.status === 'handed_over' || s.status === 'completed');

  const unreadNotificationsCount = notifications.filter(
    (n) => !n.read && n.targetRoles.includes(currentUser.role)
  ).length;

  const switchRole = (role: UserRole) => {
    const found = allUsers.find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
    } else {
      setCurrentUser({
        id: role === 'worker' ? 'WRK001' : `${role.toUpperCase().slice(0, 3)}001`,
        name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        role,
        email: `${role}@opsflow.io`,
      });
    }
  };

  const addNotification = (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...notif,
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Cross-Portal Workflow 1: Order Confirmation
  const confirmDeal = (dealId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, status: 'Confirmed' as const, confirmedAt: new Date().toISOString().slice(0, 10) }
          : d
      )
    );

    // Auto-alert Logistics & Production Manager (financial value hidden)
    addNotification({
      targetRoles: ['logistics', 'production'],
      title: `Order Confirmed: ${deal.siteName}`,
      message: `Product Specs: ${deal.productSpecs} | Site Name: ${deal.siteName} | Delivery Address: ${deal.location} (${deal.region} Region). (Deal financial value hidden).`,
      level: 'info',
    });

    // Simultaneous alert to Supervisor under Upcoming Orders / Site Visit Requests
    addNotification({
      targetRoles: ['supervisor'],
      title: `🚨 New Site Visit Request: ${deal.siteName}`,
      message: `Upcoming Order confirmed for ${deal.siteName} in ${deal.location}. Awaiting supervisor site visit & survey alignment.`,
      level: 'urgent',
    });

    // Check if site already exists, else create an upcoming site entry
    const existingSite = sites.find((s) => s.name === deal.siteName);
    if (!existingSite) {
      const newSiteId = `SITE-${Math.floor(110 + Math.random() * 880)}`;
      const newSite: SiteItem = {
        id: newSiteId,
        name: deal.siteName,
        clientName: deal.client,
        deliveryAddress: `${deal.location}, ${deal.region} Sector`,
        location: deal.location,
        region: deal.region,
        status: 'upcoming',
        progress: 0,
        salespersonId: deal.salespersonId,
        salespersonName: deal.salespersonName,
        dealValue: deal.value,
        targetHandoverDate: deal.targetCloseDate,
        assignedSupervisorId: 'SV001',
        assignedSupervisorName: 'Rajesh Kumar',
        assignedWorkers: [],
        photos: [],
        budget: {
          allocated: Math.round(deal.value * 0.6),
          food: Math.round(deal.value * 0.08),
          travel: Math.round(deal.value * 0.15),
          lodging: Math.round(deal.value * 0.25),
          contingency: Math.round(deal.value * 0.12),
          spentFood: 0,
          spentTravel: 0,
          spentLodging: 0,
          spentOther: 0,
        },
        production: {
          orderId: `PRD-${Math.floor(8900 + Math.random() * 1000)}`,
          itemSpecs: deal.productSpecs,
          productCategory: deal.productCategory,
          manufacturingDays: 20,
          completionPct: 15,
          committedDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
          targetDispatchDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
          isDispatched: false,
        },
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setSites((prev) => [newSite, ...prev]);
    }
  };

  const loseDeal = (dealId: string, reason: string) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status: 'Lost' as const, lostReason: reason } : d))
    );
  };

  const createDeal = (deal: Omit<DealItem, 'id' | 'createdAt'>) => {
    const newDeal: DealItem = {
      ...deal,
      id: `DEAL-${Math.floor(900 + Math.random() * 100)}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setDeals((prev) => [newDeal, ...prev]);
  };

  // Cross-Portal Workflow 2: Production Timeline Commitment
  const commitProductionTimeline = (
    siteId: string,
    manufacturingDays: number,
    committedDate: string,
    targetDispatchDate: string,
    completionPct: number = 40
  ) => {
    const targetSite = sites.find((s) => s.id === siteId);
    if (!targetSite) return;

    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              production: {
                ...s.production,
                manufacturingDays,
                committedDate,
                targetDispatchDate,
                completionPct,
              },
            }
          : s
      )
    );

    // Auto-sends alert to Salesperson to track real-time build progress
    addNotification({
      targetRoles: ['salesperson', 'admin'],
      title: `Production Committed: ${targetSite.name}`,
      message: `Production Manager logged timeline: ${manufacturingDays} manufacturing days. Target Completion: ${committedDate}, Target Dispatch: ${targetDispatchDate}.`,
      level: 'info',
      relatedSiteId: siteId,
    });
  };

  // Cross-Portal Workflow 3: Dispatch & Pre-Arrival Reminder
  const sendPreDispatchReminder = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    addNotification({
      targetRoles: ['admin', 'logistics', 'supervisor'],
      title: `🚨 3 Days Before Dispatch Reminder: ${site.name}`,
      message: `Automated alert: Site ${site.name} dispatch scheduled in 3 days (${site.production.targetDispatchDate}). Verify site readiness and offloading equipment.`,
      level: 'warning',
      relatedSiteId: siteId,
    });
  };

  const dispatchOrder = (
    siteId: string,
    vehicleRegNumber: string,
    trackingId: string,
    trackingUrl: string,
    vehiclePhoto?: string
  ) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              status: s.status === 'upcoming' ? 'in_progress' : s.status,
              production: {
                ...s.production,
                isDispatched: true,
                dispatchDate: todayStr,
                vehicleRegNumber,
                trackingId,
                trackingUrl,
                vehiclePhoto: vehiclePhoto || s.production.vehiclePhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
              },
            }
          : s
      )
    );

    // Supervisor high-priority alert
    addNotification({
      targetRoles: ['supervisor'],
      title: `🚚 Order Dispatched — Urgent Team Alignment Required!`,
      message: `Site ${site.name} dispatched via Vehicle ${vehicleRegNumber}. Tracking: ${trackingId}. Tracking Link: ${trackingUrl}. Team alignment required upon arrival.`,
      level: 'urgent',
      relatedSiteId: siteId,
    });

    // Alert Admin & Salesperson
    addNotification({
      targetRoles: ['admin', 'salesperson'],
      title: `Order In-Transit: ${site.name}`,
      message: `Materials dispatched on Vehicle ${vehicleRegNumber}. Tracking: ${trackingId}.`,
      level: 'info',
      relatedSiteId: siteId,
    });
  };

  // Cross-Portal Workflow 4: Site Handover (archives out of active dropdowns into Master Database)
  const handoverSite = (
    siteId: string,
    handoverNotes: string,
    workerRatings: {
      workerId: string;
      score: number;
      metrics: { punctuality: number; workmanship: number; safety: number; speed: number };
      notes: string;
    }[]
  ) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const avgScore =
      workerRatings.length > 0
        ? Number(
            (
              workerRatings.reduce((acc, curr) => acc + curr.score, 0) /
              workerRatings.length
            ).toFixed(1)
          )
        : 9.5;

    // Update Site to 'handed_over'
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              status: 'handed_over' as const,
              progress: 100,
              actualHandoverDate: todayStr,
              handoverNotes,
              handoverRatingAvg: avgScore,
            }
          : s
      )
    );

    // Update Worker scorecards & make assigned workers available
    setWorkers((prev) =>
      prev.map((worker) => {
        const ratingForWorker = workerRatings.find((r) => r.workerId === worker.id);
        const wasAssigned = site.assignedWorkers.some((w) => w.workerId === worker.id);

        if (ratingForWorker) {
          const newRating = {
            siteId: site.id,
            siteName: site.name,
            supervisorId: currentUser.id,
            supervisorName: currentUser.name,
            score: ratingForWorker.score,
            metrics: ratingForWorker.metrics,
            notes: ratingForWorker.notes,
            date: todayStr,
          };
          return {
            ...worker,
            status: 'Available' as const,
            currentSiteId: undefined,
            currentSiteName: undefined,
            sitesVisitedCount: worker.sitesVisitedCount + 1,
            ratings: [newRating, ...worker.ratings],
          };
        } else if (wasAssigned) {
          return {
            ...worker,
            status: 'Available' as const,
            currentSiteId: undefined,
            currentSiteName: undefined,
          };
        }
        return worker;
      })
    );

    // Notify Admin, Salesperson, Budget Manager
    addNotification({
      targetRoles: ['admin', 'salesperson', 'budget'],
      title: `Site Handover Complete: ${site.name}`,
      message: `Site ${site.name} successfully handed over to client. Archived to Master Database. Performance Avg: ${avgScore}/10.`,
      level: 'success',
      relatedSiteId: siteId,
    });
  };

  const updateSiteStatus = (
    siteId: string,
    status: SiteStatus,
    progress: number,
    holdReason?: string,
    delayJustification?: string,
    delayDays?: number
  ) => {
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              status,
              progress,
              holdReason: holdReason !== undefined ? holdReason : s.holdReason,
              delayJustification: delayJustification !== undefined ? delayJustification : s.delayJustification,
              delayDays: delayDays !== undefined ? delayDays : s.delayDays,
            }
          : s
      )
    );
  };

  const addSitePhoto = (
    siteId: string,
    photo: { url: string; caption: string; tag: 'site' | 'issue' | 'progress' | 'completion' }
  ) => {
    const newPhoto = {
      ...photo,
      id: `PHT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, photos: [newPhoto, ...s.photos] } : s))
    );
  };

  const logDailyTask = (log: Omit<DailyLogEntry, 'id'>) => {
    const newLog: DailyLogEntry = {
      ...log,
      id: `LOG-${Date.now()}`,
    };
    setDailyLogs((prev) => [newLog, ...prev]);

    // Update worker stats
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === log.workerId
          ? {
              ...w,
              totalHours: Number(w.totalHours) + Number(log.hoursWorked),
              daysWorked: Number(w.daysWorked) + 1,
            }
          : w
      )
    );
  };

  const punchIn = (siteId: string, photoUrl: string) => {
    const nowIso = new Date().toISOString();
    setPunchState({
      isPunchedIn: true,
      punchedInAt: nowIso,
      punchInPhoto: photoUrl,
      activeSiteId: siteId,
    });

    addNotification({
      targetRoles: ['supervisor', 'admin'],
      title: `Worker Shift Started: ${currentUser.name}`,
      message: `${currentUser.name} (${currentUser.id}) punched in at site ${siteId} with verified arrival photo.`,
      level: 'info',
      relatedSiteId: siteId,
    });
  };

  const punchOut = (
    photoUrl: string,
    taskCategory: TaskCategory,
    description: string,
    delayCategory?: DelayReason,
    siteRemarks?: string
  ) => {
    if (!punchState.punchedInAt) return;

    const punchInTime = new Date(punchState.punchedInAt).getTime();
    const punchOutTime = new Date().getTime();
    const rawHours = Number(((punchOutTime - punchInTime) / (1000 * 60 * 60)).toFixed(1));
    const elapsedHours = Math.max(0.5, rawHours);

    const targetSite = sites.find((s) => s.id === punchState.activeSiteId);
    const siteName = targetSite ? targetSite.name : 'Apex Tower Industrial Rooftop';

    const newLog: DailyLogEntry = {
      id: `LOG-${Date.now()}`,
      siteId: punchState.activeSiteId,
      siteName,
      date: new Date().toISOString().slice(0, 10),
      workerId: currentUser.id,
      workerName: currentUser.name,
      workerRole: currentUser.designationTag || 'Installer',
      taskCategory,
      description,
      startTime: new Date(punchState.punchedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hoursWorked: elapsedHours,
      delayCategory: delayCategory || 'No Delay',
      siteRemarks: siteRemarks || '',
      punchInPhoto: punchState.punchInPhoto || undefined,
      punchOutPhoto: photoUrl,
    };

    setDailyLogs((prev) => [newLog, ...prev]);

    // Update worker profile
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === currentUser.id
          ? {
              ...w,
              totalHours: Number(w.totalHours) + elapsedHours,
              daysWorked: Number(w.daysWorked) + 1,
            }
          : w
      )
    );

    // Reset punch state
    setPunchState({
      isPunchedIn: false,
      punchedInAt: null,
      punchInPhoto: null,
      activeSiteId: punchState.activeSiteId,
    });

    addNotification({
      targetRoles: ['supervisor', 'admin'],
      title: `Worker Shift Completed: ${currentUser.name}`,
      message: `${currentUser.name} punched out. Logged ${elapsedHours} hrs on ${taskCategory}. Exit photo attached.`,
      level: 'info',
      relatedSiteId: punchState.activeSiteId,
    });
  };

  const allocateBudget = (
    siteId: string,
    budget: { food: number; travel: number; lodging: number; contingency: number }
  ) => {
    const totalAllocated = budget.food + budget.travel + budget.lodging + budget.contingency;
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              budget: {
                ...s.budget,
                allocated: totalAllocated,
                food: budget.food,
                travel: budget.travel,
                lodging: budget.lodging,
                contingency: budget.contingency,
              },
            }
          : s
      )
    );
  };

  const requestContingency = (siteId: string, amount: number, justification: string) => {
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              budget: {
                ...s.budget,
                contingencyRequested: amount,
                contingencyApproved: false,
                contingencyJustification: justification,
              },
            }
          : s
      )
    );

    addNotification({
      targetRoles: ['budget', 'admin'],
      title: `Contingency Approval Requested`,
      message: `Site ${siteId} requested contingency funds of $${amount.toLocaleString()}. Reason: "${justification}".`,
      level: 'warning',
      relatedSiteId: siteId,
    });
  };

  const approveContingency = (siteId: string) => {
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId
          ? {
              ...s,
              budget: {
                ...s.budget,
                contingencyApproved: true,
                allocated: s.budget.allocated + (s.budget.contingencyRequested || 0),
                contingency: s.budget.contingency + (s.budget.contingencyRequested || 0),
              },
            }
          : s
      )
    );

    addNotification({
      targetRoles: ['supervisor', 'admin'],
      title: `Contingency Pool Approved`,
      message: `Budget Manager approved additional contingency pool for site ${siteId}.`,
      level: 'success',
      relatedSiteId: siteId,
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (n.targetRoles.includes(currentUser.role) ? { ...n, read: true } : n))
    );
  };

  const resetDataToDefault = () => {
    setSites(INITIAL_SITES);
    setDeals(INITIAL_DEALS);
    setWorkers(INITIAL_WORKERS);
    setDailyLogs(INITIAL_DAILY_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setPunchState({
      isPunchedIn: false,
      punchedInAt: null,
      punchInPhoto: null,
      activeSiteId: 'SITE-101',
    });
    localStorage.removeItem(`${STORAGE_KEY}_sites`);
    localStorage.removeItem(`${STORAGE_KEY}_deals`);
    localStorage.removeItem(`${STORAGE_KEY}_workers`);
    localStorage.removeItem(`${STORAGE_KEY}_logs`);
    localStorage.removeItem(`${STORAGE_KEY}_notifs`);
    localStorage.removeItem(`${STORAGE_KEY}_punch`);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        allUsers,
        setCurrentUser,
        switchRole,
        sites,
        activeSites,
        masterSites,
        deals,
        workers,
        dailyLogs,
        notifications,
        unreadNotificationsCount,
        punchState,
        confirmDeal,
        loseDeal,
        createDeal,
        commitProductionTimeline,
        dispatchOrder,
        sendPreDispatchReminder,
        handoverSite,
        updateSiteStatus,
        addSitePhoto,
        logDailyTask,
        punchIn,
        punchOut,
        allocateBudget,
        requestContingency,
        approveContingency,
        markNotificationRead,
        markAllNotificationsRead,
        resetDataToDefault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
