import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message } from "./server/models/Message";
import { Request } from "./server/models/Request";
import { User } from "./server/models/User";
import { Notification } from "./server/models/Notification";
import { createNotification } from "./server/lib/notifications";
import { checkExpirations } from "./server/lib/expiryChecker";
import { adminAuth as firebaseAdminAuth } from "./server/lib/firebaseAdmin";
import userRoutes from "./server/routes/users";
import itemRoutes from "./server/routes/items";
import requestRoutes from "./server/routes/requests";
import messageRoutes from "./server/routes/messages";
import reviewRoutes from "./server/routes/reviews";
import reportRoutes from "./server/routes/reports";
import notificationRoutes from "./server/routes/notifications";
import escrowRoutes from "./server/routes/escrow";
import adminRoutes from "./server/routes/admin";
import trustRoutes from "./server/routes/trust";

dotenv.config();

export const dbStatus = {
  lastError: null as string | null
};

async function startServer() {
  const app = express();
  
  // Enable Gzip compression
  app.use(compression());
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'] // Allow both for better local performance
  });

  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Early API identification and header setting
  app.use((req, res, next) => {
    if (isApiRequest(req)) {
      res.setHeader('Content-Type', 'application/json');
    }
    next();
  });

  // Attach io to res.locals to make it accessible in routes
  app.use((req, res, next) => {
    (res as any).locals.io = io;
    next();
  });

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // MongoDB Connection Robustness
  const MONGODB_URI = process.env.MONGODB_URI?.trim().replace(/^["']|["']$/g, '');
  
  mongoose.set('bufferCommands', false);
  
  const connectWithRetry = async (retryCount = 0) => {
    if (!MONGODB_URI) {
      console.warn("⚠️ MONGODB_URI is not defined. Database access is disabled. Please check your environment configuration.");
      return;
    }

    try {
      const sanitizedUri = MONGODB_URI.includes('://') 
        ? MONGODB_URI.replace(/:([^@]+)@/, ':****@')
        : 'Invalid URI format';
      
      console.log(`[DB INIT] Attempting connection to: ${sanitizedUri} (Attempt ${retryCount + 1})`);
      
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 10000,
      });
      console.log("✅ Successfully connected to MongoDB");
      dbStatus.lastError = null;
    } catch (err: any) {
      const isAuthError = err.message.toLowerCase().includes('auth') || 
                         err.message.toLowerCase().includes('password') ||
                         err.name === 'MongoServerError' && err.code === 18;
      
      if (isAuthError) {
        console.error("❌ MongoDB Authentication Failed: Credentials in MONGODB_URI are incorrect.");
        console.warn("💡 SECURITY CHECK: Ensure your password matches exactly. If it contains special characters (e.g., @, #, $, %), you MUST URL-encode them (e.g., use %40 for @, %23 for #).");
        console.warn("💡 ALTAS CHECK: Verify that your database user has the necessary roles (e.g., readWriteAnyDatabase or specific collection permissions).");
      } else {
        console.error("❌ MongoDB connection error:", err.message);
        if (err.name) console.error(`   Error Name: ${err.name}`);
        if (err.code) console.error(`   Error Code: ${err.code}`);
      }

      dbStatus.lastError = err.message;
      
      if (!isAuthError && retryCount < 50) {
        console.log(`[DB] Scheduling reconnection attempt in 5s...`);
        setTimeout(() => connectWithRetry(retryCount + 1), 5000);
      }
    }
  };

  // Start connection process without blocking server startup
  connectWithRetry().then(() => {
    // Initial check on startup
    if (mongoose.connection.readyState === 1) {
      setTimeout(() => checkExpirations(io), 5000); // Give IO a moment to settle
    }
  });

  // Schedule periodic checks every 12 hours
  setInterval(() => {
    if (mongoose.connection.readyState === 1) {
      checkExpirations(io);
    }
  }, 12 * 60 * 60 * 1000);

  // Helper to determine if a request is for the API
  const isApiRequest = (req: express.Request) => {
    const rawUrl = (req.originalUrl || req.url || "").toLowerCase();
    const url = rawUrl.split('?')[0]; // Ignore query params
    const path = req.path.toLowerCase();
    
    return url.startsWith('/api') || 
           url.includes('/api/') || 
           path.startsWith('/api') ||
           path.includes('/api/');
  };

  const apiRouter = express.Router();

  // Health check in API router - allowed even if DB is down
  apiRouter.get("/health", (req, res) => {
    console.log("[Health Check] Request received. DB State:", mongoose.connection.readyState);
    
    let isAuthError = false;
    if (dbStatus.lastError) {
      isAuthError = dbStatus.lastError.toLowerCase().includes('auth') || 
                    dbStatus.lastError.toLowerCase().includes('password') ||
                    dbStatus.lastError.includes('code 18');
    }

    res.json({ 
      status: "ok", 
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState,
      error: dbStatus.lastError,
      isAuthError
    });
  });

  // API Status Check Middleware
  apiRouter.use(async (req, res, next) => {
    // Force JSON content type for all API responses
    res.setHeader('Content-Type', 'application/json');
    
    // Log API responses for debugging
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode >= 400) {
        console.warn(`[API Response] ${res.statusCode} ${req.method} ${req.originalUrl || req.url}:`, 
          typeof body === 'object' ? JSON.stringify(body).substring(0, 500) : body);
      }
      return originalJson.call(this, body);
    };

    if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
      if (req.method !== 'GET') {
        console.warn(`[API ACCESS] 503 - DB State ${mongoose.connection.readyState}: ${req.method} ${req.originalUrl || req.url}`);
        return res.status(503).json({ 
          error: "Service Unavailable", 
          message: "The platform is currently in read-only mode due to community synchronization. Writing data is temporarily disabled.",
          status: "maintenance",
          readyState: mongoose.connection.readyState
        });
      }
    } else if (mongoose.connection.readyState === 2) {
      // If it's connecting, maybe wait a tiny bit before rejecting a write
      if (req.method !== 'GET') {
        console.log(`[API ACCESS] DB is connecting, waiting briefly for ${req.method} ${req.url}`);
        let waitAttempts = 0;
        while (mongoose.connection.readyState === 2 && waitAttempts < 5) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          waitAttempts++;
        }
        
        if ((mongoose.connection.readyState as any) !== 1) {
          return res.status(503).json({ 
            error: "Establishing Connection", 
            message: "The local node is currently establishing a neural link to the grid. Please stand by.",
            status: "connecting",
            readyState: mongoose.connection.readyState
          });
        }
      }
    }
    next();
  });

  // Register individual API routers
  apiRouter.use("/users", userRoutes);
  apiRouter.use("/items", itemRoutes);
  apiRouter.use("/requests", requestRoutes);
  apiRouter.use("/messages", messageRoutes);
  apiRouter.use("/reviews", reviewRoutes);
  apiRouter.use("/reports", reportRoutes);
  apiRouter.use("/notifications", notificationRoutes);
  apiRouter.use("/escrow", escrowRoutes);
  apiRouter.use("/admin", adminRoutes);
  apiRouter.use("/trust", trustRoutes);

  // Catch-all for unknown /api routes
  apiRouter.all("*", (req, res) => {
    console.warn(`[API] 404 - Unmatched route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: `API Route ${req.method} ${req.originalUrl} not found`,
      path: req.originalUrl,
      method: req.method
    });
  });

  // Mount the API router
  app.use("/api", apiRouter);

  // Connection monitoring
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB runtime error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB successfully reconnected');
  });

  // Socket.io for Chat
  io.use(async (socket, next) => {
    try {
    // Socket connection rejected: Database not connected check removed for better demo resilience
    /*
    if (mongoose.connection.readyState !== 1) {
      console.warn("Socket connection rejected: Database not connected");
      return next(new Error("Database unavailable"));
    }
    */

      const token = socket.handshake.auth.token;
      if (!token) {
        console.warn("Socket connection attempt rejected: No token");
        return next(new Error("Authentication error: Token missing"));
      }

      const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
      console.log(`Socket auth verified for: ${decodedToken.email}`);
      
      let user = null;
      if (mongoose.connection.readyState === 1) {
        try {
          user = await User.findOne({ firebaseUid: decodedToken.uid }).maxTimeMS(2000);
          if (!user) {
            user = await User.findOne({ email: decodedToken.email }).maxTimeMS(2000);
          }
        } catch (dbErr) {
          console.warn("[Socket Auth] User lookup failed, using token identity", (dbErr as any).message);
        }
      }

      // If no user record found (DB down or missing), use token data for basic identification
      (socket as any).user = {
        userId: user ? user._id.toString() : decodedToken.uid, // Fallback to UID if no Mongo ID
        firebaseUid: decodedToken.uid,
        isAdmin: user?.isAdmin || false,
        email: decodedToken.email,
        isTemporary: !user
      };
      next();
    } catch (err) {
      console.error("Socket Verification Error:", err);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: any) => {
    console.log(`Node connected: ${socket.user.userId}`);
    
    // Join personal room for notifications
    socket.join(`user_${socket.user.firebaseUid}`);
    
    socket.on("join_room", async (requestId: string) => {
      try {
        const request = await Request.findById(requestId);
        if (!request) return;

        // Ensure user is part of the request
        if (request.requester.toString() !== socket.user.userId && 
            request.owner.toString() !== socket.user.userId) {
          return;
        }

        socket.join(requestId);
        console.log(`User ${socket.user.userId} joined room ${requestId}`);
      } catch (err) {
        console.error("Join room error:", err);
      }
    });

    socket.on("send_message", async (data: { requestId: string, text: string }) => {
      try {
        const { requestId, text } = data;
        const request = await Request.findById(requestId);
        
        if (!request) return;

        // Ensure user is part of the request and it is not rejected
        if ((request.requester.toString() !== socket.user.userId && request.owner.toString() !== socket.user.userId) ||
            request.status === 'rejected') {
          return;
        }

        const message = new Message({
          request: requestId,
          sender: socket.user.userId,
          text
        });

        await message.save();
        const requestPopulated = await Request.findById(requestId).populate('item');
        const populatedMessage = await message.populate('sender', 'name avatar');
        
        io.to(requestId).emit("receive_message", populatedMessage);

        // Notify the other party if they aren't in this room
        const recipientId = request.requester.toString() === socket.user.userId 
          ? request.owner.toString() 
          : request.requester.toString();

        await createNotification(io, {
          recipient: recipientId,
          sender: socket.user.userId,
          type: 'new_message',
          title: 'New Message',
          message: `You have a new message regarding ${(requestPopulated?.item as any)?.title || 'your request'}.`,
          link: `/messages?id=${requestId}`,
          relatedId: requestId
        });
      } catch (err) {
        console.error("Send message error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.user?.userId);
    });
  });

  // Vite/SPA fallback handling
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "custom",
    });
    
    // Only use vite middleware for non-API requests
    app.use((req, res, next) => {
      if (isApiRequest(req)) {
        return next();
      }
      vite.middlewares(req, res, next);
    });

    app.use(async (req, res, next) => {
      if (isApiRequest(req)) {
        console.warn(`[VITE FALLBACK WARNING] API request reached SPA fallback: ${req.method} ${req.originalUrl || req.url}`);
        return next();
      }
      
      const url = req.originalUrl || req.url;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Serve index.html for all other non-API requests
    app.get('*', (req, res, next) => {
      if (isApiRequest(req)) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler - MOVED TO BOTTOM
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    
    // For API requests, ensure we return JSON
    if (isApiRequest(req)) {
      res.setHeader('Content-Type', 'application/json');
      
      // Handle Mongoose CastError (e.g., invalid ObjectId)
      if (err.name === 'CastError') {
        return res.status(400).json({
          error: "Invalid Parameter",
          message: `The value provided for ${err.path} is not valid.`,
          details: process.env.NODE_ENV !== 'production' ? err.message : undefined
        });
      }

      // Handle Mongoose Validation Error
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          error: "Validation Error",
          message: "The data provided does not meet the requirements.",
          details: Object.values(err.errors).map((e: any) => e.message)
        });
      }

      return res.status(err.status || 500).json({ 
        error: "Internal Server Error", 
        message: err.message,
        path: req.originalUrl
      });
    }
    
    // For other requests, use default Express error handler
    next(err);
  });

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
