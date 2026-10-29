export type SidebarNavKey =
  | 'ai-recommendation'
  | 'dispatch-board'
  | 'or-tools-optimization'
  | 'route-map'
  | 'dashboard-kpi';

export type AssignmentStatus =
  | 'Unassigned'
  | 'Proposed'
  | 'Confirmed'
  | 'In-Progress'
  | 'Completed';

export interface GeoCoord {
  lat: number;
  lng: number;
}

export type HardConstraintCode =
  | 'SKILL_MISMATCH'
  | 'OUTSIDE_SHIFT_HOURS'
  | 'LEAVE_CONFLICT'
  | 'DIRECT_OVERLAP'
  | 'TRAVEL_INFEASIBLE'
  | 'EXCEEDS_DAILY_WORKLOAD';

export interface HardConstraintViolation {
  code: HardConstraintCode;
  labelVi: string;
  labelEn: string;
  detail: string;
}

export type OverrideReasonCode =
  | 'distance'
  | 'skill'
  | 'customer_request'
  | 'time_constraint'
  | 'workload_balance'
  | 'other';

export interface OverrideReasonItem {
  code: OverrideReasonCode;
  label: string;
  description?: string;
}

export interface MedicalStaff {
  id: string;
  name: string;
  role: 'Bác sĩ Gia đình' | 'Điều dưỡng Chuyên khoa' | 'Chuyên viên Vật lý trị liệu' | 'Điều dưỡng Chăm sóc';
  specialty: string;
  skills: string[];
  avatarColor: string;
  zone: string;
  baseLocation: GeoCoord;
  baseAddress: string;
  shiftStart: string; // e.g. '07:30'
  shiftEnd: string;   // e.g. '17:30'
  maxDailyMinutes: number; // 480 minutes cap
  assignedMinutes?: number; // Current assigned minutes today (care + travel)
  workloadPct: number; // Computed dynamically by backend (0-100%)
  assignedCount: number; // Computed dynamically by backend
  totalTravelKm?: number;
  totalTravelMinutes?: number;
  isOnApprovedLeave?: boolean;
  leaveWindowText?: string;
}

export interface ConflictDetail {
  conflictingAssignmentId: string;
  conflictingServiceName: string;
  conflictingPatientName: string;
  conflictingTimeRange: string;
  overlapMinutes: number;
  reason: string;
  suggestedNewStart: string;
  suggestedNewEnd: string;
}

export interface DispatchAssignment {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  district: string;
  address: string;
  location: GeoCoord;
  serviceName: string;
  serviceCategory: string;
  staffId: string;
  staffName: string;
  startTime: string; // format 'HH:mm'
  endTime: string;   // format 'HH:mm'
  predictedDurationMin: number;
  standardDurationMin: number;
  travelMinutes: number;
  distanceKm: number;
  status: AssignmentStatus;
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  aiConfidencePct?: number;
  notes?: string;
  isConflict?: boolean;
  conflictDetail?: ConflictDetail;
}

export interface AICandidateCriteria {
  skillFitScore: number;     // 0 - 100
  matchedSkills: string[];
  missingSkills: string[];
  skillFitNote: string;
  timeFitScore: number;      // 0 - 100
  availableGapText: string;
  timeFitNote: string;
  distanceKm: number;
  travelMinutes: number;
  distanceScore: number;     // 0 - 100
  assignedMinutes: number;   // Current minutes assigned today (out of 480)
  projectedAssignedMinutes: number; // Minutes after assigning this visit (out of 480)
  maxDailyMinutes: number;   // 480
  workloadPct: number;       // current % before assignment
  projectedWorkloadPct: number; // % after assignment
  workloadScore: number;     // 0 - 100
  continuityScore: number;   // 0 - 100
  previousVisitsCount: number;
  continuityNote: string;
  predictedDurationMin: number;
  predictionConfidencePct: number;
}

export interface AICandidate {
  staffId: string;
  staffName: string;
  staffRole: string;
  specialty: string;
  zone: string;
  avatarColor: string;
  totalScore: number; // 0 - 100 weighted sum
  dssScoreNormalized: number; // 0.0 - 1.0 normalized score
  isEligible: boolean; // Passes all hard constraints
  rank: number;
  rankLabel: string; // 'Top 1 Khuyến nghị' | 'Top 2' | 'Top 3' | 'Không khả thi'
  criteria: AICandidateCriteria;
  statusBadge: string;
  qualificationReason: string;
  constraintViolations: string[]; // Hard constraint rejection reasons
  hardConstraintDetails?: HardConstraintViolation[];
}

export interface DurationPredictionFactor {
  factorName: string;
  impactMinutes: number; // e.g. +12, +8, -5
  description: string;
}

export interface UnassignedRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  district: string; // Phường tại Nha Trang
  address: string;
  location: GeoCoord;
  serviceName: string;
  serviceCategory: string;
  requestedWindow: string; // e.g. '09:15 - 11:00'
  windowStart: string;     // '09:15'
  windowEnd: string;       // '11:00'
  preferredStart: string;  // preferred_start e.g. '09:15'
  suggestedStartTime: string;
  standardDurationMin: number; // Default Duration
  predictedDurationMin: number; // AI predicted_duration
  predictionConfidencePct: number;
  predictionFactors: string[];
  durationBreakdown: DurationPredictionFactor[];
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  clinicalSeverity: string; // Mức độ bệnh lý
  specializedEquipment: string[]; // Thiết bị chuyên dụng
  requiredSkills: string[];
  clinicalNotes: string;
  preferredStaffId?: string;
  historicalVisits: Record<string, number>; // staffId -> visit count
  status: AssignmentStatus;
  aiCandidates: AICandidate[]; // Dynamically computed by backend DSS engine
}

export interface DSSWeights {
  skillFit: number;    // default 0.30
  timeFit: number;     // default 0.25
  distance: number;    // default 0.20
  workload: number;    // default 0.15
  continuity: number;  // default 0.10
}

export interface OverrideLog {
  id: string;
  timestamp: string;
  requestId: string;
  patientName: string;
  serviceName?: string;
  aiTopStaff: string;
  aiTopScore?: number;
  chosenStaff: string;
  chosenScore?: number;
  overrideCategory: string;
  overrideReasonCode?: OverrideReasonCode;
  overrideReason: string;
  dispatcherName: string;
}

// Screen 3: OR-Tools Daily Optimization Types
export interface OptimizationWeights {
  travelWeight: number;      // e.g. 40
  workloadBalanceWeight: number; // e.g. 30
  continuityWeight: number;  // e.g. 20
  slaPenaltyWeight: number;  // e.g. 10
}

export interface OptimizationScheduleDiffItem {
  assignmentId: string;
  patientName: string;
  serviceName: string;
  district: string;
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  baselineStaffName: string;
  baselineTime: string;
  baselineTravelMin: number;
  baselineHasConflict: boolean;
  optimizedStaffId: string;
  optimizedStaffName: string;
  optimizedStartTime: string;
  optimizedEndTime: string;
  optimizedTravelMin: number;
  optimizedDistanceKm: number;
  improvementNote: string;
  isNewlyAssignedFromQueue?: boolean;
}

export interface UnschedulableRequestItem {
  requestId: string;
  patientName: string;
  serviceName: string;
  district: string;
  requestedWindow: string;
  requiredSkills: string[];
  infeasibleReason: string;
  suggestedResolution: string;
}

export interface OptimizationResult {
  solverStatus: 'OPTIMAL' | 'FEASIBLE';
  solveTimeMs: number;
  objectiveValue: number;
  weightsUsed: OptimizationWeights;
  baselineMetrics: {
    totalAssigned: number;
    unassignedCount: number;
    totalTravelMinutes: number;
    totalDistanceKm: number;
    workloadStdDevPct: number;
    continuityMatchRatePct: number;
    conflictCount: number;
    slaCompliancePct: number;
  };
  optimizedMetrics: {
    totalAssigned: number;
    unassignedCount: number;
    totalTravelMinutes: number;
    totalDistanceKm: number;
    workloadStdDevPct: number;
    continuityMatchRatePct: number;
    conflictCount: number;
    slaCompliancePct: number;
  };
  scheduleComparison: OptimizationScheduleDiffItem[];
  unschedulableRequests: UnschedulableRequestItem[];
  isApplied: boolean;
}

// Screen 4: Leaflet Route Map Types
export interface RouteStop {
  stopOrder: number;
  assignmentId: string;
  patientName: string;
  patientAge: number;
  serviceName: string;
  address: string;
  district: string;
  location: GeoCoord;
  startTime: string;
  endTime: string;
  predictedDurationMin: number;
  status: AssignmentStatus;
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  legDistanceKm: number;
  legTravelMinutes: number;
  isConflict?: boolean;
}

export interface StaffRouteItinerary {
  staffId: string;
  staffName: string;
  staffRole: string;
  avatarColor: string;
  zone: string;
  baseLocation: GeoCoord;
  baseAddress: string;
  shiftStart: string;
  shiftEnd: string;
  totalStops: number;
  totalDistanceKm: number;
  totalTravelMinutes: number;
  totalCareMinutes: number;
  workloadPct: number;
  stops: RouteStop[];
}

// Screen 5: Dashboard KPI Types
export interface HourlyDensityItem {
  hourLabel: string;
  completed: number;
  inProgress: number;
  confirmed: number;
  proposed: number;
  conflict: number;
}

export interface ServiceCategoryKPI {
  category: string;
  visitCount: number;
  percentage: number;
  avgStandardMin: number;
  avgPredictedMin: number;
  avgTravelMin: number;
}

export interface DashboardKPIData {
  summary: {
    totalVisitsToday: number;
    completedVisits: number;
    inProgressVisits: number;
    confirmedVisits: number;
    proposedVisits: number;
    unassignedCount: number;
    conflictCount: number;
    slaOnTimePct: number;
    avgWorkloadPct: number;
    totalTravelKm: number;
    totalTravelMinutes: number;
    aiTop1AcceptancePct: number;
    overrideCount: number;
    durationPredictionAccuracyPct: number;
    durationModelVersion: string;
  };
  hourlyDensity: HourlyDensityItem[];
  serviceBreakdown: ServiceCategoryKPI[];
  staffUtilization: {
    staffId: string;
    staffName: string;
    role: string;
    zone: string;
    assignedCount: number;
    careMinutes: number;
    travelMinutes: number;
    workloadPct: number;
    avatarColor: string;
  }[];
  overrideLogs: OverrideLog[];
}
