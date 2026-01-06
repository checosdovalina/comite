import {
  committees,
  committeeMembers,
  attendanceSlots,
  attendances,
  type Committee,
  type InsertCommittee,
  type CommitteeMember,
  type InsertCommitteeMember,
  type AttendanceSlot,
  type InsertAttendanceSlot,
  type Attendance,
  type InsertAttendance,
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
  getAllMembers(): Promise<(CommitteeMember & { user?: User; committee?: Committee })[]>;
  
  getAttendanceSlots(committeeId: string, startDate: string, endDate: string): Promise<(AttendanceSlot & { attendances?: (Attendance & { user?: User })[] })[]>;
  getAttendanceSlot(id: string): Promise<AttendanceSlot | undefined>;
  createAttendanceSlot(data: InsertAttendanceSlot): Promise<AttendanceSlot>;
  updateAttendanceSlot(id: string, data: Partial<InsertAttendanceSlot>): Promise<AttendanceSlot | undefined>;
  getUpcomingSlots(userId: string): Promise<(AttendanceSlot & { committeeName: string })[]>;
  
  getAttendances(slotId: string): Promise<(Attendance & { user?: User })[]>;
  getUserAttendances(userId: string): Promise<(Attendance & { slot?: AttendanceSlot & { committee?: Committee } })[]>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  createAttendance(data: InsertAttendance): Promise<Attendance>;
  deleteAttendance(id: string): Promise<boolean>;
  updateAttendanceStatus(id: string, status: string): Promise<Attendance | undefined>;
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

  async getAllMembers(): Promise<(CommitteeMember & { user?: User; committee?: Committee })[]> {
    const members = await db.select().from(committeeMembers);
    
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        const [committee] = await db.select().from(committees).where(eq(committees.id, member.committeeId));
        return { ...member, user, committee };
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
}

export const storage = new DatabaseStorage();
