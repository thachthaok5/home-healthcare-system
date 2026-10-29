import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  medicalStaff,
  dispatchAssignments,
  unassignedRequests,
  overrideLogs,
  dssSettings,
} from './schema.ts';
import {
  MedicalStaff,
  DispatchAssignment,
  UnassignedRequest,
  OverrideLog,
  DSSWeights,
} from '../types/healthcare.ts';

// User Registration/Fetch with Upsert (per Skill instructions)
export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Database user query failed', { cause: error });
  }
}

// 1. Staff Repository Methods
export async function getAllStaffFromDb(): Promise<MedicalStaff[]> {
  try {
    const rows = await db.select().from(medicalStaff);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role as MedicalStaff['role'],
      specialty: r.specialty,
      skills: r.skills as string[],
      avatarColor: r.avatarColor,
      zone: r.zone,
      baseLocation: { lat: r.baseLat, lng: r.baseLng },
      baseAddress: r.baseAddress,
      shiftStart: r.shiftStart,
      shiftEnd: r.shiftEnd,
      maxDailyMinutes: r.maxDailyMinutes,
      workloadPct: r.workloadPct,
      assignedCount: r.assignedCount,
      totalTravelKm: r.totalTravelKm || 0,
      totalTravelMinutes: r.totalTravelMinutes || 0,
    }));
  } catch (error) {
    console.error('Error fetching staff from DB:', error);
    throw new Error('Failed to fetch staff from database', { cause: error });
  }
}

export async function saveStaffListToDb(staffList: MedicalStaff[]): Promise<void> {
  try {
    for (const s of staffList) {
      await db
        .insert(medicalStaff)
        .values({
          id: s.id,
          name: s.name,
          role: s.role,
          specialty: s.specialty,
          skills: s.skills,
          avatarColor: s.avatarColor,
          zone: s.zone,
          baseLat: s.baseLocation.lat,
          baseLng: s.baseLocation.lng,
          baseAddress: s.baseAddress,
          shiftStart: s.shiftStart,
          shiftEnd: s.shiftEnd,
          maxDailyMinutes: s.maxDailyMinutes,
          workloadPct: s.workloadPct,
          assignedCount: s.assignedCount,
          totalTravelKm: s.totalTravelKm || 0,
          totalTravelMinutes: s.totalTravelMinutes || 0,
        })
        .onConflictDoUpdate({
          target: medicalStaff.id,
          set: {
            name: s.name,
            role: s.role,
            specialty: s.specialty,
            skills: s.skills,
            avatarColor: s.avatarColor,
            zone: s.zone,
            baseLat: s.baseLocation.lat,
            baseLng: s.baseLocation.lng,
            baseAddress: s.baseAddress,
            shiftStart: s.shiftStart,
            shiftEnd: s.shiftEnd,
            maxDailyMinutes: s.maxDailyMinutes,
            workloadPct: s.workloadPct,
            assignedCount: s.assignedCount,
            totalTravelKm: s.totalTravelKm || 0,
            totalTravelMinutes: s.totalTravelMinutes || 0,
          },
        });
    }
  } catch (error) {
    console.error('Error saving staff list to DB:', error);
    throw new Error('Failed to save staff list to database', { cause: error });
  }
}

// 2. Dispatch Assignments Repository Methods
export async function getAllAssignmentsFromDb(): Promise<DispatchAssignment[]> {
  try {
    const rows = await db.select().from(dispatchAssignments);
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      patientAge: r.patientAge,
      patientPhone: r.patientPhone,
      district: r.district,
      address: r.address,
      location: { lat: r.lat, lng: r.lng },
      serviceName: r.serviceName,
      serviceCategory: r.serviceCategory,
      staffId: r.staffId,
      staffName: r.staffName,
      startTime: r.startTime,
      endTime: r.endTime,
      predictedDurationMin: r.predictedDurationMin,
      standardDurationMin: r.standardDurationMin,
      travelMinutes: r.travelMinutes,
      distanceKm: r.distanceKm,
      status: r.status as DispatchAssignment['status'],
      priority: r.priority as DispatchAssignment['priority'],
      aiConfidencePct: r.aiConfidencePct,
      notes: r.notes || undefined,
      isConflict: r.isConflict || false,
      conflictDetail: (r.conflictDetail as DispatchAssignment['conflictDetail']) || undefined,
    }));
  } catch (error) {
    console.error('Error fetching assignments from DB:', error);
    throw new Error('Failed to fetch assignments from database', { cause: error });
  }
}

export async function saveAssignmentToDb(asg: DispatchAssignment): Promise<void> {
  try {
    await db
      .insert(dispatchAssignments)
      .values({
        id: asg.id,
        patientId: asg.patientId,
        patientName: asg.patientName,
        patientAge: asg.patientAge,
        patientPhone: asg.patientPhone,
        district: asg.district,
        address: asg.address,
        lat: asg.location.lat,
        lng: asg.location.lng,
        serviceName: asg.serviceName,
        serviceCategory: asg.serviceCategory,
        staffId: asg.staffId,
        staffName: asg.staffName,
        startTime: asg.startTime,
        endTime: asg.endTime,
        predictedDurationMin: asg.predictedDurationMin,
        standardDurationMin: asg.standardDurationMin,
        travelMinutes: asg.travelMinutes,
        distanceKm: asg.distanceKm,
        status: asg.status,
        priority: asg.priority,
        aiConfidencePct: asg.aiConfidencePct || 90,
        notes: asg.notes || null,
        isConflict: asg.isConflict || false,
        conflictDetail: asg.conflictDetail || null,
      })
      .onConflictDoUpdate({
        target: dispatchAssignments.id,
        set: {
          district: asg.district,
          address: asg.address,
          lat: asg.location.lat,
          lng: asg.location.lng,
          staffId: asg.staffId,
          staffName: asg.staffName,
          startTime: asg.startTime,
          endTime: asg.endTime,
          predictedDurationMin: asg.predictedDurationMin,
          standardDurationMin: asg.standardDurationMin,
          travelMinutes: asg.travelMinutes,
          distanceKm: asg.distanceKm,
          status: asg.status,
          priority: asg.priority,
          aiConfidencePct: asg.aiConfidencePct || 90,
          notes: asg.notes || null,
          isConflict: asg.isConflict || false,
          conflictDetail: asg.conflictDetail || null,
        },
      });
  } catch (error) {
    console.error('Error saving assignment to DB:', error);
    throw new Error('Failed to save assignment to database', { cause: error });
  }
}

export async function deleteAssignmentFromDb(id: string): Promise<void> {
  try {
    await db.delete(dispatchAssignments).where(eq(dispatchAssignments.id, id));
  } catch (error) {
    console.error('Error deleting assignment from DB:', error);
    throw new Error('Failed to delete assignment from database', { cause: error });
  }
}

// 3. Unassigned Requests Repository Methods
export async function getAllUnassignedRequestsFromDb(): Promise<Omit<UnassignedRequest, 'aiCandidates'>[]> {
  try {
    const rows = await db.select().from(unassignedRequests);
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      patientAge: r.patientAge,
      patientPhone: r.patientPhone,
      district: r.district,
      address: r.address,
      location: { lat: r.lat, lng: r.lng },
      serviceName: r.serviceName,
      serviceCategory: r.serviceCategory,
      requestedWindow: r.requestedWindow,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
      preferredStart: r.suggestedStartTime || r.windowStart,
      suggestedStartTime: r.suggestedStartTime,
      standardDurationMin: r.standardDurationMin,
      predictedDurationMin: r.predictedDurationMin,
      predictionConfidencePct: r.predictionConfidencePct,
      predictionFactors: r.predictionFactors as string[],
      durationBreakdown: r.durationBreakdown as UnassignedRequest['durationBreakdown'],
      priority: r.priority as UnassignedRequest['priority'],
      clinicalSeverity:
        r.priority === 'Khẩn cấp'
          ? 'Nặng (Độ III - Nguy cơ nhiễm khuẩn huyết)'
          : r.priority === 'Cao'
          ? 'Trung bình - Nặng (Cần theo dõi sát)'
          : 'Ổn định (Chăm sóc theo phác đồ)',
      specializedEquipment:
        r.serviceCategory.includes('Vết thương')
          ? ['Máy hút áp lực âm VAC', 'Bộ cắt lọc vô khuẩn', 'Máy đo SpO2 & Đường huyết']
          : r.serviceCategory.includes('Vật lý')
          ? ['Máy điện xung đa tần', 'Thiết bị vỗ rung hô hấp', 'Đai tập đứng PHCN']
          : r.serviceCategory.includes('Truyền dịch')
          ? ['Bơm tiêm điện tự động', 'Kim luồn tĩnh mạch ngoại vi', 'Hộp chống sốc phản vệ']
          : ['Máy siêu âm cầm tay POCUS', 'Máy đo điện tim ECG 12 chuyển đạo', 'Ống nghe tim phổi'],
      requiredSkills: r.requiredSkills as string[],
      clinicalNotes: r.clinicalNotes || '',
      preferredStaffId: r.preferredStaffId || undefined,
      historicalVisits: (r.historicalVisits as Record<string, number>) || {},
      status: r.status as UnassignedRequest['status'],
    }));
  } catch (error) {
    console.error('Error fetching unassigned requests from DB:', error);
    throw new Error('Failed to fetch unassigned requests from database', { cause: error });
  }
}

export async function saveUnassignedRequestToDb(req: Omit<UnassignedRequest, 'aiCandidates'>): Promise<void> {
  try {
    await db
      .insert(unassignedRequests)
      .values({
        id: req.id,
        patientId: req.patientId,
        patientName: req.patientName,
        patientAge: req.patientAge,
        patientPhone: req.patientPhone,
        district: req.district,
        address: req.address,
        lat: req.location.lat,
        lng: req.location.lng,
        serviceName: req.serviceName,
        serviceCategory: req.serviceCategory,
        requestedWindow: req.requestedWindow,
        windowStart: req.windowStart,
        windowEnd: req.windowEnd,
        suggestedStartTime: req.suggestedStartTime,
        standardDurationMin: req.standardDurationMin,
        predictedDurationMin: req.predictedDurationMin,
        predictionConfidencePct: req.predictionConfidencePct,
        predictionFactors: req.predictionFactors,
        durationBreakdown: req.durationBreakdown,
        priority: req.priority,
        requiredSkills: req.requiredSkills,
        clinicalNotes: req.clinicalNotes || null,
        preferredStaffId: req.preferredStaffId || null,
        historicalVisits: req.historicalVisits,
        status: req.status,
      })
      .onConflictDoUpdate({
        target: unassignedRequests.id,
        set: {
          district: req.district,
          address: req.address,
          lat: req.location.lat,
          lng: req.location.lng,
          status: req.status,
          suggestedStartTime: req.suggestedStartTime,
          predictedDurationMin: req.predictedDurationMin,
          historicalVisits: req.historicalVisits,
        },
      });
  } catch (error) {
    console.error('Error saving unassigned request to DB:', error);
    throw new Error('Failed to save unassigned request to database', { cause: error });
  }
}

export async function deleteUnassignedRequestFromDb(id: string): Promise<void> {
  try {
    await db.delete(unassignedRequests).where(eq(unassignedRequests.id, id));
  } catch (error) {
    console.error('Error deleting unassigned request from DB:', error);
    throw new Error('Failed to delete unassigned request from database', { cause: error });
  }
}

// 4. Override Logs Repository Methods
export async function getAllOverrideLogsFromDb(): Promise<OverrideLog[]> {
  try {
    const rows = await db.select().from(overrideLogs);
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      requestId: r.requestId,
      patientName: r.patientName,
      serviceName: r.serviceName,
      aiTopStaff: r.aiTopStaff,
      aiTopScore: r.aiTopScore,
      chosenStaff: r.chosenStaff,
      chosenScore: r.chosenScore,
      overrideCategory: r.overrideCategory,
      overrideReason: r.overrideReason,
      dispatcherName: r.dispatcherName,
    }));
  } catch (error) {
    console.error('Error fetching override logs from DB:', error);
    throw new Error('Failed to fetch override logs from database', { cause: error });
  }
}

export async function saveOverrideLogToDb(log: OverrideLog): Promise<void> {
  try {
    await db
      .insert(overrideLogs)
      .values({
        id: log.id,
        timestamp: log.timestamp,
        requestId: log.requestId,
        patientName: log.patientName,
        serviceName: log.serviceName || 'Dịch vụ y tế tại nhà',
        aiTopStaff: log.aiTopStaff,
        aiTopScore: Number(log.aiTopScore ?? 0),
        chosenStaff: log.chosenStaff,
        chosenScore: Number(log.chosenScore ?? 0),
        overrideCategory: log.overrideCategory,
        overrideReason: log.overrideReason,
        dispatcherName: log.dispatcherName,
      })
      .onConflictDoUpdate({
        target: overrideLogs.id,
        set: {
          timestamp: log.timestamp,
          requestId: log.requestId,
          patientName: log.patientName,
          serviceName: log.serviceName || 'Dịch vụ y tế tại nhà',
          aiTopStaff: log.aiTopStaff,
          aiTopScore: Number(log.aiTopScore ?? 0),
          chosenStaff: log.chosenStaff,
          chosenScore: Number(log.chosenScore ?? 0),
          overrideCategory: log.overrideCategory,
          overrideReason: log.overrideReason,
          dispatcherName: log.dispatcherName,
        },
      });
  } catch (error) {
    console.error('Error saving override log to DB:', error);
    throw new Error('Failed to save override log to database', { cause: error });
  }
}

// 5. DSS Settings Repository Methods
export async function getDSSSettingsFromDb(): Promise<DSSWeights | null> {
  try {
    const rows = await db.select().from(dssSettings).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      skillFit: r.skillFit,
      timeFit: r.timeFit,
      distance: r.distance,
      workload: r.workload,
      continuity: r.continuity,
    };
  } catch (error) {
    console.error('Error fetching DSS settings from DB:', error);
    return null;
  }
}

export async function saveDSSSettingsToDb(weights: DSSWeights): Promise<void> {
  try {
    const existing = await db.select().from(dssSettings).limit(1);
    if (existing.length === 0) {
      await db.insert(dssSettings).values({
        skillFit: weights.skillFit,
        timeFit: weights.timeFit,
        distance: weights.distance,
        workload: weights.workload,
        continuity: weights.continuity,
      });
    } else {
      await db
        .update(dssSettings)
        .set({
          skillFit: weights.skillFit,
          timeFit: weights.timeFit,
          distance: weights.distance,
          workload: weights.workload,
          continuity: weights.continuity,
          updatedAt: new Date(),
        })
        .where(eq(dssSettings.id, existing[0].id));
    }
  } catch (error) {
    console.error('Error saving DSS settings to DB:', error);
    throw new Error('Failed to save DSS settings to database', { cause: error });
  }
}

export async function clearAllOperationalTables(): Promise<void> {
  try {
    // Use atomic TRUNCATE ... CASCADE to avoid any FK ordering or concurrent child-row issues
    await db.execute(
      sql`TRUNCATE TABLE override_logs, unassigned_requests, dispatch_assignments, medical_staff RESTART IDENTITY CASCADE`
    );
  } catch (truncateErr) {
    try {
      await db.delete(dispatchAssignments);
      await db.delete(overrideLogs);
      await db.delete(unassignedRequests);
      await db.delete(medicalStaff);
    } catch (error) {
      console.error('Error clearing operational tables in DB:', error);
      throw new Error('Failed to clear operational tables in database', { cause: error });
    }
  }
}

