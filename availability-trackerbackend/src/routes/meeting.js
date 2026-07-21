import { Router } from "express";
import { listMeetings, deleteMeeting, updateMeeting, getNotifications } from "../controllers/meetingController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const meetingRoutes = Router();

meetingRoutes.use(authenticate);
meetingRoutes.get("/", listMeetings);
meetingRoutes.get("/notifications", getNotifications);
meetingRoutes.put("/:id", requireRole("ADMIN"), updateMeeting);
meetingRoutes.delete("/:id", requireRole("ADMIN"), deleteMeeting);

