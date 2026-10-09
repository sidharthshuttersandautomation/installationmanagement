export type UserRole =
  | 'admin'
  | 'salesperson'
  | 'supervisor'
  | 'logistics'
  | 'production'
  | 'budget'
  | 'worker';

export interface UserProfile {
  id: string; // e.g. ADM001, SP001, SV001, LGP001, PRM001, BM001, WRK001
  name: string;
  role: UserRole;
  designationTag?: string; // For workers: Installer, Helper, Team Lead, Painter, Electrician
  email: string;
  avatar?: string;
  phone?: string;
}

export type SiteStatus = 'upcoming' | 'in_progress' | 'on_hold' | 'completed' | 'handed_over';

export interface SitePhoto {
  id: string;
  url: string;
  caption: string;
  timestamp: string;
  tag: 'site' | 'issue' | 'progress' | 'completion' | 'dispatch' | 'pre_dispatch';
}

export interface SiteBudget {
  allocated: number;
  food: number;
  travel: number;
  lodging: number;
  contingency: number;
  spentFood: number;
  spentTravel: number;
  spentLodging: number;
  spentOther: number;
  contingencyRequested?: number;
  contingencyApproved?: boolean;
  contingencyJustification?: string;
}

export interface ProductionOrder {
  orderId: string;
  itemSpecs: string;
  productCategory: string;
  manufacturingDays: number;
  completionPct: number;
  committedDate: string;
  targetDispatchDate: string;
  isDispatched: boolean;
  dispatchDate?: string;
  vehicleRegNumber?: string;
  vehiclePhoto?: string;
  trackingUrl?: string;
  trackingId?: string;
  completedProductPhoto?: string;
  preDispatchPhoto?: string;
}

export interface SiteWorkerAssignment {
  workerId: string;
  name: string;
  role: string;
  deployedSince: string;
}

export interface SiteItem {
  id: string; // e.g. SITE-101
  name: string;
  clientName: string;
  deliveryAddress: string;
  location: string;
  region: 'North' | 'South' | 'West' | 'East' | 'Central' | 'Metro';
  status: SiteStatus;
  progress: number; // 0 - 100
  salespersonId: string;
  salespersonName: string;
  dealValue: number; // Hidden from logistics & salesperson tracking view
  targetHandoverDate: string;
  actualHandoverDate?: string;
  delayDays?: number;
  delayJustification?: string;
  holdReason?: string;
  lastVisitorInfo?: string;
  assignedSupervisorId: string;
  assignedSupervisorName: string;
  assignedWorkers: SiteWorkerAssignment[];
  photos: SitePhoto[];
  budget: SiteBudget;
  production: ProductionOrder;
  handoverNotes?: string;
  handoverRatingAvg?: number;
  createdAt: string;
}

export type DealStatus = 'Draft' | 'Negotiation' | 'Confirmed' | 'Lost';

export interface DealItem {
  id: string;
  client: string;
  siteName: string;
  location: string;
  region: 'North' | 'South' | 'West' | 'East' | 'Central' | 'Metro';
  productCategory: string;
  productSpecs: string;
  value: number;
  status: DealStatus;
  lostReason?: string;
  salespersonId: string;
  salespersonName: string;
  createdAt: string;
  targetCloseDate: string;
  notes: string;
}

export const DELAY_REASONS = [
  'No Delay',
  'Client Site Unavailability',
  'Material Shortage',
  'Power Failure',
  'Weather Delay',
  'Technical Complexity',
  'Client Payment Pending',
  'Site Not Ready / Civil Work Pending',
  'Material Delivery Delayed',
  'Power Supply Issue at Site',
  'Client Requested Delay',
  'Other',
] as const;

export type DelayReason = (typeof DELAY_REASONS)[number];

export type TaskCategory =
  | 'Civil Mounting'
  | 'Site Survey'
  | 'Wiring & Electrical'
  | 'Testing'
  | 'Finishing & Painting'
  | 'Shutter Installation'
  | 'Automation & Motor Fixing'
  | 'Track Leveling & Alignment';

export interface DailyLogEntry {
  id: string;
  siteId: string;
  siteName: string;
  date: string;
  workerId: string;
  workerName: string;
  workerRole: string;
  taskCategory: TaskCategory;
  description: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  delayCategory?: DelayReason;
  siteRemarks?: string;
  punchInPhoto?: string;
  punchOutPhoto?: string;
  supervisorNotes?: string;
}

export interface WorkerRating {
  siteId: string;
  siteName: string;
  supervisorId: string;
  supervisorName: string;
  score: number; // 1-10
  metrics: {
    punctuality: number;
    workmanship: number;
    safety: number;
    speed: number;
  };
  notes: string;
  date: string;
}

export interface WorkerTravelRecord {
  id: string;
  date: string;
  from: string;
  to: string;
  distanceKm: number;
  mode: string;
}

export interface WorkerProfile {
  id: string; // WRK001...
  name: string;
  designation: 'Installer' | 'Helper' | 'Team Lead' | 'Painter' | 'Electrician';
  status: 'Available' | 'Deployed' | 'On Leave';
  currentSiteId?: string;
  currentSiteName?: string;
  totalHours: number;
  daysTravelled: number;
  daysWorked: number;
  sitesVisitedCount: number;
  onHoldSitesCount: number;
  ratings: WorkerRating[];
  travelHistory: WorkerTravelRecord[];
  taskEfficiency: {
    task: TaskCategory;
    completedUnits: number;
    avgSpeedScore: number; // 1-10
  }[];
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  targetRoles: UserRole[];
  title: string;
  message: string;
  level: 'info' | 'urgent' | 'warning' | 'success';
  read: boolean;
  relatedSiteId?: string;
  actionUrl?: string;
}
