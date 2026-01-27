import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const systemRoleEnum = pgEnum("system_role", ["super_admin", "user"]);
export const shiftEnum = pgEnum("shift", ["morning", "afternoon", "full_day"]);
export const leadershipRoleEnum = pgEnum("leadership_role", [
  "counselor_president",   // Consejero Presidente (for both district and general)
  "counselor_secretary",   // Consejero Secretario (district only)
  "counselor",             // Consejero (for both)
  "secretary",             // Secretario (general council only)
  "auxiliary",             // Auxiliar (district only, via direct membership)
  "none"                   // No leadership role
]);

export const committees = pgTable("committees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  isGeneral: boolean("is_general").notNull().default(false),
  usesShifts: boolean("uses_shifts").notNull().default(true),
  isRestricted: boolean("is_restricted").notNull().default(false),
  workingDays: text("working_days").array().notNull().default(sql`ARRAY['monday','tuesday','wednesday','thursday','friday']`),
  morningStart: text("morning_start").notNull().default("09:00"),
  morningEnd: text("morning_end").notNull().default("13:00"),
  afternoonStart: text("afternoon_start").notNull().default("14:00"),
  afternoonEnd: text("afternoon_end").notNull().default("18:00"),
  maxPerShift: integer("max_per_shift").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
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
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "set null" }),
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

export const activityTypeEnum = pgEnum("activity_type", ["meeting", "visit", "report", "training", "event", "session", "other"]);

export const memberActivities = pgTable("member_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  committeeId: varchar("committee_id").notNull().references(() => committees.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  teamId: varchar("team_id").references(() => counselorTeams.id, { onDelete: "cascade" }), // Optional: for team-scoped activities
  title: text("title").notNull(),
  description: text("description"),
  activityType: activityTypeEnum("activity_type").notNull().default("other"),
  activityDate: date("activity_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  isCompleted: boolean("is_completed").notNull().default(false),
  isVisibleOnCalendar: boolean("is_visible_on_calendar").notNull().default(true),
  notes: text("notes"),
  meetingUrl: text("meeting_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memberActivityRelations = relations(memberActivities, ({ one, many }) => ({
  committee: one(committees, {
    fields: [memberActivities.committeeId],
    references: [committees.id],
  }),
  activityAttendances: many(activityAttendances),
  assignments: many(activityAssignments),
}));

export const activityAttendances = pgTable("activity_attendances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id").notNull().references(() => memberActivities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("registered"),
  registeredAt: timestamp("registered_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const activityAttendanceRelations = relations(activityAttendances, ({ one }) => ({
  activity: one(memberActivities, {
    fields: [activityAttendances.activityId],
    references: [memberActivities.id],
  }),
}));

// Activity assignments - track which members are assigned to an activity
export const activityAssignments = pgTable("activity_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id").notNull().references(() => memberActivities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  notificationSent: boolean("notification_sent").notNull().default(false),
});

export const activityAssignmentRelations = relations(activityAssignments, ({ one }) => ({
  activity: one(memberActivities, {
    fields: [activityAssignments.activityId],
    references: [memberActivities.id],
  }),
}));

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  shiftReminders: boolean("shift_reminders").notNull().default(true),
  activityReminders: boolean("activity_reminders").notNull().default(true),
  reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(60),
  reminderMinutesArray: integer("reminder_minutes_array").array(),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  pushSubscription: text("push_subscription"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Counselor Teams - for Consejo General counselors to manage their auxiliaries
export const counselorTeams = pgTable("counselor_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  committeeId: varchar("committee_id").notNull().references(() => committees.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").notNull(), // The counselor who owns this team
  name: text("name").notNull(),
  description: text("description"),
  subdomain: text("subdomain").unique(), // Optional subdomain for team access (e.g., "consejero1" for consejero1.comite.dovexmx.com)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const counselorTeamRelations = relations(counselorTeams, ({ one, many }) => ({
  committee: one(committees, {
    fields: [counselorTeams.committeeId],
    references: [committees.id],
  }),
  members: many(counselorTeamMembers),
}));

export const teamRoleEnum = pgEnum("team_role", ["counselor", "auxiliary"]);

export const counselorTeamMembers = pgTable("counselor_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => counselorTeams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: teamRoleEnum("role").notNull().default("auxiliary"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const counselorTeamMemberRelations = relations(counselorTeamMembers, ({ one }) => ({
  team: one(counselorTeams, {
    fields: [counselorTeamMembers.teamId],
    references: [counselorTeams.id],
  }),
}));

// Team Invitations - for inviting unregistered users to join a team
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "cancelled", "expired"]);

export const teamInvites = pgTable("team_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => counselorTeams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull(),
  token: varchar("token").notNull().unique(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  role: teamRoleEnum("role").notNull().default("auxiliary"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamInviteRelations = relations(teamInvites, ({ one }) => ({
  team: one(counselorTeams, {
    fields: [teamInvites.teamId],
    references: [counselorTeams.id],
  }),
}));

// Push Subscriptions - for storing push notification subscriptions per device
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scheduled Notifications - for tracking notification status and actions
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed", "snoozed", "confirmed", "dismissed"]);
export const notificationTypeEnum = pgEnum("notification_type", ["attendance_reminder", "activity_reminder"]);

export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  referenceId: varchar("reference_id").notNull(), // attendance_slot id or member_activity id
  title: text("title").notNull(),
  body: text("body").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  snoozeCount: integer("snooze_count").notNull().default(0),
  actionTakenAt: timestamp("action_taken_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents - files and documents uploaded by team members
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => counselorTeams.id, { onDelete: "cascade" }),
  committeeId: varchar("committee_id").references(() => committees.id, { onDelete: "cascade" }),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  objectPath: text("object_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentRelations = relations(documents, ({ one }) => ({
  team: one(counselorTeams, {
    fields: [documents.teamId],
    references: [counselorTeams.id],
  }),
  committee: one(committees, {
    fields: [documents.committeeId],
    references: [committees.id],
  }),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertScheduledNotificationSchema = createInsertSchema(scheduledNotifications).omit({
  id: true,
  sentAt: true,
  actionTakenAt: true,
  createdAt: true,
});

export const insertTeamInviteSchema = createInsertSchema(teamInvites).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertCommitteeSchema = createInsertSchema(committees).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
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

export const insertMemberActivitySchema = createInsertSchema(memberActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityAttendanceSchema = createInsertSchema(activityAttendances).omit({
  id: true,
  registeredAt: true,
  confirmedAt: true,
});

export const insertActivityAssignmentSchema = createInsertSchema(activityAssignments).omit({
  id: true,
  assignedAt: true,
  notificationSent: true,
});

export const insertCounselorTeamSchema = createInsertSchema(counselorTeams).omit({
  id: true,
  createdAt: true,
});

export const insertCounselorTeamMemberSchema = createInsertSchema(counselorTeamMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type Committee = typeof committees.$inferSelect;
export type InsertCommittee = z.infer<typeof insertCommitteeSchema>;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type InsertCommitteeMember = z.infer<typeof insertCommitteeMemberSchema>;
export type AttendanceSlot = typeof attendanceSlots.$inferSelect;
export type InsertAttendanceSlot = z.infer<typeof insertAttendanceSlotSchema>;
export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type MemberActivity = typeof memberActivities.$inferSelect;
export type InsertMemberActivity = z.infer<typeof insertMemberActivitySchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type ActivityAttendance = typeof activityAttendances.$inferSelect;
export type InsertActivityAttendance = z.infer<typeof insertActivityAttendanceSchema>;
export type ActivityAssignment = typeof activityAssignments.$inferSelect;
export type InsertActivityAssignment = z.infer<typeof insertActivityAssignmentSchema>;
export type CounselorTeam = typeof counselorTeams.$inferSelect;
export type InsertCounselorTeam = z.infer<typeof insertCounselorTeamSchema>;
export type CounselorTeamMember = typeof counselorTeamMembers.$inferSelect;
export type InsertCounselorTeamMember = z.infer<typeof insertCounselorTeamMemberSchema>;
export type TeamInvite = typeof teamInvites.$inferSelect;
export type InsertTeamInvite = z.infer<typeof insertTeamInviteSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = z.infer<typeof insertScheduledNotificationSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
