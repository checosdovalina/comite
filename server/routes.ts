import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { insertCommitteeSchema, insertAttendanceSlotSchema, insertMemberActivitySchema, insertNotificationPreferencesSchema, insertRoleSchema } from "@shared/schema";
import { z } from "zod";
import {
  startOfMonth,
  endOfMonth,
  format,
  addMinutes,
  isWithinInterval,
} from "date-fns";
import webpush from "web-push";
import cron from "node-cron";

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@comites-distritales.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function isUserMemberOfCommittee(userId: string, committeeId: string): Promise<boolean> {
  const memberships = await storage.getUserMemberships(userId);
  return memberships.some(m => m.committeeId === committeeId);
}

async function isUserAdminOfCommittee(userId: string, committeeId: string): Promise<boolean> {
  const memberships = await storage.getUserMemberships(userId);
  const membership = memberships.find(m => m.committeeId === committeeId);
  return membership?.isAdmin === true;
}

async function isUserCounselorOfGeneralCommittee(userId: string): Promise<boolean> {
  const memberships = await storage.getUserMemberships(userId);
  for (const m of memberships) {
    if (m.committee?.isGeneral && m.leadershipRole === "counselor") {
      return true;
    }
  }
  return false;
}

// Check if user is a team auxiliary in a General Council committee
// Returns the team ID they're restricted to, or null if they're not restricted
async function getUserTeamRestriction(userId: string): Promise<{ isRestricted: boolean; teamId: string | null }> {
  const memberships = await storage.getUserMemberships(userId);
  const teams = await storage.getUserTeams(userId);
  
  // Check if user is in a General Council committee
  const generalCouncilMembership = memberships.find(m => m.committee?.isGeneral);
  
  if (!generalCouncilMembership) {
    return { isRestricted: false, teamId: null };
  }
  
  // Check if user is a team owner (counselor) - not restricted
  const ownedTeam = teams.find(t => t.ownerUserId === userId && t.committee?.isGeneral);
  if (ownedTeam) {
    return { isRestricted: false, teamId: null };
  }
  
  // Check if user is a member (auxiliary) of a team in General Council - restricted
  const memberTeam = teams.find(t => t.ownerUserId !== userId && t.committee?.isGeneral);
  if (memberTeam) {
    return { isRestricted: true, teamId: memberTeam.id };
  }
  
  // In General Council but not in any team - not restricted
  return { isRestricted: false, teamId: null };
}

function isSuperAdmin(req: any): boolean {
  return req.user?.isSuperAdmin === true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  registerAuthRoutes(app);

  // Public endpoint for registration - get active committees
  app.get("/api/public/committees", async (req, res) => {
    try {
      const allCommittees = await storage.getAllCommittees();
      const publicData = allCommittees
        .filter(c => !c.isRestricted)
        .map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }));
      res.json(publicData);
    } catch (error) {
      console.error("Error fetching public committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.get("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committees = await storage.getUserCommittees(userId);
      res.json(committees);
    } catch (error) {
      console.error("Error fetching committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.get("/api/committees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committeeId = req.params.id;
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this committee" });
      }
      
      const committee = await storage.getCommittee(committeeId);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      res.json(committee);
    } catch (error) {
      console.error("Error fetching committee:", error);
      res.status(500).json({ message: "Failed to fetch committee" });
    }
  });

  app.get("/api/available-committees", isAuthenticated, async (req: any, res) => {
    try {
      const committees = await storage.getAllCommittees();
      res.json(committees);
    } catch (error) {
      console.error("Error fetching available committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.post("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Solo el superadmin puede crear comités" });
      }
      
      const userId = req.user.id;
      const validatedData = insertCommitteeSchema.parse(req.body);
      const committee = await storage.createCommittee(validatedData);
      
      await storage.createCommitteeMember({
        committeeId: committee.id,
        userId,
        isAdmin: true,
        leadershipRole: "none",
        isActive: true,
      });
      
      res.status(201).json(committee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating committee:", error);
      res.status(500).json({ message: "Failed to create committee" });
    }
  });

  app.post("/api/committees/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committeeId = req.params.id;
      
      const committee = await storage.getCommittee(committeeId);
      if (!committee) {
        return res.status(404).json({ message: "Comité no encontrado" });
      }
      
      if (committee.isRestricted) {
        return res.status(403).json({ message: "Este comité es restringido. Solo un administrador puede agregar miembros." });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (isMember) {
        return res.status(400).json({ message: "Ya eres miembro de este comité" });
      }
      
      const member = await storage.createCommitteeMember({
        committeeId,
        userId,
        isAdmin: false,
        leadershipRole: "none",
        isActive: true,
      });
      
      res.status(201).json(member);
    } catch (error) {
      console.error("Error joining committee:", error);
      res.status(500).json({ message: "Error al unirse al comité" });
    }
  });

  app.get("/api/committees/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committeeId = req.params.id;
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this committee's members" });
      }
      
      const members = await storage.getCommitteeMembers(committeeId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/my-memberships", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const memberships = await storage.getUserMemberships(userId);
      res.json(memberships);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  app.get("/api/all-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const allMembers = await storage.getAllMembers();
      
      if (isSuperAdmin(req)) {
        return res.json(allMembers);
      }
      
      const userMemberships = await storage.getUserMemberships(userId);
      const adminCommitteeIds = userMemberships
        .filter(m => m.isAdmin === true)
        .map(m => m.committeeId);
      
      if (adminCommitteeIds.length === 0) {
        return res.json([]);
      }
      
      const filteredMembers = allMembers.filter(m => adminCommitteeIds.includes(m.committeeId));
      
      res.json(filteredMembers);
    } catch (error) {
      console.error("Error fetching all members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.post("/api/committee-members", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.id;
      const { committeeId, userEmail, role } = req.body;
      
      if (!committeeId || !userEmail) {
        return res.status(400).json({ message: "Committee ID and user email are required" });
      }
      
      const isAdmin = await isUserAdminOfCommittee(requesterId, committeeId);
      const isSuperAdminUser = isSuperAdmin(req);
      const isCounselorOfGeneral = await isUserCounselorOfGeneralCommittee(requesterId);
      
      if (!isAdmin && !isSuperAdminUser && !isCounselorOfGeneral) {
        return res.status(403).json({ message: "Solo administradores o consejeros del Comité General pueden agregar miembros" });
      }
      
      const userToAdd = await storage.getUserByEmail(userEmail);
      if (!userToAdd) {
        return res.status(404).json({ message: "No se encontró un usuario con ese correo" });
      }
      
      const existingMember = await isUserMemberOfCommittee(userToAdd.id, committeeId);
      if (existingMember) {
        return res.status(400).json({ message: "El usuario ya es miembro de este comité" });
      }
      
      const member = await storage.createCommitteeMember({
        committeeId,
        userId: userToAdd.id,
        isAdmin: false,
        leadershipRole: "none",
        isActive: true,
      });
      
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ message: "Error al agregar miembro" });
    }
  });

  app.patch("/api/committee-members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.id;
      const { isAdmin: newIsAdmin, leadershipRole, roleId } = req.body;
      
      const member = await storage.getCommitteeMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const isRequesterAdmin = await isUserAdminOfCommittee(requesterId, member.committeeId);
      const isSuperAdminUser = isSuperAdmin(req);
      
      const updateData: any = {};
      
      if (newIsAdmin !== undefined) {
        if (!isRequesterAdmin && !isSuperAdminUser) {
          return res.status(403).json({ message: "Solo administradores pueden promover a otros" });
        }
        updateData.isAdmin = newIsAdmin;
      }
      
      if (leadershipRole !== undefined) {
        if (!isSuperAdminUser) {
          return res.status(403).json({ message: "Solo el superadmin puede asignar roles de liderazgo" });
        }
        updateData.leadershipRole = leadershipRole;
      }
      
      if (roleId !== undefined) {
        if (!isSuperAdminUser) {
          return res.status(403).json({ message: "Solo el superadmin puede asignar roles" });
        }
        updateData.roleId = roleId;
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No hay cambios para actualizar" });
      }
      
      const updatedMember = await storage.updateCommitteeMember(req.params.id, updateData);
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  app.get("/api/attendance-slots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committeeId = req.query.committeeId as string;
      const month = req.query.month as string;
      
      if (!committeeId) {
        return res.json([]);
      }
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this committee's schedule" });
      }
      
      const targetMonth = month ? new Date(`${month}-01`) : new Date();
      const startDate = format(startOfMonth(targetMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(targetMonth), "yyyy-MM-dd");
      
      const slots = await storage.getAttendanceSlots(committeeId, startDate, endDate);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.get("/api/upcoming-slots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const slots = await storage.getUpcomingSlots(userId);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching upcoming slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  // Get all attendances for a committee (for calendar display)
  app.get("/api/committees/:id/calendar-attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const committeeId = req.params.id;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start and end date are required" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const slots = await storage.getAttendanceSlots(committeeId, startDate, endDate);
      
      const calendarData = slots.flatMap((slot) => 
        (slot.attendances || [])
          .filter((a) => a.status === "confirmed")
          .map((a) => ({
            id: a.id,
            date: slot.date,
            shift: slot.shift,
            userId: a.userId,
            userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : "Usuario",
            registeredAt: a.registeredAt,
          }))
      );
      
      res.json(calendarData);
    } catch (error) {
      console.error("Error fetching calendar attendances:", error);
      res.status(500).json({ message: "Failed to fetch calendar attendances" });
    }
  });

  app.post("/api/attendance-slots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertAttendanceSlotSchema.parse(req.body);
      
      const isAdmin = await isUserAdminOfCommittee(userId, validatedData.committeeId);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can create attendance slots" });
      }
      
      const slot = await storage.createAttendanceSlot(validatedData);
      res.status(201).json(slot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating slot:", error);
      res.status(500).json({ message: "Failed to create slot" });
    }
  });

  app.get("/api/my-attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const attendances = await storage.getUserAttendances(userId);
      const attendancesWithDetails = attendances.map((a) => ({
        ...a,
        date: a.slot?.date,
        shift: a.slot?.shift,
        committeeId: a.slot?.committeeId,
        committeeName: a.slot?.committee?.name,
      }));
      res.json(attendancesWithDetails);
    } catch (error) {
      console.error("Error fetching attendances:", error);
      res.status(500).json({ message: "Failed to fetch attendances" });
    }
  });

  app.post("/api/attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { slotId } = req.body;
      
      if (!slotId) {
        return res.status(400).json({ message: "Slot ID is required" });
      }
      
      const slot = await storage.getAttendanceSlot(slotId);
      if (!slot) {
        return res.status(404).json({ message: "Slot not found" });
      }
      
      if (slot.isBlocked) {
        return res.status(400).json({ message: "This slot is blocked" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, slot.committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const existingAttendances = await storage.getAttendances(slotId);
      const confirmedCount = existingAttendances.filter((a) => a.status === "confirmed").length;
      
      const userAlreadyConfirmed = existingAttendances.some(
        (a) => a.userId === userId && a.status === "confirmed"
      );
      
      if (userAlreadyConfirmed) {
        return res.status(400).json({ message: "Already registered for this slot" });
      }
      
      if (confirmedCount >= slot.maxCapacity) {
        return res.status(400).json({ message: "No spots available" });
      }
      
      try {
        const attendance = await storage.createAttendance({
          slotId,
          userId,
          status: "confirmed",
        });
        
        res.status(201).json(attendance);
      } catch (error: any) {
        if (error.message === 'ALREADY_REGISTERED') {
          return res.status(400).json({ message: "Already registered for this slot" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error creating attendance:", error);
      res.status(500).json({ message: "Failed to create attendance" });
    }
  });

  app.patch("/api/attendances/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const attendance = await storage.getAttendanceById(req.params.id);
      
      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }
      
      if (attendance.userId !== userId) {
        return res.status(403).json({ message: "You can only confirm your own attendance" });
      }
      
      if (attendance.status !== "confirmed") {
        return res.status(400).json({ message: "Only scheduled attendances can be confirmed" });
      }
      
      const slot = await storage.getAttendanceSlot(attendance.slotId);
      if (!slot) {
        return res.status(404).json({ message: "Slot not found" });
      }
      
      const committee = await storage.getCommittee(slot.committeeId);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      
      const today = new Date().toISOString().split("T")[0];
      if (slot.date !== today) {
        return res.status(400).json({ message: "Solo puedes confirmar asistencia el día programado" });
      }
      
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = currentHours * 60 + currentMinutes;
      
      let startTime: number, endTime: number;
      if (slot.shift === "morning") {
        const [startH, startM] = (committee.morningStart || "09:00").split(":").map(Number);
        const [endH, endM] = (committee.morningEnd || "13:00").split(":").map(Number);
        startTime = startH * 60 + startM;
        endTime = endH * 60 + endM;
      } else {
        const [startH, startM] = (committee.afternoonStart || "14:00").split(":").map(Number);
        const [endH, endM] = (committee.afternoonEnd || "18:00").split(":").map(Number);
        startTime = startH * 60 + startM;
        endTime = endH * 60 + endM;
      }
      
      if (currentTime < startTime || currentTime > endTime) {
        const shiftName = slot.shift === "morning" ? "mañana" : "tarde";
        const start = slot.shift === "morning" ? committee.morningStart : committee.afternoonStart;
        const end = slot.shift === "morning" ? committee.morningEnd : committee.afternoonEnd;
        return res.status(400).json({ 
          message: `Solo puedes confirmar durante el turno de ${shiftName} (${start} - ${end})` 
        });
      }
      
      const updated = await storage.updateAttendanceStatus(req.params.id, "attended");
      res.json(updated);
    } catch (error) {
      console.error("Error confirming attendance:", error);
      res.status(500).json({ message: "Failed to confirm attendance" });
    }
  });

  app.delete("/api/attendances/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const attendance = await storage.getAttendanceById(req.params.id);
      
      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }
      
      if (attendance.userId !== userId) {
        return res.status(403).json({ message: "You can only cancel your own attendance" });
      }
      
      const success = await storage.deleteAttendance(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Attendance not found" });
      }
      res.json({ message: "Attendance cancelled" });
    } catch (error) {
      console.error("Error deleting attendance:", error);
      res.status(500).json({ message: "Failed to delete attendance" });
    }
  });

  app.get("/api/attendance-report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId, startDate, endDate } = req.query as { committeeId?: string; startDate?: string; endDate?: string };
      
      if (!committeeId || !startDate || !endDate) {
        return res.status(400).json({ message: "Committee ID, start date, and end date are required" });
      }
      
      const userObj = await storage.getUserByEmail(req.user.email);
      const isSuperAdmin = userObj?.isSuperAdmin === true;
      const isAdmin = await isUserAdminOfCommittee(userId, committeeId);
      
      if (!isSuperAdmin && !isAdmin) {
        return res.status(403).json({ message: "Only admins can view attendance reports" });
      }
      
      const slots = await storage.getAttendanceSlots(committeeId, startDate, endDate);
      
      const report = slots.flatMap((slot) => 
        (slot.attendances || [])
          .filter((a) => a.status === "confirmed")
          .map((a) => ({
            id: a.id,
            date: slot.date,
            shift: slot.shift,
            userId: a.userId,
            userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : "Usuario desconocido",
            userEmail: a.user?.email || "",
            registeredAt: a.registeredAt,
          }))
      );
      
      report.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.shift === "morning" ? -1 : 1;
      });
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching attendance report:", error);
      res.status(500).json({ message: "Failed to fetch attendance report" });
    }
  });

  app.post("/api/mark-attendance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId, date, shift } = req.body;
      
      if (!committeeId || !date || !shift) {
        return res.status(400).json({ message: "Committee, date, and shift are required" });
      }
      
      if (!["morning", "afternoon"].includes(shift)) {
        return res.status(400).json({ message: "Invalid shift. Must be 'morning' or 'afternoon'" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const committee = await storage.getCommittee(committeeId);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      
      let slot = await storage.getSlotByDateAndShift(committeeId, date, shift);
      
      if (!slot) {
        slot = await storage.createAttendanceSlot({
          committeeId,
          date,
          shift,
          maxCapacity: committee.maxPerShift,
          isBlocked: false,
        });
      }
      
      if (slot.isBlocked) {
        return res.status(400).json({ message: "This slot is blocked" });
      }
      
      const existingAttendances = await storage.getAttendances(slot.id);
      const userAlreadyConfirmed = existingAttendances.some(
        (a) => a.userId === userId && a.status === "confirmed"
      );
      
      if (userAlreadyConfirmed) {
        return res.status(400).json({ message: "Ya tienes asistencia registrada para este turno" });
      }
      
      try {
        const attendance = await storage.createAttendance({
          slotId: slot.id,
          userId,
          status: "confirmed",
        });
        
        res.status(201).json(attendance);
      } catch (error: any) {
        if (error.message === 'ALREADY_REGISTERED') {
          return res.status(400).json({ message: "Ya tienes asistencia registrada para este turno" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
      res.status(500).json({ message: "Failed to mark attendance" });
    }
  });

  // Member Activities Routes
  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      // Check if user is a team auxiliary in General Council - restrict to team activities only
      const restriction = await getUserTeamRestriction(userId);
      if (restriction.isRestricted && restriction.teamId) {
        const teamActivities = await storage.getTeamActivities(restriction.teamId, startDate, endDate);
        return res.json(teamActivities);
      }
      
      const activities = await storage.getUserActivities(userId, startDate, endDate);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching user activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/committees/:committeeId/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId } = req.params;
      const { memberId, startDate, endDate } = req.query;
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this committee's activities" });
      }
      
      const activities = await storage.getMemberActivities(committeeId, memberId, startDate, endDate);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching committee activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = { ...req.body, userId };
      
      const isMember = await isUserMemberOfCommittee(userId, data.committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      // Team auxiliaries must create activities for their team only
      const restriction = await getUserTeamRestriction(userId);
      if (restriction.isRestricted && restriction.teamId) {
        data.teamId = restriction.teamId;
      }
      
      const validatedData = insertMemberActivitySchema.parse(data);
      const activity = await storage.createMemberActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const existingActivity = await storage.getMemberActivity(id);
      if (!existingActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      // Team auxiliaries can only edit activities from their team
      const restriction = await getUserTeamRestriction(userId);
      if (restriction.isRestricted && restriction.teamId) {
        if (existingActivity.teamId !== restriction.teamId) {
          return res.status(403).json({ message: "You can only edit activities from your team" });
        }
      } else if (existingActivity.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own activities" });
      }
      
      const activity = await storage.updateMemberActivity(id, req.body);
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const existingActivity = await storage.getMemberActivity(id);
      if (!existingActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      // Team auxiliaries can only delete activities from their team
      const restriction = await getUserTeamRestriction(userId);
      if (restriction.isRestricted && restriction.teamId) {
        if (existingActivity.teamId !== restriction.teamId) {
          return res.status(403).json({ message: "You can only delete activities from your team" });
        }
      } else if (existingActivity.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own activities" });
      }
      
      await storage.deleteMemberActivity(id);
      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Calendar Activities (visible on calendar only)
  app.get("/api/committees/:committeeId/calendar-activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId } = req.params;
      const { startDate, endDate } = req.query;
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this committee's activities" });
      }
      
      const activities = await storage.getCalendarActivities(committeeId, startDate, endDate);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching calendar activities:", error);
      res.status(500).json({ message: "Failed to fetch calendar activities" });
    }
  });

  // Activity Attendance Routes
  app.get("/api/activities/:activityId/attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { activityId } = req.params;
      const activity = await storage.getMemberActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, activity.committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const attendances = await storage.getActivityAttendances(activityId);
      res.json(attendances);
    } catch (error) {
      console.error("Error fetching activity attendances:", error);
      res.status(500).json({ message: "Failed to fetch activity attendances" });
    }
  });

  app.post("/api/activities/:activityId/attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { activityId } = req.params;
      
      const activity = await storage.getMemberActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, activity.committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const existing = await storage.getActivityAttendance(activityId, userId);
      if (existing) {
        return res.status(400).json({ message: "You are already registered for this activity" });
      }
      
      const attendance = await storage.createActivityAttendance({
        activityId,
        userId,
        status: "registered",
      });
      
      res.status(201).json(attendance);
    } catch (error) {
      console.error("Error registering for activity:", error);
      res.status(500).json({ message: "Failed to register for activity" });
    }
  });

  app.delete("/api/activity-attendances/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const attendance = await storage.getActivityAttendanceById(id);
      
      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }
      
      if (attendance.userId !== userId) {
        return res.status(403).json({ message: "You can only cancel your own attendance" });
      }
      
      await storage.deleteActivityAttendance(id);
      res.json({ message: "Attendance cancelled" });
    } catch (error) {
      console.error("Error cancelling activity attendance:", error);
      res.status(500).json({ message: "Failed to cancel attendance" });
    }
  });

  app.patch("/api/activity-attendances/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const attendance = await storage.getActivityAttendanceById(id);
      
      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }
      
      if (attendance.userId !== userId) {
        return res.status(403).json({ message: "You can only confirm your own attendance" });
      }
      
      const updated = await storage.updateActivityAttendanceStatus(id, "confirmed");
      res.json(updated);
    } catch (error) {
      console.error("Error confirming activity attendance:", error);
      res.status(500).json({ message: "Failed to confirm attendance" });
    }
  });

  // Counselor Teams Routes
  app.get("/api/committees/:committeeId/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId } = req.params;
      
      const isMember = await isUserMemberOfCommittee(userId, committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      const teams = await storage.getCounselorTeams(committeeId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching counselor teams:", error);
      res.status(500).json({ message: "Failed to fetch counselor teams" });
    }
  });

  app.get("/api/teams/:teamId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const isMember = await isUserMemberOfCommittee(userId, team.committeeId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this committee" });
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.get("/api/my-teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching user teams:", error);
      res.status(500).json({ message: "Failed to fetch your teams" });
    }
  });

  // Get user's team context - returns info about whether user is an auxiliary in a General Council team
  app.get("/api/my-team-context", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const teams = await storage.getUserTeams(userId);
      const memberships = await storage.getUserMemberships(userId);
      
      // Check if user is in a General Council committee
      const generalCouncilMembership = memberships.find(m => m.committee?.isGeneral);
      
      if (!generalCouncilMembership) {
        // Not in a General Council - no restriction needed
        return res.json({ 
          isGeneralCouncilMember: false,
          isTeamAuxiliary: false,
          teamId: null,
          team: null
        });
      }
      
      // Check if user is a team owner (counselor) or a team member (auxiliary)
      const ownedTeam = teams.find(t => t.ownerUserId === userId && t.committee?.isGeneral);
      
      if (ownedTeam) {
        // User is a counselor with their own team
        return res.json({
          isGeneralCouncilMember: true,
          isTeamOwner: true,
          isTeamAuxiliary: false,
          teamId: ownedTeam.id,
          team: ownedTeam
        });
      }
      
      // Check if user is a member (auxiliary) of a team in General Council
      const memberTeam = teams.find(t => t.ownerUserId !== userId && t.committee?.isGeneral);
      
      if (memberTeam) {
        // User is an auxiliary in a General Council team
        return res.json({
          isGeneralCouncilMember: true,
          isTeamOwner: false,
          isTeamAuxiliary: true,
          teamId: memberTeam.id,
          team: memberTeam
        });
      }
      
      // In General Council but not in any team
      return res.json({
        isGeneralCouncilMember: true,
        isTeamOwner: false,
        isTeamAuxiliary: false,
        teamId: null,
        team: null
      });
    } catch (error) {
      console.error("Error fetching team context:", error);
      res.status(500).json({ message: "Failed to fetch team context" });
    }
  });

  app.post("/api/committees/:committeeId/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { committeeId } = req.params;
      
      // Verify user has a leadership role that can create teams
      // In Consejo General: counselor_president, counselor, secretary can have teams
      // These roles can manage their own "auxiliares" through the team system
      const rolesWithTeams = ["counselor_president", "counselor_secretary", "counselor", "secretary"];
      const membership = await storage.getUserMemberships(userId);
      const committeeMembership = membership.find(m => 
        m.committeeId === committeeId && rolesWithTeams.includes(m.leadershipRole)
      );
      
      if (!committeeMembership) {
        return res.status(403).json({ message: "Solo consejeros y secretarios pueden crear equipos" });
      }
      
      // Check if user already has a team in this committee
      const existingTeam = await storage.getCounselorTeamByOwner(userId, committeeId);
      if (existingTeam) {
        return res.status(400).json({ message: "You already have a team in this committee" });
      }
      
      const { name, description } = req.body;
      
      const team = await storage.createCounselorTeam({
        committeeId,
        ownerUserId: userId,
        name: name || "Mi Equipo",
        description,
        isActive: true,
      });
      
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:teamId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can update the team" });
      }
      
      const { name, description } = req.body;
      const updated = await storage.updateCounselorTeam(teamId, { name, description });
      res.json(updated);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:teamId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can delete the team" });
      }
      
      await storage.deleteCounselorTeam(teamId);
      res.json({ message: "Team deleted" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Team Members Routes
  app.get("/api/teams/:teamId/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Allow access if user is team owner or team member
      const isOwner = team.ownerUserId === userId;
      const isMember = await storage.getCounselorTeamMember(teamId, userId);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }
      
      const members = await storage.getCounselorTeamMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post("/api/teams/:teamId/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      const { email } = req.body;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Only team owner can add members
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can add members" });
      }
      
      // Find user by email
      const userToAdd = await storage.getUserByEmail(email);
      if (!userToAdd) {
        return res.status(404).json({ message: "User not found with that email" });
      }
      
      // Check if user is already a member
      const existingMember = await storage.getCounselorTeamMember(teamId, userToAdd.id);
      if (existingMember) {
        return res.status(400).json({ message: "User is already a team member" });
      }
      
      const member = await storage.createCounselorTeamMember({
        teamId,
        userId: userToAdd.id,
        role: "auxiliary",
      });
      
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding team member:", error);
      res.status(500).json({ message: "Failed to add team member" });
    }
  });

  app.delete("/api/teams/:teamId/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId, memberId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Only team owner can remove members
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can remove members" });
      }
      
      await storage.deleteCounselorTeamMember(teamId, memberId);
      res.json({ message: "Member removed" });
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ message: "Failed to remove team member" });
    }
  });

  // Team Invites Routes
  app.get("/api/teams/:teamId/invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Only team owner can view invites
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can view invites" });
      }
      
      const invites = await storage.getTeamInvites(teamId);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching team invites:", error);
      res.status(500).json({ message: "Failed to fetch team invites" });
    }
  });

  app.post("/api/teams/:teamId/invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      const { email, role = "auxiliary" } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Only team owner can send invites
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can send invites" });
      }
      
      // Check if user already exists in system
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        // Check if user is already a team member
        const existingMember = await storage.getCounselorTeamMember(teamId, existingUser.id);
        if (existingMember) {
          return res.status(400).json({ message: "User is already a team member" });
        }
        
        // Add them directly as a team member
        const member = await storage.createCounselorTeamMember({
          teamId,
          userId: existingUser.id,
          role: role as "counselor" | "auxiliary",
        });
        return res.status(201).json({ 
          type: "member_added",
          message: "User added as team member",
          member 
        });
      }
      
      // Check if there's already a pending invite for this email
      const existingInvite = await storage.getTeamInviteByEmail(teamId, email);
      if (existingInvite) {
        return res.status(400).json({ message: "An invite is already pending for this email" });
      }
      
      // Generate secure token and expiration (7 days)
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const invite = await storage.createTeamInvite({
        teamId,
        email,
        invitedByUserId: userId,
        token,
        status: "pending",
        role: role as "counselor" | "auxiliary",
        expiresAt,
      });
      
      res.status(201).json({ 
        type: "invite_created",
        message: "Invitation created",
        invite,
        registrationUrl: `/register?invite=${token}`
      });
    } catch (error) {
      console.error("Error creating team invite:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.delete("/api/teams/:teamId/invites/:inviteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId, inviteId } = req.params;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Only team owner can cancel invites
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Only the team owner can cancel invites" });
      }
      
      await storage.updateTeamInviteStatus(inviteId, "cancelled");
      res.json({ message: "Invite cancelled" });
    } catch (error) {
      console.error("Error cancelling invite:", error);
      res.status(500).json({ message: "Failed to cancel invite" });
    }
  });

  // Public endpoint to get invite details by token
  app.get("/api/invites/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invite = await storage.getTeamInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }
      
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invite has already been used or cancelled" });
      }
      
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This invite has expired" });
      }
      
      // Get team info
      const team = await storage.getCounselorTeam(invite.teamId);
      
      res.json({
        email: invite.email,
        role: invite.role,
        teamName: team?.name,
        expiresAt: invite.expiresAt,
      });
    } catch (error) {
      console.error("Error fetching invite:", error);
      res.status(500).json({ message: "Failed to fetch invite" });
    }
  });

  // Team Activities Routes
  app.get("/api/teams/:teamId/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamId } = req.params;
      const { startDate, endDate } = req.query;
      
      const team = await storage.getCounselorTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Allow access if user is team owner or team member
      const isOwner = team.ownerUserId === userId;
      const isMember = await storage.getCounselorTeamMember(teamId, userId);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }
      
      const activities = await storage.getTeamActivities(
        teamId,
        startDate as string,
        endDate as string
      );
      res.json(activities);
    } catch (error) {
      console.error("Error fetching team activities:", error);
      res.status(500).json({ message: "Failed to fetch team activities" });
    }
  });

  // Notification Preferences Routes
  app.get("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const prefs = await storage.getNotificationPreferences(userId);
      res.json(prefs || {
        userId,
        shiftReminders: true,
        activityReminders: true,
        reminderMinutesBefore: 60,
        pushEnabled: false,
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = { ...req.body, userId };
      
      const validatedData = insertNotificationPreferencesSchema.parse(data);
      const prefs = await storage.upsertNotificationPreferences(validatedData);
      res.json(prefs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Admin Committees Routes (Superadmin only)
  app.get("/api/admin/committees", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only superadmins can view all committees" });
      }
      
      const allCommittees = await storage.getAllCommittees();
      res.json(allCommittees);
    } catch (error) {
      console.error("Error fetching all committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.patch("/api/admin/committees/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only superadmins can update committees" });
      }
      
      const { id } = req.params;
      const { isGeneral, usesShifts, isRestricted } = req.body;
      
      if (isGeneral === true) {
        const allCommittees = await storage.getAllCommittees();
        const existingGeneral = allCommittees.find(c => c.isGeneral && c.id !== id);
        if (existingGeneral) {
          return res.status(400).json({ 
            message: "Ya existe un Comité General. Solo puede haber uno." 
          });
        }
      }
      
      const updateData: { isGeneral?: boolean; usesShifts?: boolean; isRestricted?: boolean } = {};
      if (isGeneral !== undefined) updateData.isGeneral = isGeneral;
      if (usesShifts !== undefined) updateData.usesShifts = usesShifts;
      if (isRestricted !== undefined) updateData.isRestricted = isRestricted;
      
      const committee = await storage.updateCommittee(id, updateData);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      res.json(committee);
    } catch (error) {
      console.error("Error updating committee:", error);
      res.status(500).json({ message: "Failed to update committee" });
    }
  });

  // Roles Routes (Superadmin only)
  app.get("/api/roles", isAuthenticated, async (req: any, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only superadmins can create roles" });
      }
      
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only superadmins can update roles" });
      }
      
      const { id } = req.params;
      const role = await storage.updateRole(id, req.body);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only superadmins can delete roles" });
      }
      
      const { id } = req.params;
      const deleted = await storage.deleteRole(id);
      if (!deleted) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Push Notification Subscription Routes
  app.get("/api/vapid-public-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.post("/api/push-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { subscription } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ message: "Subscription required" });
      }
      
      const existingPrefs = await storage.getNotificationPreferences(userId);
      
      await storage.upsertNotificationPreferences({
        userId,
        pushEnabled: true,
        pushSubscription: JSON.stringify(subscription),
        shiftReminders: existingPrefs?.shiftReminders ?? true,
        activityReminders: existingPrefs?.activityReminders ?? true,
        reminderMinutesBefore: existingPrefs?.reminderMinutesBefore ?? 60,
      });
      
      res.json({ message: "Subscription saved successfully" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.delete("/api/push-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const prefs = await storage.getNotificationPreferences(userId);
      
      if (prefs) {
        await storage.upsertNotificationPreferences({
          ...prefs,
          pushEnabled: false,
          pushSubscription: null,
        });
      }
      
      res.json({ message: "Subscription removed successfully" });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  // Test push notification (for debugging)
  app.post("/api/test-push", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const prefs = await storage.getNotificationPreferences(userId);
      
      if (!prefs?.pushEnabled || !prefs?.pushSubscription) {
        return res.status(400).json({ message: "Push notifications not enabled" });
      }
      
      const subscription = JSON.parse(prefs.pushSubscription);
      
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: "Prueba de Notificación",
          body: "Las notificaciones push están funcionando correctamente.",
          data: { url: "/" }
        })
      );
      
      res.json({ message: "Test notification sent" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Start notification scheduler (runs every minute)
  cron.schedule("* * * * *", async () => {
    try {
      await sendScheduledNotifications();
    } catch (error) {
      console.error("Error in notification scheduler:", error);
    }
  });

  return httpServer;
}

// Track sent notifications to prevent duplicates (clears old entries every hour)
const sentNotifications = new Map<string, number>();
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, timestamp] of sentNotifications.entries()) {
    if (timestamp < oneHourAgo) {
      sentNotifications.delete(key);
    }
  }
}, 3600000);

function getNotificationKey(userId: string, eventType: string, eventId: string, reminderMinutes: number): string {
  return `${userId}:${eventType}:${eventId}:${reminderMinutes}`;
}

// Send notifications for upcoming events
async function sendScheduledNotifications() {
  const allUsers = await storage.getAllUsersWithPushEnabled();
  
  for (const prefs of allUsers) {
    if (!prefs.pushSubscription) continue;
    
    try {
      const subscription = JSON.parse(prefs.pushSubscription);
      const reminderMinutes = prefs.reminderMinutesBefore || 60;
      
      // Check for upcoming attendance slots
      if (prefs.shiftReminders) {
        const userAttendances = await storage.getUserAttendancesForNotification(prefs.userId, reminderMinutes);
        for (const attendance of userAttendances) {
          const notifKey = getNotificationKey(prefs.userId, "attendance", attendance.id, reminderMinutes);
          if (sentNotifications.has(notifKey)) continue;
          
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "Recordatorio de Turno",
              body: `Tu turno comienza en ${reminderMinutes} minutos`,
              data: { url: "/attendances" }
            })
          );
          sentNotifications.set(notifKey, Date.now());
        }
      }
      
      // Check for upcoming activities
      if (prefs.activityReminders) {
        const userActivities = await storage.getUserActivitiesForNotification(prefs.userId, reminderMinutes);
        for (const activity of userActivities) {
          const notifKey = getNotificationKey(prefs.userId, "activity", activity.id, reminderMinutes);
          if (sentNotifications.has(notifKey)) continue;
          
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "Recordatorio de Actividad",
              body: `${activity.title} - en ${reminderMinutes} minutos`,
              data: { url: "/activities" }
            })
          );
          sentNotifications.set(notifKey, Date.now());
        }
      }
    } catch (error) {
      console.error(`Error sending notification to user ${prefs.userId}:`, error);
    }
  }
}
