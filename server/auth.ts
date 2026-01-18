import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { users, registerSchema, loginSchema } from "@shared/models/auth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

const PgSession = connectPgSimple(session);

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
      isSuperAdmin: boolean;
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

async function countUsers(): Promise<number> {
  const result = await db.select().from(users);
  return result.length;
}

async function createUser(email: string, password: string, firstName: string, lastName: string) {
  const passwordHash = await hashPassword(password);
  const userCount = await countUsers();
  const isSuperAdmin = userCount === 0;
  
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    isSuperAdmin,
  }).returning();
  return user;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "committee-secret-key",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "sessions",
    }),
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await findUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Correo o contraseña incorrectos" });
          }
          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Correo o contraseña incorrectos" });
          }
          return done(null, {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            isSuperAdmin: user.isSuperAdmin,
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await findUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isSuperAdmin: user.isSuperAdmin,
      });
    } catch (error) {
      done(error);
    }
  });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { email, password, firstName, lastName, committeeId, inviteToken } = result.data;

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este correo ya está registrado" });
      }

      // Handle invite token registration
      if (inviteToken) {
        const invite = await storage.getTeamInviteByToken(inviteToken);
        if (!invite) {
          return res.status(400).json({ message: "Invitación no encontrada" });
        }
        if (invite.status !== "pending") {
          return res.status(400).json({ message: "Esta invitación ya ha sido usada o cancelada" });
        }
        if (new Date(invite.expiresAt) < new Date()) {
          return res.status(400).json({ message: "Esta invitación ha expirado" });
        }
        if (invite.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ message: "El correo electrónico no coincide con la invitación" });
        }

        // Get the team to find the committee
        const team = await storage.getCounselorTeam(invite.teamId);
        if (!team) {
          return res.status(400).json({ message: "El equipo ya no existe" });
        }

        // Create user
        const user = await createUser(email, password, firstName, lastName);

        // Add user to the committee as a member
        await storage.createCommitteeMember({
          committeeId: team.committeeId,
          userId: user.id,
          isAdmin: false,
          leadershipRole: "none",
          isActive: true,
        });

        // Add user to the team
        await storage.createCounselorTeamMember({
          teamId: invite.teamId,
          userId: user.id,
          role: invite.role as "counselor" | "auxiliary",
        });

        // Mark invite as accepted
        await storage.updateTeamInviteStatus(invite.id, "accepted");

        req.login(
          {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            isSuperAdmin: user.isSuperAdmin,
          },
          (err) => {
            if (err) {
              return next(err);
            }
            res.json({
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              isSuperAdmin: user.isSuperAdmin,
            });
          }
        );
        return;
      }

      // Normal registration flow
      if (!committeeId) {
        return res.status(400).json({ message: "Debes seleccionar un comité" });
      }

      const committee = await storage.getCommittee(committeeId);
      if (!committee) {
        return res.status(400).json({ message: "El comité seleccionado no existe" });
      }

      const user = await createUser(email, password, firstName, lastName);

      await storage.createCommitteeMember({
        committeeId,
        userId: user.id,
        isAdmin: false,
        leadershipRole: "none",
        isActive: true,
      });

      req.login(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isSuperAdmin: user.isSuperAdmin,
        },
        (err) => {
          if (err) {
            return next(err);
          }
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isSuperAdmin: user.isSuperAdmin,
          });
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error al registrar usuario" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.errors[0].message });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciales inválidas" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperAdmin: user.isSuperAdmin,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Sesión cerrada" });
      });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    res.json(req.user);
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "No autorizado" });
};
