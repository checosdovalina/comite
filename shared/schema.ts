import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const systemRoleEnum = pgEnum("system_role", ["super_admin", "user"]);
export const shiftEnum = pgEnum("shift", ["morning", "afternoon", "full_day"]);
export const leadershipRoleEnum = pgEnum("leadership_role", ["president", "secretary", "counselor", "none"]);

export const committees = pgTable("committees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  workingDays: text("working_days").array().notNull().default(sql`ARRAY['monday','tuesday','wednesday','thursday','friday']`),
  morningStart: text("morning_start").notNull().default("09:00"),
  morningEnd: text("morning_end").notNull().default("13:00"),
  afternoonStart: text("afternoon_start").notNull().default("14:00"),
  afternoonEnd: text("afternoon_end").notNull().default("18:00"),
  maxPerShift: integer("max_per_shift").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow(),
});

export const committeeRelations = relations(committees, ({ many }) => ({
  members: many(committeeMembers),
  attendanceSlots: many(attendanceSlots),
}));

export const committeeMembers = pgTable("committee_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  committeeId: varchar("committee_id").notNull().references(() => committees.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  leadershipRole: leadershipRoleEnum("leadership_role").notNull().default("none"),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const committeeMemberRelations = relations(committeeMembers, ({ one }) => ({
  committee: one(committees, {
    fields: [committeeMembers.committeeId],
    references: [committees.id],
  }),
}));

export const attendanceSlots = pgTable("attendance_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  committeeId: varchar("committee_id").notNull().references(() => committees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  shift: shiftEnum("shift").notNull(),
  maxCapacity: integer("max_capacity").notNull().default(2),
  isBlocked: boolean("is_blocked").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attendanceSlotRelations = relations(attendanceSlots, ({ one, many }) => ({
  committee: one(committees, {
    fields: [attendanceSlots.committeeId],
    references: [committees.id],
  }),
  attendances: many(attendances),
}));

export const attendances = pgTable("attendances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").notNull().references(() => attendanceSlots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("confirmed"),
  registeredAt: timestamp("registered_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

export const attendanceRelations = relations(attendances, ({ one }) => ({
  slot: one(attendanceSlots, {
    fields: [attendances.slotId],
    references: [attendanceSlots.id],
  }),
}));

export const insertCommitteeSchema = createInsertSchema(committees).omit({
  id: true,
  createdAt: true,
});

export const insertCommitteeMemberSchema = createInsertSchema(committeeMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertAttendanceSlotSchema = createInsertSchema(attendanceSlots).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendances).omit({
  id: true,
  registeredAt: true,
  cancelledAt: true,
});

export type Committee = typeof committees.$inferSelect;
export type InsertCommittee = z.infer<typeof insertCommitteeSchema>;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type InsertCommitteeMember = z.infer<typeof insertCommitteeMemberSchema>;
export type AttendanceSlot = typeof attendanceSlots.$inferSelect;
export type InsertAttendanceSlot = z.infer<typeof insertAttendanceSlotSchema>;
export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
