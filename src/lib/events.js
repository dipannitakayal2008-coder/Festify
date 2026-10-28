import {
  getDemoDashboardData,
  registerDemoForEvent,
  reviewDemoEvent,
  saveDemoEvent,
} from "./demoData.js";

const field = (row, names, fallback = "") => {
  for (const name of names) {
    if (row?.[name] !== undefined && row[name] !== null) return row[name];
  }
  return fallback;
};

export function normalizeEvent(row) {
  return {
    id: field(row, ["id", "event_id"]),
    title: field(row, ["title", "name", "event_name"], "Untitled event"),
    description: field(row, ["description", "details", "summary"]),
    category: field(row, ["category", "event_category", "type"], "Campus"),
    date: field(row, ["event_date", "date", "start_date"]),
    time: field(row, ["time", "event_time", "start_time"]),
    venue: field(row, ["venue", "venue_name", "location"], "Venue to be announced"),
    capacity: field(row, ["capacity", "max_participants"]),
    status: field(row, ["status", "approval_status"]),
    ownerId: field(row, ["organizer_id", "created_by", "user_id", "owner_id"]),
    venueMapUrl: field(row, ["venueMapUrl", "venue_map_url"]),
    venueMapPinX: Number(field(row, ["venueMapPinX", "venue_map_pin_x"], 50)),
    venueMapPinY: Number(field(row, ["venueMapPinY", "venue_map_pin_y"], 50)),
    raw: row,
  };
}

export async function fetchDashboardData(role, userId) {
  return getDemoDashboardData(role, userId);
}

export async function registerForEvent(eventId, userId) {
  return registerDemoForEvent(eventId, userId);
}

export async function saveOrganizerEvent(values, userId, existingEvent = null) {
  return normalizeEvent(saveDemoEvent(values, userId, existingEvent));
}

export async function reviewEvent(event, decision) {
  return normalizeEvent(reviewDemoEvent(event, decision));
}

export function registrationEventId(row) {
  return field(row, ["event_id", "eventId", "p_event_id"]);
}

export function registrationStatus(row) {
  return field(row, ["status", "registration_status", "waitlist_status", "state"]);
}

export function eventIsPending(event) {
  return ["pending", "submitted", "in_review"].includes(String(event.status).toLowerCase());
}
