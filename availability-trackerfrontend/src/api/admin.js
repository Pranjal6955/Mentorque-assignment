import { get, post } from "./client.js";

export async function listUsers() {
  return get("/api/admin/users");
}

export async function listMentors() {
  return get("/api/admin/mentors");
}

export async function createUser(data) {
  return post("/api/admin/create-user", data);
}

export async function getAvailabilityForUser(userId, weekStart) {
  const q = weekStart ? `?weekStart=${weekStart}` : "";
  return get(`/api/admin/availability/${userId}${q}`);
}

export async function getOverlappingSlots(userId, startTime, endTime) {
  const q = new URLSearchParams({ startTime, endTime }).toString();
  return get(`/api/admin/availability/${userId}/overlap?${q}`);
}

export async function scheduleMeeting(data) {
  return post("/api/admin/meetings", data);
}
