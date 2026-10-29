import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users table (Firebase Auth linkage)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('dispatcher'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Medical Staff table
export const medicalStaff = pgTable('medical_staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  specialty: text('specialty').notNull(),
  skills: json('skills').$type<string[]>().notNull(),
  avatarColor: text('avatar_color').notNull(),
  zone: text('zone').notNull(),
  baseLat: doublePrecision('base_lat').notNull(),
  baseLng: doublePrecision('base_lng').notNull(),
  baseAddress: text('base_address').notNull(),
  shiftStart: text('shift_start').notNull(),
  shiftEnd: text('shift_end').notNull(),
  maxDailyMinutes: integer('max_daily_minutes').notNull().default(450),
  workloadPct: integer('workload_pct').notNull().default(0),
  assignedCount: integer('assigned_count').notNull().default(0),
  totalTravelKm: doublePrecision('total_travel_km').default(0),
  totalTravelMinutes: integer('total_travel_minutes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Dispatch Assignments table
export const dispatchAssignments = pgTable('dispatch_assignments', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  patientAge: integer('patient_age').notNull(),
  patientPhone: text('patient_phone').notNull(),
  district: text('district').notNull(),
  address: text('address').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  serviceName: text('service_name').notNull(),
  serviceCategory: text('service_category').notNull(),
  staffId: text('staff_id')
    .references(() => medicalStaff.id, { onDelete: 'cascade' })
    .notNull(),
  staffName: text('staff_name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  predictedDurationMin: integer('predicted_duration_min').notNull(),
  standardDurationMin: integer('standard_duration_min').notNull(),
  travelMinutes: integer('travel_minutes').notNull().default(0),
  distanceKm: doublePrecision('distance_km').notNull().default(0),
  status: text('status').notNull().default('Confirmed'),
  priority: text('priority').notNull().default('Tiêu chuẩn'),
  aiConfidencePct: integer('ai_confidence_pct').notNull().default(90),
  notes: text('notes'),
  isConflict: boolean('is_conflict').default(false),
  conflictDetail: json('conflict_detail'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Unassigned Requests table
export const unassignedRequests = pgTable('unassigned_requests', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  patientAge: integer('patient_age').notNull(),
  patientPhone: text('patient_phone').notNull(),
  district: text('district').notNull(),
  address: text('address').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  serviceName: text('service_name').notNull(),
  serviceCategory: text('service_category').notNull(),
  requestedWindow: text('requested_window').notNull(),
  windowStart: text('window_start').notNull(),
  windowEnd: text('window_end').notNull(),
  suggestedStartTime: text('suggested_start_time').notNull(),
  standardDurationMin: integer('standard_duration_min').notNull(),
  predictedDurationMin: integer('predicted_duration_min').notNull(),
  predictionConfidencePct: integer('prediction_confidence_pct').notNull().default(90),
  predictionFactors: json('prediction_factors').$type<string[]>().notNull(),
  durationBreakdown: json('duration_breakdown').notNull(),
  priority: text('priority').notNull(),
  requiredSkills: json('required_skills').$type<string[]>().notNull(),
  clinicalNotes: text('clinical_notes'),
  preferredStaffId: text('preferred_staff_id'),
  historicalVisits: json('historical_visits').$type<Record<string, number>>().notNull(),
  status: text('status').notNull().default('Unassigned'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Override Logs table
export const overrideLogs = pgTable('override_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  requestId: text('request_id').notNull(),
  patientName: text('patient_name').notNull(),
  serviceName: text('service_name').notNull(),
  aiTopStaff: text('ai_top_staff').notNull(),
  aiTopScore: doublePrecision('ai_top_score').notNull(),
  chosenStaff: text('chosen_staff').notNull(),
  chosenScore: doublePrecision('chosen_score').notNull(),
  overrideCategory: text('override_category').notNull(),
  overrideReason: text('override_reason').notNull(),
  dispatcherName: text('dispatcher_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. DSS Weights Settings table
export const dssSettings = pgTable('dss_settings', {
  id: serial('id').primaryKey(),
  skillFit: doublePrecision('skill_fit').notNull().default(0.30),
  timeFit: doublePrecision('time_fit').notNull().default(0.25),
  distance: doublePrecision('distance').notNull().default(0.20),
  workload: doublePrecision('workload').notNull().default(0.15),
  continuity: doublePrecision('continuity').notNull().default(0.10),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relationships
export const medicalStaffRelations = relations(medicalStaff, ({ many }) => ({
  assignments: many(dispatchAssignments),
}));

export const dispatchAssignmentsRelations = relations(dispatchAssignments, ({ one }) => ({
  staff: one(medicalStaff, {
    fields: [dispatchAssignments.staffId],
    references: [medicalStaff.id],
  }),
}));
