import { Router } from "express";
import {
  listUsers,
  listMentors,
  createUser,
  updateUserMetadata,
  deleteUser,
  getRecommendations,
  getAvailabilityForUser,
  getOverlappingSlots,
  scheduleMeeting,
} from "../controllers/adminController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole("ADMIN"));

adminRoutes.get("/users", listUsers);
adminRoutes.get("/mentors", listMentors);
adminRoutes.post("/create-user", createUser);
adminRoutes.put("/users/:id/metadata", updateUserMetadata);
adminRoutes.delete("/users/:id", deleteUser);
adminRoutes.get("/recommendations", getRecommendations);
adminRoutes.get("/availability/:userId", getAvailabilityForUser);
adminRoutes.get("/availability/:userId/overlap", getOverlappingSlots);
adminRoutes.post("/meetings", scheduleMeeting);
