import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertCommitteeSchema, insertAttendanceSlotSchema } from "@shared/schema";
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
  return membership?.role === 'admin';
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const committees = await storage.getUserCommittees(userId);
      res.json(committees);
    } catch (error) {
      console.error("Error fetching committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.get("/api/committees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.post("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCommitteeSchema.parse(req.body);
      
      const committee = await storage.createCommittee(validatedData);
      
      await storage.createCommitteeMember({
        committeeId: committee.id,
        userId,
        role: "admin",
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

  app.get("/api/committees/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const memberships = await storage.getUserMemberships(userId);
      res.json(memberships);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  app.get("/api/all-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userMemberships = await storage.getUserMemberships(userId);
      
      const adminCommitteeIds = userMemberships
        .filter(m => m.role === 'admin')
        .map(m => m.committeeId);
      
      if (adminCommitteeIds.length === 0) {
        return res.json([]);
      }
      
      const allMembers = await storage.getAllMembers();
      const filteredMembers = allMembers.filter(m => adminCommitteeIds.includes(m.committeeId));
      
      res.json(filteredMembers);
    } catch (error) {
      console.error("Error fetching all members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.patch("/api/committee-members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }
      
      const member = await storage.getCommitteeMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      const isAdmin = await isUserAdminOfCommittee(userId, member.committeeId);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can update member roles" });
      }
      
      const updatedMember = await storage.updateCommitteeMember(req.params.id, { role });
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  app.get("/api/attendance-slots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const slots = await storage.getUpcomingSlots(userId);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching upcoming slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post("/api/attendance-slots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const attendances = await storage.getUserAttendances(userId);
      res.json(attendances);
    } catch (error) {
      console.error("Error fetching attendances:", error);
      res.status(500).json({ message: "Failed to fetch attendances" });
    }
  });

  app.post("/api/attendances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.delete("/api/attendances/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  return httpServer;
}
