import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, passwordResetTokens, insertUserSchema, type SelectUser } from "@db/schema";
import { db, pool } from "@db";
import { eq, and, gt, update } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { sendWelcomeEmail } from "./email";
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const PostgresSessionStore = connectPg(session);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).limit(1);
}

export function setupAuth(app: Express) {
  const store = new PostgresSessionStore({ pool, createTableIfMissing: true });
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID!,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        const [user] = await getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      if (!user) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).send(error.toString());
    }

    const [existingUser] = await getUserByEmail(result.data.email);
    if (existingUser) {
      return res.status(400).send("Email already registered");
    }

    const [user] = await db
      .insert(users)
      .values({
        ...result.data,
        password: await hashPassword(result.data.password),
      })
      .returning();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(error => {
      console.error('Failed to send welcome email:', error);
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  app.post("/api/user/complete-profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { name, password } = req.body;
    
    try {
      const hashedPassword = await hashPassword(password);
      
      // Update user with new name and password
      const updatedUsers = await db
        .update(users)
        .set({
          name: name,
          password: hashedPassword
        })
        .where(eq(users.id, req.user.id))
        .returning();

      if (updatedUsers.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update the session with new user data
      req.user.name = name;
      req.user.password = hashedPassword;

      res.json({ success: true, message: "Profile updated successfully" });
    } catch (error) {
      console.error('Profile completion error:', error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
}
