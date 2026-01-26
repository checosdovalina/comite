import {
  committees,
  committeeMembers,
  attendanceSlots,
  attendances,
  memberActivities,
  notificationPreferences,
  roles,
  activityAttendances,
  activityAssignments,
  counselorTeams,
  counselorTeamMembers,
  teamInvites,
  pushSubscriptions,
  scheduledNotifications,
  type Committee,
  type InsertCommittee,
  type CommitteeMember,
  type InsertCommitteeMember,
  type AttendanceSlot,
  type InsertAttendanceSlot,
  type Attendance,
  type InsertAttendance,
  type MemberActivity,
  type InsertMemberActivity,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type Role,
  type InsertRole,
  type ActivityAttendance,
  type InsertActivityAttendance,
  type ActivityAssignment,
  type InsertActivityAssignment,
  type CounselorTeam,
  type InsertCounselorTeam,
  type CounselorTeamMember,
  type InsertCounselorTeamMember,
  type TeamInvite,
  type InsertTeamInvite,
  type PushSubscription,
  type InsertPushSubscription,
  type ScheduledNotification,
  type InsertScheduledNotification,
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  getCommittees(): Promise<Committee[]>;
  getAllCommittees(): Promise<Committee[]>;
  getCommittee(id: string): Promise<Committee | undefined>;
  createCommittee(data: InsertCommittee): Promise<Committee>;
  updateCommittee(id: string, data: Partial<InsertCommittee>): Promise<Committee | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  getCommitteeMembers(committeeId: string): Promise<(CommitteeMember & { user?: User })[]>;
  getCommitteeMember(id: string): Promise<CommitteeMember | undefined>;
  getUserMemberships(userId: string): Promise<(CommitteeMember & { committee?: Committee })[]>;
  getUserCommittees(userId: string): Promise<Committee[]>;
  createCommitteeMember(data: InsertCommitteeMember): Promise<CommitteeMember>;
  updateCommitteeMember(id: string, data: Partial<InsertCommitteeMember>): Promise<CommitteeMember | undefined>;
  getAllMembers(): Promise<(CommitteeMember & { user?: User; committee?: Committee; role?: Role })[]>;
  
  getAttendanceSlots(committeeId: string, startDate: string, endDate: string): Promise<(AttendanceSlot & { attendances?: (Attendance & { user?: User })[] })[]>;
  getAttendanceSlot(id: string): Promise<AttendanceSlot | undefined>;
  getSlotByDateAndShift(committeeId: string, date: string, shift: string): Promise<AttendanceSlot | undefined>;
  createAttendanceSlot(data: InsertAttendanceSlot): Promise<AttendanceSlot>;
  updateAttendanceSlot(id: string, data: Partial<InsertAttendanceSlot>): Promise<AttendanceSlot | undefined>;
  getUpcomingSlots(userId: string): Promise<(AttendanceSlot & { committeeName: string })[]>;
  
  getAttendances(slotId: string): Promise<(Attendance & { user?: User })[]>;
  getUserAttendances(userId: string): Promise<(Attendance & { slot?: AttendanceSlot & { committee?: Committee } })[]>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  createAttendance(data: InsertAttendance): Promise<Attendance>;
  deleteAttendance(id: string): Promise<boolean>;
  updateAttendanceStatus(id: string, status: string): Promise<Attendance | undefined>;
  
  getMemberActivities(committeeId: string, userId?: string, startDate?: string, endDate?: string): Promise<MemberActivity[]>;
  getMemberActivity(id: string): Promise<MemberActivity | undefined>;
  getUserActivities(userId: string, startDate?: string, endDate?: string): Promise<(MemberActivity & { committee?: Committee })[]>;
  getCalendarActivities(committeeId: string, startDate?: string, endDate?: string): Promise<(MemberActivity & { userName?: string })[]>;
  createMemberActivity(data: InsertMemberActivity): Promise<MemberActivity>;
  updateMemberActivity(id: string, data: Partial<InsertMemberActivity>): Promise<MemberActivity | undefined>;
  deleteMemberActivity(id: string): Promise<boolean>;
  
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(data: InsertNotificationPreferences): Promise<NotificationPreferences>;
  
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(data: InsertRole): Promise<Role>;
  updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  getGeneralCommittees(): Promise<Committee[]>;
  
  getAllUsersWithPushEnabled(): Promise<NotificationPreferences[]>;
  getUserAttendancesForNotification(userId: string, minutesBefore: number): Promise<Attendance[]>;
  getUserActivitiesForNotification(userId: string, minutesBefore: number): Promise<MemberActivity[]>;
  
  getActivityAttendances(activityId: string): Promise<(ActivityAttendance & { user?: User })[]>;
  getActivityAttendance(activityId: string, userId: string): Promise<ActivityAttendance | undefined>;
  getActivityAttendanceById(id: string): Promise<ActivityAttendance | undefined>;
  createActivityAttendance(data: InsertActivityAttendance): Promise<ActivityAttendance>;
  updateActivityAttendanceStatus(id: string, status: string): Promise<ActivityAttendance | undefined>;
  deleteActivityAttendance(id: string): Promise<boolean>;
  
  // Counselor Teams
  getCounselorTeams(committeeId: string): Promise<(CounselorTeam & { owner?: User; memberCount?: number })[]>;
  getCounselorTeam(id: string): Promise<CounselorTeam | undefined>;
  getCounselorTeamByOwner(ownerUserId: string, committeeId: string): Promise<CounselorTeam | undefined>;
  getCounselorTeamBySubdomain(subdomain: string): Promise<CounselorTeam | undefined>;
  getUserTeams(userId: string): Promise<(CounselorTeam & { committee?: Committee })[]>;
  createCounselorTeam(data: InsertCounselorTeam): Promise<CounselorTeam>;
  updateCounselorTeam(id: string, data: Partial<InsertCounselorTeam>): Promise<CounselorTeam | undefined>;
  deleteCounselorTeam(id: string): Promise<boolean>;
  
  // Counselor Team Members
  getCounselorTeamMembers(teamId: string): Promise<(CounselorTeamMember & { user?: User })[]>;
  getCounselorTeamMember(teamId: string, userId: string): Promise<CounselorTeamMember | undefined>;
  createCounselorTeamMember(data: InsertCounselorTeamMember): Promise<CounselorTeamMember>;
  deleteCounselorTeamMember(teamId: string, userId: string): Promise<boolean>;
  getTeamActivities(teamId: string, startDate?: string, endDate?: string): Promise<(MemberActivity & { userName?: string })[]>;
  
  // Team Invites
  getTeamInvites(teamId: string): Promise<TeamInvite[]>;
  getTeamInviteByToken(token: string): Promise<TeamInvite | undefined>;
  getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | undefined>;
  getPendingInviteByEmail(email: string): Promise<(TeamInvite & { team?: CounselorTeam })[]>;
  createTeamInvite(data: InsertTeamInvite): Promise<TeamInvite>;
  updateTeamInviteStatus(id: string, status: string, acceptedAt?: Date): Promise<TeamInvite | undefined>;
  
  // Push Subscriptions
  getPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined>;
  getAllActivePushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  deactivatePushSubscription(endpoint: string): Promise<boolean>;
  
  // Scheduled Notifications
  getScheduledNotification(id: string): Promise<ScheduledNotification | undefined>;
  getPendingNotifications(): Promise<ScheduledNotification[]>;
  getNotificationByReference(userId: string, type: string, referenceId: string): Promise<ScheduledNotification | undefined>;
  createScheduledNotification(data: InsertScheduledNotification): Promise<ScheduledNotification>;
  updateNotificationStatus(id: string, status: string, sentAt?: Date): Promise<ScheduledNotification | undefined>;
  snoozeNotification(id: string, newScheduledAt: Date): Promise<ScheduledNotification | undefined>;
  
  // Activity Assignments
  getActivityAssignments(activityId: string): Promise<ActivityAssignment[]>;
  getActivityAssignment(activityId: string, userId: string): Promise<ActivityAssignment | undefined>;
  createActivityAssignment(data: InsertActivityAssignment): Promise<ActivityAssignment>;
  deleteActivityAssignment(activityId: string, userId: string): Promise<boolean>;
  deleteActivityAssignmentsByActivity(activityId: string): Promise<boolean>;
  getAssignedActivities(userId: string, startDate?: string, endDate?: string): Promise<MemberActivity[]>;
}

export class DatabaseStorage implements IStorage {
  async getCommittees(): Promise<Committee[]> {
    return await db.select().from(committees).where(eq(committees.isActive, true));
  }

  async getAllCommittees(): Promise<Committee[]> {
    return await db.select().from(committees).where(eq(committees.isActive, true));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getCommittee(id: string): Promise<Committee | undefined> {
    const [committee] = await db.select().from(committees).where(eq(committees.id, id));
    return committee;
  }

  async createCommittee(data: InsertCommittee): Promise<Committee> {
    const [committee] = await db.insert(committees).values(data).returning();
    return committee;
  }

  async updateCommittee(id: string, data: Partial<InsertCommittee>): Promise<Committee | undefined> {
    const [committee] = await db.update(committees).set(data).where(eq(committees.id, id)).returning();
    return committee;
  }

  async getCommitteeMembers(committeeId: string): Promise<(CommitteeMember & { user?: User })[]> {
    const members = await db
      .select()
      .from(committeeMembers)
      .where(eq(committeeMembers.committeeId, committeeId));
    
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        return { ...member, user };
      })
    );
    
    return membersWithUsers;
  }

  async getCommitteeMember(id: string): Promise<CommitteeMember | undefined> {
    const [member] = await db.select().from(committeeMembers).where(eq(committeeMembers.id, id));
    return member;
  }

  async getUserMemberships(userId: string): Promise<(CommitteeMember & { committee?: Committee })[]> {
    const memberships = await db
      .select()
      .from(committeeMembers)
      .where(and(eq(committeeMembers.userId, userId), eq(committeeMembers.isActive, true)));
    
    const membershipsWithCommittees = await Promise.all(
      memberships.map(async (membership) => {
        const [committee] = await db.select().from(committees).where(eq(committees.id, membership.committeeId));
        return { ...membership, committee };
      })
    );
    
    return membershipsWithCommittees;
  }

  async getUserCommittees(userId: string): Promise<Committee[]> {
    const memberships = await this.getUserMemberships(userId);
    const committeeIds = memberships.map((m) => m.committeeId);
    
    if (committeeIds.length === 0) {
      return [];
    }
    
    const result = await db.select().from(committees).where(eq(committees.isActive, true));
    return result.filter((c) => committeeIds.includes(c.id));
  }

  async createCommitteeMember(data: InsertCommitteeMember): Promise<CommitteeMember> {
    const [member] = await db.insert(committeeMembers).values(data).returning();
    return member;
  }

  async updateCommitteeMember(id: string, data: Partial<InsertCommitteeMember>): Promise<CommitteeMember | undefined> {
    const [member] = await db.update(committeeMembers).set(data).where(eq(committeeMembers.id, id)).returning();
    return member;
  }

  async getAllMembers(): Promise<(CommitteeMember & { user?: User; committee?: Committee; role?: Role })[]> {
    const members = await db.select().from(committeeMembers);
    
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        const [committee] = await db.select().from(committees).where(eq(committees.id, member.committeeId));
        let role: Role | undefined = undefined;
        if (member.roleId) {
          const [roleData] = await db.select().from(roles).where(eq(roles.id, member.roleId));
          role = roleData;
        }
        return { ...member, user, committee, role };
      })
    );
    
    return membersWithDetails;
  }

  async getAttendanceSlots(
    committeeId: string,
    startDate: string,
    endDate: string
  ): Promise<(AttendanceSlot & { attendances?: (Attendance & { user?: User })[] })[]> {
    const slots = await db
      .select()
      .from(attendanceSlots)
      .where(
        and(
          eq(attendanceSlots.committeeId, committeeId),
          gte(attendanceSlots.date, startDate),
          lte(attendanceSlots.date, endDate)
        )
      );
    
    const slotsWithAttendances = await Promise.all(
      slots.map(async (slot) => {
        const slotAttendances = await db
          .select()
          .from(attendances)
          .where(eq(attendances.slotId, slot.id));
        
        const attendancesWithUsers = await Promise.all(
          slotAttendances.map(async (attendance) => {
            const [user] = await db.select().from(users).where(eq(users.id, attendance.userId));
            return { ...attendance, user };
          })
        );
        
        return { ...slot, attendances: attendancesWithUsers };
      })
    );
    
    return slotsWithAttendances;
  }

  async getAttendanceSlot(id: string): Promise<AttendanceSlot | undefined> {
    const [slot] = await db.select().from(attendanceSlots).where(eq(attendanceSlots.id, id));
    return slot;
  }

  async getSlotByDateAndShift(committeeId: string, date: string, shift: string): Promise<AttendanceSlot | undefined> {
    const [slot] = await db
      .select()
      .from(attendanceSlots)
      .where(
        and(
          eq(attendanceSlots.committeeId, committeeId),
          eq(attendanceSlots.date, date),
          eq(attendanceSlots.shift, shift as any)
        )
      );
    return slot;
  }

  async createAttendanceSlot(data: InsertAttendanceSlot): Promise<AttendanceSlot> {
    const [slot] = await db.insert(attendanceSlots).values(data).returning();
    return slot;
  }

  async updateAttendanceSlot(id: string, data: Partial<InsertAttendanceSlot>): Promise<AttendanceSlot | undefined> {
    const [slot] = await db.update(attendanceSlots).set(data).where(eq(attendanceSlots.id, id)).returning();
    return slot;
  }

  async getUpcomingSlots(userId: string): Promise<(AttendanceSlot & { committeeName: string })[]> {
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const memberships = await this.getUserMemberships(userId);
    const committeeIds = memberships.map((m) => m.committeeId);
    
    if (committeeIds.length === 0) {
      return [];
    }
    
    const allSlots: (AttendanceSlot & { committeeName: string })[] = [];
    
    for (const committeeId of committeeIds) {
      const [committee] = await db.select().from(committees).where(eq(committees.id, committeeId));
      const slots = await db
        .select()
        .from(attendanceSlots)
        .where(
          and(
            eq(attendanceSlots.committeeId, committeeId),
            gte(attendanceSlots.date, today),
            lte(attendanceSlots.date, nextWeek),
            eq(attendanceSlots.isBlocked, false)
          )
        );
      
      allSlots.push(...slots.map((slot) => ({ ...slot, committeeName: committee?.name || "" })));
    }
    
    return allSlots.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAttendances(slotId: string): Promise<(Attendance & { user?: User })[]> {
    const slotAttendances = await db
      .select()
      .from(attendances)
      .where(eq(attendances.slotId, slotId));
    
    const attendancesWithUsers = await Promise.all(
      slotAttendances.map(async (attendance) => {
        const [user] = await db.select().from(users).where(eq(users.id, attendance.userId));
        return { ...attendance, user };
      })
    );
    
    return attendancesWithUsers;
  }

  async getUserAttendances(userId: string): Promise<(Attendance & { slot?: AttendanceSlot & { committee?: Committee } })[]> {
    const userAttendances = await db
      .select()
      .from(attendances)
      .where(eq(attendances.userId, userId))
      .orderBy(desc(attendances.registeredAt));
    
    const attendancesWithDetails = await Promise.all(
      userAttendances.map(async (attendance) => {
        const [slot] = await db.select().from(attendanceSlots).where(eq(attendanceSlots.id, attendance.slotId));
        if (slot) {
          const [committee] = await db.select().from(committees).where(eq(committees.id, slot.committeeId));
          return { ...attendance, slot: { ...slot, committee } };
        }
        return { ...attendance, slot: undefined };
      })
    );
    
    return attendancesWithDetails;
  }

  async getAttendanceById(id: string): Promise<Attendance | undefined> {
    const [attendance] = await db.select().from(attendances).where(eq(attendances.id, id));
    return attendance;
  }

  async createAttendance(data: InsertAttendance): Promise<Attendance> {
    const existingRecord = await db
      .select()
      .from(attendances)
      .where(and(eq(attendances.slotId, data.slotId), eq(attendances.userId, data.userId)));
    
    const confirmedRecord = existingRecord.find(a => a.status === 'confirmed');
    if (confirmedRecord) {
      throw new Error('ALREADY_REGISTERED');
    }
    
    const cancelledRecord = existingRecord.find(a => a.status === 'cancelled');
    if (cancelledRecord) {
      const [updated] = await db
        .update(attendances)
        .set({ status: 'confirmed', registeredAt: new Date(), cancelledAt: null })
        .where(eq(attendances.id, cancelledRecord.id))
        .returning();
      return updated;
    }
    
    try {
      const [attendance] = await db.insert(attendances).values(data).returning();
      return attendance;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('ALREADY_REGISTERED');
      }
      throw error;
    }
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const result = await db
      .update(attendances)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(attendances.id, id))
      .returning();
    return result.length > 0;
  }

  async updateAttendanceStatus(id: string, status: string): Promise<Attendance | undefined> {
    const [attendance] = await db
      .update(attendances)
      .set({ status })
      .where(eq(attendances.id, id))
      .returning();
    return attendance;
  }

  async getMemberActivities(
    committeeId: string,
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<MemberActivity[]> {
    let query = db.select().from(memberActivities).where(eq(memberActivities.committeeId, committeeId));
    
    const results = await query.orderBy(desc(memberActivities.activityDate));
    
    let filtered = results;
    if (userId) {
      filtered = filtered.filter(a => a.userId === userId);
    }
    if (startDate) {
      filtered = filtered.filter(a => a.activityDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(a => a.activityDate <= endDate);
    }
    
    return filtered;
  }

  async getMemberActivity(id: string): Promise<MemberActivity | undefined> {
    const [activity] = await db.select().from(memberActivities).where(eq(memberActivities.id, id));
    return activity;
  }

  async getUserActivities(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<(MemberActivity & { committee?: Committee })[]> {
    let results = await db
      .select()
      .from(memberActivities)
      .where(eq(memberActivities.userId, userId))
      .orderBy(desc(memberActivities.activityDate));
    
    if (startDate) {
      results = results.filter(a => a.activityDate >= startDate);
    }
    if (endDate) {
      results = results.filter(a => a.activityDate <= endDate);
    }
    
    const activitiesWithCommittee = await Promise.all(
      results.map(async (activity) => {
        const [committee] = await db.select().from(committees).where(eq(committees.id, activity.committeeId));
        return { ...activity, committee };
      })
    );
    
    return activitiesWithCommittee;
  }

  async getCalendarActivities(
    committeeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<(MemberActivity & { userName?: string })[]> {
    let results = await db
      .select()
      .from(memberActivities)
      .where(
        and(
          eq(memberActivities.committeeId, committeeId),
          eq(memberActivities.isVisibleOnCalendar, true)
        )
      )
      .orderBy(desc(memberActivities.activityDate));
    
    if (startDate) {
      results = results.filter(a => a.activityDate >= startDate);
    }
    if (endDate) {
      results = results.filter(a => a.activityDate <= endDate);
    }
    
    const activitiesWithUser = await Promise.all(
      results.map(async (activity) => {
        const [user] = await db.select().from(users).where(eq(users.id, activity.userId));
        const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Usuario';
        return { ...activity, userName };
      })
    );
    
    return activitiesWithUser;
  }

  async createMemberActivity(data: InsertMemberActivity): Promise<MemberActivity> {
    const [activity] = await db.insert(memberActivities).values(data).returning();
    return activity;
  }

  async updateMemberActivity(id: string, data: Partial<InsertMemberActivity>): Promise<MemberActivity | undefined> {
    const [activity] = await db
      .update(memberActivities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(memberActivities.id, id))
      .returning();
    return activity;
  }

  async deleteMemberActivity(id: string): Promise<boolean> {
    const result = await db.delete(memberActivities).where(eq(memberActivities.id, id)).returning();
    return result.length > 0;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async upsertNotificationPreferences(data: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(data.userId);
    
    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, data.userId))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(notificationPreferences).values(data).returning();
    return created;
  }

  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).where(eq(roles.isActive, true));
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRole(data: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(data).returning();
    return role;
  }

  async updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [role] = await db
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: string): Promise<boolean> {
    const [role] = await db
      .update(roles)
      .set({ isActive: false })
      .where(eq(roles.id, id))
      .returning();
    return !!role;
  }

  async getGeneralCommittees(): Promise<Committee[]> {
    return await db.select().from(committees).where(
      and(eq(committees.isActive, true), eq(committees.isGeneral, true))
    );
  }

  async getAllUsersWithPushEnabled(): Promise<NotificationPreferences[]> {
    return await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.pushEnabled, true));
  }

  async getUserAttendancesForNotification(userId: string, minutesBefore: number): Promise<Attendance[]> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + minutesBefore * 60000);
    const windowStart = new Date(targetTime.getTime() - 30000);
    const windowEnd = new Date(targetTime.getTime() + 30000);
    
    const userAttendanceList = await db
      .select()
      .from(attendances)
      .innerJoin(attendanceSlots, eq(attendances.slotId, attendanceSlots.id))
      .where(eq(attendances.userId, userId));
    
    return userAttendanceList
      .filter(row => {
        const slotDate = new Date(row.attendance_slots.date);
        const shift = row.attendance_slots.shift;
        const startHour = shift === "morning" ? 9 : shift === "afternoon" ? 14 : 9;
        slotDate.setHours(startHour, 0, 0, 0);
        return slotDate >= windowStart && slotDate <= windowEnd;
      })
      .map(row => row.attendances);
  }

  async getUserActivitiesForNotification(userId: string, minutesBefore: number): Promise<MemberActivity[]> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + minutesBefore * 60000);
    const windowStart = new Date(targetTime.getTime() - 30000);
    const windowEnd = new Date(targetTime.getTime() + 30000);
    
    const activities = await db
      .select()
      .from(memberActivities)
      .where(eq(memberActivities.userId, userId));
    
    return activities.filter(activity => {
      const activityDate = new Date(activity.activityDate);
      const startTime = activity.startTime || "09:00";
      const [hours, mins] = startTime.split(":").map(Number);
      activityDate.setHours(hours, mins, 0, 0);
      return activityDate >= windowStart && activityDate <= windowEnd;
    });
  }

  async getActivityAttendances(activityId: string): Promise<(ActivityAttendance & { user?: User })[]> {
    const attendanceList = await db
      .select()
      .from(activityAttendances)
      .where(eq(activityAttendances.activityId, activityId));
    
    const attendancesWithUsers = await Promise.all(
      attendanceList.map(async (attendance) => {
        const [user] = await db.select().from(users).where(eq(users.id, attendance.userId));
        return { ...attendance, user };
      })
    );
    
    return attendancesWithUsers;
  }

  async getActivityAttendance(activityId: string, userId: string): Promise<ActivityAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(activityAttendances)
      .where(
        and(
          eq(activityAttendances.activityId, activityId),
          eq(activityAttendances.userId, userId)
        )
      );
    return attendance;
  }

  async getActivityAttendanceById(id: string): Promise<ActivityAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(activityAttendances)
      .where(eq(activityAttendances.id, id));
    return attendance;
  }

  async createActivityAttendance(data: InsertActivityAttendance): Promise<ActivityAttendance> {
    const [attendance] = await db.insert(activityAttendances).values(data).returning();
    return attendance;
  }

  async updateActivityAttendanceStatus(id: string, status: string): Promise<ActivityAttendance | undefined> {
    const updateData: any = { status };
    if (status === "confirmed") {
      updateData.confirmedAt = new Date();
    }
    const [attendance] = await db
      .update(activityAttendances)
      .set(updateData)
      .where(eq(activityAttendances.id, id))
      .returning();
    return attendance;
  }

  async deleteActivityAttendance(id: string): Promise<boolean> {
    const result = await db.delete(activityAttendances).where(eq(activityAttendances.id, id));
    return true;
  }

  // Counselor Teams
  async getCounselorTeams(committeeId: string): Promise<(CounselorTeam & { owner?: User; memberCount?: number })[]> {
    const teams = await db
      .select()
      .from(counselorTeams)
      .where(and(
        eq(counselorTeams.committeeId, committeeId),
        eq(counselorTeams.isActive, true)
      ));
    
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        const [owner] = await db.select().from(users).where(eq(users.id, team.ownerUserId));
        const members = await db.select().from(counselorTeamMembers).where(eq(counselorTeamMembers.teamId, team.id));
        return {
          ...team,
          owner,
          memberCount: members.length,
        };
      })
    );
    return teamsWithDetails;
  }

  async getCounselorTeam(id: string): Promise<CounselorTeam | undefined> {
    const [team] = await db.select().from(counselorTeams).where(eq(counselorTeams.id, id));
    return team;
  }

  async getCounselorTeamByOwner(ownerUserId: string, committeeId: string): Promise<CounselorTeam | undefined> {
    const [team] = await db
      .select()
      .from(counselorTeams)
      .where(and(
        eq(counselorTeams.ownerUserId, ownerUserId),
        eq(counselorTeams.committeeId, committeeId),
        eq(counselorTeams.isActive, true)
      ));
    return team;
  }

  async getCounselorTeamBySubdomain(subdomain: string): Promise<CounselorTeam | undefined> {
    if (!subdomain) return undefined;
    const [team] = await db
      .select()
      .from(counselorTeams)
      .where(and(
        eq(counselorTeams.subdomain, subdomain.toLowerCase()),
        eq(counselorTeams.isActive, true)
      ));
    return team;
  }

  async getUserTeams(userId: string): Promise<(CounselorTeam & { committee?: Committee })[]> {
    // Teams where user is owner
    const ownedTeams = await db
      .select()
      .from(counselorTeams)
      .where(and(
        eq(counselorTeams.ownerUserId, userId),
        eq(counselorTeams.isActive, true)
      ));
    
    // Teams where user is a member
    const memberTeams = await db
      .select({
        team: counselorTeams,
      })
      .from(counselorTeamMembers)
      .innerJoin(counselorTeams, eq(counselorTeamMembers.teamId, counselorTeams.id))
      .where(and(
        eq(counselorTeamMembers.userId, userId),
        eq(counselorTeams.isActive, true)
      ));
    
    const allTeams = [...ownedTeams, ...memberTeams.map(t => t.team)];
    const uniqueTeams = allTeams.filter((team, index, self) => 
      index === self.findIndex(t => t.id === team.id)
    );
    
    const teamsWithCommittee = await Promise.all(
      uniqueTeams.map(async (team) => {
        const [committee] = await db.select().from(committees).where(eq(committees.id, team.committeeId));
        return { ...team, committee };
      })
    );
    return teamsWithCommittee;
  }

  async createCounselorTeam(data: InsertCounselorTeam): Promise<CounselorTeam> {
    const [team] = await db.insert(counselorTeams).values(data).returning();
    return team;
  }

  async updateCounselorTeam(id: string, data: Partial<InsertCounselorTeam>): Promise<CounselorTeam | undefined> {
    const [team] = await db.update(counselorTeams).set(data).where(eq(counselorTeams.id, id)).returning();
    return team;
  }

  async deleteCounselorTeam(id: string): Promise<boolean> {
    await db.update(counselorTeams).set({ isActive: false }).where(eq(counselorTeams.id, id));
    return true;
  }

  // Counselor Team Members
  async getCounselorTeamMembers(teamId: string): Promise<(CounselorTeamMember & { user?: User })[]> {
    const members = await db
      .select()
      .from(counselorTeamMembers)
      .where(eq(counselorTeamMembers.teamId, teamId));
    
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        return { ...member, user };
      })
    );
    return membersWithUsers;
  }

  async getCounselorTeamMember(teamId: string, userId: string): Promise<CounselorTeamMember | undefined> {
    const [member] = await db
      .select()
      .from(counselorTeamMembers)
      .where(and(
        eq(counselorTeamMembers.teamId, teamId),
        eq(counselorTeamMembers.userId, userId)
      ));
    return member;
  }

  async createCounselorTeamMember(data: InsertCounselorTeamMember): Promise<CounselorTeamMember> {
    const [member] = await db.insert(counselorTeamMembers).values(data).returning();
    return member;
  }

  async deleteCounselorTeamMember(teamId: string, userId: string): Promise<boolean> {
    await db.delete(counselorTeamMembers).where(and(
      eq(counselorTeamMembers.teamId, teamId),
      eq(counselorTeamMembers.userId, userId)
    ));
    return true;
  }

  async getTeamActivities(teamId: string, startDate?: string, endDate?: string): Promise<(MemberActivity & { userName?: string })[]> {
    let query = db.select().from(memberActivities).where(eq(memberActivities.teamId, teamId));
    
    if (startDate && endDate) {
      const activities = await db
        .select()
        .from(memberActivities)
        .where(and(
          eq(memberActivities.teamId, teamId),
          gte(memberActivities.activityDate, startDate),
          lte(memberActivities.activityDate, endDate)
        ));
      
      const activitiesWithUser = await Promise.all(
        activities.map(async (activity) => {
          const [user] = await db.select().from(users).where(eq(users.id, activity.userId));
          return {
            ...activity,
            userName: user?.firstName || user?.email,
          };
        })
      );
      return activitiesWithUser;
    }
    
    const activities = await db.select().from(memberActivities).where(eq(memberActivities.teamId, teamId));
    const activitiesWithUser = await Promise.all(
      activities.map(async (activity) => {
        const [user] = await db.select().from(users).where(eq(users.id, activity.userId));
        return {
          ...activity,
          userName: user?.firstName || user?.email,
        };
      })
    );
    return activitiesWithUser;
  }

  // Team Invites
  async getTeamInvites(teamId: string): Promise<TeamInvite[]> {
    return await db.select().from(teamInvites).where(eq(teamInvites.teamId, teamId));
  }

  async getTeamInviteByToken(token: string): Promise<TeamInvite | undefined> {
    const [invite] = await db.select().from(teamInvites).where(eq(teamInvites.token, token));
    return invite;
  }

  async getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | undefined> {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(
        eq(teamInvites.teamId, teamId),
        eq(teamInvites.email, email.toLowerCase()),
        eq(teamInvites.status, "pending")
      ));
    return invite;
  }

  async getPendingInviteByEmail(email: string): Promise<(TeamInvite & { team?: CounselorTeam })[]> {
    const invites = await db
      .select()
      .from(teamInvites)
      .where(and(
        eq(teamInvites.email, email.toLowerCase()),
        eq(teamInvites.status, "pending")
      ));
    
    const invitesWithTeam = await Promise.all(
      invites.map(async (invite) => {
        const [team] = await db.select().from(counselorTeams).where(eq(counselorTeams.id, invite.teamId));
        return { ...invite, team };
      })
    );
    return invitesWithTeam;
  }

  async createTeamInvite(data: InsertTeamInvite): Promise<TeamInvite> {
    const [invite] = await db.insert(teamInvites).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return invite;
  }

  async updateTeamInviteStatus(id: string, status: string, acceptedAt?: Date): Promise<TeamInvite | undefined> {
    const updateData: Record<string, any> = { status };
    if (acceptedAt) {
      updateData.acceptedAt = acceptedAt;
    }
    const [updated] = await db
      .update(teamInvites)
      .set(updateData)
      .where(eq(teamInvites.id, id))
      .returning();
    return updated;
  }

  // Push Subscriptions
  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(
      and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true))
    );
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const [subscription] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return subscription;
  }

  async getAllActivePushSubscriptions(): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.isActive, true));
  }

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const existing = await this.getPushSubscriptionByEndpoint(data.endpoint);
    if (existing) {
      const [updated] = await db
        .update(pushSubscriptions)
        .set({ ...data, isActive: true })
        .where(eq(pushSubscriptions.endpoint, data.endpoint))
        .returning();
      return updated;
    }
    const [subscription] = await db.insert(pushSubscriptions).values(data).returning();
    return subscription;
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return true;
  }

  async deactivatePushSubscription(endpoint: string): Promise<boolean> {
    await db.update(pushSubscriptions).set({ isActive: false }).where(eq(pushSubscriptions.endpoint, endpoint));
    return true;
  }

  // Scheduled Notifications
  async getScheduledNotification(id: string): Promise<ScheduledNotification | undefined> {
    const [notification] = await db.select().from(scheduledNotifications).where(eq(scheduledNotifications.id, id));
    return notification;
  }

  async getPendingNotifications(): Promise<ScheduledNotification[]> {
    const now = new Date();
    return await db
      .select()
      .from(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.status, "pending"),
          lte(scheduledNotifications.scheduledAt, now)
        )
      );
  }

  async getNotificationByReference(userId: string, type: string, referenceId: string): Promise<ScheduledNotification | undefined> {
    const [notification] = await db
      .select()
      .from(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.userId, userId),
          eq(scheduledNotifications.type, type as any),
          eq(scheduledNotifications.referenceId, referenceId),
          eq(scheduledNotifications.status, "pending")
        )
      );
    return notification;
  }

  async createScheduledNotification(data: InsertScheduledNotification): Promise<ScheduledNotification> {
    const [notification] = await db.insert(scheduledNotifications).values(data).returning();
    return notification;
  }

  async updateNotificationStatus(id: string, status: string, sentAt?: Date): Promise<ScheduledNotification | undefined> {
    const updateData: Record<string, any> = { status };
    if (sentAt) {
      updateData.sentAt = sentAt;
    }
    if (status === "confirmed" || status === "dismissed") {
      updateData.actionTakenAt = new Date();
    }
    const [updated] = await db
      .update(scheduledNotifications)
      .set(updateData)
      .where(eq(scheduledNotifications.id, id))
      .returning();
    return updated;
  }

  async snoozeNotification(id: string, newScheduledAt: Date): Promise<ScheduledNotification | undefined> {
    const notification = await this.getScheduledNotification(id);
    if (!notification) return undefined;
    
    const [updated] = await db
      .update(scheduledNotifications)
      .set({
        status: "pending",
        scheduledAt: newScheduledAt,
        snoozeCount: notification.snoozeCount + 1,
        sentAt: null,
      })
      .where(eq(scheduledNotifications.id, id))
      .returning();
    return updated;
  }

  // Activity Assignments
  async getActivityAssignments(activityId: string): Promise<ActivityAssignment[]> {
    return await db
      .select()
      .from(activityAssignments)
      .where(eq(activityAssignments.activityId, activityId));
  }

  async getActivityAssignment(activityId: string, userId: string): Promise<ActivityAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(activityAssignments)
      .where(and(
        eq(activityAssignments.activityId, activityId),
        eq(activityAssignments.userId, userId)
      ));
    return assignment;
  }

  async createActivityAssignment(data: InsertActivityAssignment): Promise<ActivityAssignment> {
    const [assignment] = await db
      .insert(activityAssignments)
      .values(data)
      .returning();
    return assignment;
  }

  async deleteActivityAssignment(activityId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(activityAssignments)
      .where(and(
        eq(activityAssignments.activityId, activityId),
        eq(activityAssignments.userId, userId)
      ));
    return true;
  }

  async deleteActivityAssignmentsByActivity(activityId: string): Promise<boolean> {
    await db
      .delete(activityAssignments)
      .where(eq(activityAssignments.activityId, activityId));
    return true;
  }

  async getAssignedActivities(userId: string, startDate?: string, endDate?: string): Promise<MemberActivity[]> {
    let query = db
      .select({ activity: memberActivities })
      .from(activityAssignments)
      .innerJoin(memberActivities, eq(activityAssignments.activityId, memberActivities.id))
      .where(eq(activityAssignments.userId, userId));
    
    const results = await query;
    return results.map(r => r.activity).filter(activity => {
      if (startDate && activity.activityDate < startDate) return false;
      if (endDate && activity.activityDate > endDate) return false;
      return true;
    });
  }
}

export const storage = new DatabaseStorage();
