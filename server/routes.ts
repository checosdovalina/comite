import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { insertCommitteeSchema, insertAttendanceSlotSchema, insertMemberActivitySchema, insertNotificationPreferencesSchema } from "@shared/schema";
import { z } from "zod";
import {
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";

async function isUserMemberOfCommittee(userId: string, committeeId: string): Promise<boolean> {
  const memberships = await storage.getUserMemberships(userId);
  return memberships.some(m => m.committeeId === committeeId);
}

async function isUserAdminOfCommittee(userId: string, committeeId: string): Promise<boolean> {
  const memberships = await storage.getUserMemberships(userId);
  const membership = memberships.find(m => m.committeeId === committeeId);
  return membership?.isAdmin === true;
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
      const publicData = allCommittees.map(c => ({
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
      
      if (!isAdmin && !isSuperAdminUser) {
        return res.status(403).json({ message: "Solo administradores pueden agregar miembros" });
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
      const { isAdmin: newIsAdmin, leadershipRole } = req.body;
      
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
      
      if (existingActivity.userId !== userId) {
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
      
      if (existingActivity.userId !== userId) {
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

  return httpServer;
}
