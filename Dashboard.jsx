import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  LogOut,
  MapPin,
  Plus,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import {
  eventIsPending,
  fetchDashboardData,
  registerForEvent,
  registrationEventId,
  registrationStatus,
  reviewEvent,
  saveOrganizerEvent,
} from "./lib/events.js";
import "./Dashboard.css";

const emptyForm = {
  title: "",
  description: "",
  category: "",
  date: "",
  venue: "",
  capacity: "",
};

function displayDate(date) {
  if (!date) return "Date to be announced";
  const parsed = new Date(String(date).length === 10 ? `${date}T12:00:00` : date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function personName(user, profile) {
  return profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.email || "Campus member";
}

function errorText(error) {
  if (/fetch|network/i.test(error?.message || "")) {
    return "Could not connect to Supabase. Check the project URL, key, and network connection.";
  }
  if (/invalid api key|invalid jwt/i.test(error?.message || "")) {
    return "Supabase rejected the public key. Check that the project URL and publishable key (or legacy anon key) belong to the same project.";
  }
  return error?.message || "The request could not be completed.";
}

function EventForm({ initialValues, busy, onCancel, onSubmit }) {
  const [values, setValues] = useState(initialValues || emptyForm);
  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  return (
    <form className="workspace-form" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
      <div className="workspace-form-heading">
        <div>
          <span className="workspace-eyebrow">{initialValues ? "EDIT SUBMISSION" : "NEW SUBMISSION"}</span>
          <h2>{initialValues ? "Update your event" : "Create a campus event"}</h2>
        </div>
        <button type="button" className="workspace-icon-button" onClick={onCancel} aria-label="Close event form"><X size={18} /></button>
      </div>
      <div className="workspace-fields">
        <label>Event name<input required maxLength={120} value={values.title} onChange={(event) => setField("title", event.target.value)} /></label>
        <label>Category<input required maxLength={60} value={values.category} onChange={(event) => setField("category", event.target.value)} placeholder="Cultural, technical, sports…" /></label>
        <label className="workspace-field-wide">Description<textarea required rows={3} value={values.description} onChange={(event) => setField("description", event.target.value)} /></label>
        <label>Date<input type="date" required value={String(values.date || "").slice(0, 10)} onChange={(event) => setField("date", event.target.value)} /></label>
        <label>Venue<input required maxLength={120} value={values.venue} onChange={(event) => setField("venue", event.target.value)} /></label>
        <label>Capacity<input type="number" min="1" value={values.capacity} onChange={(event) => setField("capacity", event.target.value)} /></label>
      </div>
      <div className="workspace-form-actions">
        <button type="button" className="workspace-secondary-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="workspace-primary-button" disabled={busy}>
          {busy ? <span className="workspace-spinner" /> : <Check size={16} />}
          {busy ? "Saving…" : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}

export default function Dashboard({ role, user, profile, onSignOut }) {
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [registrationResults, setRegistrationResults] = useState({});
  const [busyEvent, setBusyEvent] = useState("");
  const [busySignOut, setBusySignOut] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchDashboardData(role, user.id)
      .then((data) => {
        if (!active) return;
        setEvents(data.events);
        setPendingEvents(data.pendingEvents);
        setRegistrations(data.registrations);
      })
      .catch((error) => {
        if (active) setLoadError(errorText(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [role, user.id, reloadKey]);

  const registeredIds = useMemo(
    () => new Set(registrations.map(registrationEventId).filter(Boolean).map(String)),
    [registrations]
  );

  const name = personName(user, profile);
  const heading = {
    student: "Discover what’s happening.",
    organizer: "Bring your next idea to life.",
    admin: "Keep campus moving.",
  }[role];

  const refresh = () => {
    setLoading(true);
    setLoadError("");
    setActionError("");
    setNotice("");
    setReloadKey((value) => value + 1);
  };

  const handleRegistration = async (event) => {
    if (busyEvent || registeredIds.has(String(event.id))) return;
    setBusyEvent(String(event.id));
    setActionError("");
    setNotice("");
    try {
      const result = await registerForEvent(event.id);
      const rawResponse = result.status || (
        result.data === null || result.data === undefined
          ? "The registration request was accepted by the server."
          : JSON.stringify(result.data)
      );
      setRegistrationResults((current) => ({ ...current, [event.id]: rawResponse }));
      setNotice(`Registration response: ${rawResponse}`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusyEvent("");
    }
  };

  const saveEvent = async (values) => {
    setFormBusy(true);
    setActionError("");
    setNotice("");
    try {
      await saveOrganizerEvent(values, user.id, editingEvent);
      setFormOpen(false);
      setEditingEvent(null);
      setNotice(editingEvent ? "Your event changes were saved." : "Your event was submitted for administrator review.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setFormBusy(false);
    }
  };

  const decideEvent = async (event, decision) => {
    setReviewBusy(String(event.id));
    setActionError("");
    setNotice("");
    try {
      await reviewEvent(event, decision);
      setNotice(`“${event.title}” is now ${decision}.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setReviewBusy("");
    }
  };

  const signOut = async () => {
    setBusySignOut(true);
    setActionError("");
    try {
      await onSignOut();
    } catch (error) {
      setActionError(errorText(error));
      setBusySignOut(false);
    }
  };

  return (
    <main className="workspace">
      <header className="workspace-header">
        <a className="workspace-brand" href="/" aria-label="Festify home">
          <span className="workspace-brand-mark"><Sparkles size={18} /></span>
          festify<span>.</span>
        </a>
        <div className="workspace-account">
          <div className="workspace-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
          <div className="workspace-account-copy"><strong>{name}</strong><span>{role}</span></div>
          <button type="button" className="workspace-signout" onClick={signOut} disabled={busySignOut}>
            <LogOut size={16} /> {busySignOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <section className="workspace-main">
        <div className="workspace-welcome">
          <span className="workspace-eyebrow">{role.toUpperCase()} WORKSPACE</span>
          <h1>{heading}</h1>
          <p>
            {role === "student" && "Find the events that make campus feel like yours."}
            {role === "organizer" && "Create and manage events for your campus community."}
            {role === "admin" && "Review submissions and publish approved campus events."}
          </p>
        </div>

        {(loadError || actionError) && (
          <div className="workspace-alert" role="alert">
            <strong>We couldn’t complete that request</strong><span>{loadError || actionError}</span>
            {loadError && <button type="button" onClick={refresh}>Try again</button>}
          </div>
        )}
        {notice && <div className="workspace-notice" role="status">{notice}</div>}

        {role === "organizer" && (
          <section className="workspace-toolbar">
            <div><h2>Your event submissions</h2><p>New events are sent for administrator approval.</p></div>
            <button type="button" className="workspace-primary-button" onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
              <Plus size={17} /> New event
            </button>
          </section>
        )}
        {role === "student" && (
          <section className="workspace-toolbar">
            <div><h2>Approved campus events</h2><p>Discover what’s happening across your campus.</p></div>
            <span className="workspace-count">{events.length} {events.length === 1 ? "event" : "events"}</span>
          </section>
        )}
        {role === "admin" && (
          <section className="workspace-toolbar">
            <div><h2>Pending submissions</h2><p>Only administrator-authorized updates can approve events.</p></div>
            <span className="workspace-count">{pendingEvents.length} awaiting review</span>
          </section>
        )}

        {formOpen && role === "organizer" && (
          <EventForm
            key={editingEvent?.id || "new"}
            initialValues={editingEvent ? {
              title: editingEvent.title,
              description: editingEvent.description,
              category: editingEvent.category,
              date: editingEvent.date,
              venue: editingEvent.venue,
              capacity: editingEvent.capacity,
            } : null}
            busy={formBusy}
            onCancel={() => { setFormOpen(false); setEditingEvent(null); }}
            onSubmit={saveEvent}
          />
        )}

        {loading ? (
          <div className="workspace-state" role="status"><span className="workspace-spinner" />Loading your campus events…</div>
        ) : !loadError && (role === "admin" ? pendingEvents.length === 0 : events.length === 0) && !(role === "organizer" && formOpen) ? (
          <div className="workspace-empty">
            <span className="workspace-empty-icon"><CalendarDays size={23} /></span>
            <h2>{role === "admin" ? "You’re all caught up." : role === "organizer" ? "Start with your first event." : "Nothing on the calendar just yet."}</h2>
            <p>
              {role === "admin" && "There are no event submissions awaiting review."}
              {role === "organizer" && "Create a campus event and submit it for approval."}
              {role === "student" && "Approved events will appear here as organizers publish them."}
            </p>
            {role === "organizer" && !formOpen && <button className="workspace-primary-button" onClick={() => setFormOpen(true)}><Plus size={17} /> Create an event</button>}
          </div>
        ) : (
          <section className="workspace-events" aria-label={role === "admin" ? "Pending event submissions" : "Campus events"}>
            {(role === "admin" ? pendingEvents : events).map((event) => {
              const response = registrationResults[event.id];
              const existingRegistration = registrations.find((item) => String(registrationEventId(item)) === String(event.id));
              const status = response || registrationStatus(existingRegistration);
              const isRegistered = registeredIds.has(String(event.id)) || Object.hasOwn(registrationResults, event.id);
              const statusLabel = /wait.?list/i.test(String(status || ""))
                ? "Waitlisted"
                : /registered|success|confirmed/i.test(String(status || ""))
                  ? "Registered"
                  : registeredIds.has(String(event.id))
                    ? "Registration recorded"
                    : isRegistered
                      ? "Request submitted"
                      : "Register";
              return (
                <article className="workspace-event-card" key={event.id}>
                  <div className="workspace-event-top">
                    <span className="workspace-event-category">{event.category}</span>
                    <span className={`workspace-status ${String(event.status).toLowerCase()}`}>{event.status || "Submitted"}</span>
                  </div>
                  <h3>{event.title}</h3>
                  {event.description && <p className="workspace-event-description">{event.description}</p>}
                  <div className="workspace-event-details">
                    <span><CalendarDays size={15} />{displayDate(event.date)}</span>
                    {event.time && <span><Clock3 size={15} />{event.time}</span>}
                    <span><MapPin size={15} />{event.venue}</span>
                  </div>
                  {role === "student" && (
                    <div className="workspace-event-action">
                      <button
                        type="button"
                        className="workspace-primary-button"
                        onClick={() => handleRegistration(event)}
                        disabled={busyEvent === String(event.id) || isRegistered}
                      >
                        {busyEvent === String(event.id) ? <span className="workspace-spinner" /> : <Ticket size={16} />}
                        {busyEvent === String(event.id) ? "Registering…" : statusLabel}
                        {!isRegistered && busyEvent !== String(event.id) && <ArrowUpRight size={15} />}
                      </button>
                      {status && <span className="workspace-registration-status">Backend status: {status}</span>}
                    </div>
                  )}
                  {role === "organizer" && userOwnsEvent(event, user.id) && (
                    <div className="workspace-event-action">
                      <span className="workspace-event-note">Submission status: {event.status || "Pending"}</span>
                      <button type="button" className="workspace-secondary-button" onClick={() => { setEditingEvent(event); setFormOpen(true); }}>Edit event</button>
                    </div>
                  )}
                  {role === "admin" && eventIsPending(event) && (
                    <div className="workspace-event-action workspace-review-actions">
                      <button type="button" className="workspace-secondary-button" disabled={reviewBusy === String(event.id)} onClick={() => decideEvent(event, "rejected")}>Reject</button>
                      <button type="button" className="workspace-primary-button" disabled={reviewBusy === String(event.id)} onClick={() => decideEvent(event, "approved")}>
                        {reviewBusy === String(event.id) ? <span className="workspace-spinner" /> : <Check size={16} />}
                        {reviewBusy === String(event.id) ? "Saving…" : "Approve event"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </section>
      <footer className="workspace-footer">FESTIFY <span>·</span> THE OPERATING SYSTEM FOR CAMPUS EVENTS</footer>
    </main>
  );
}

function userOwnsEvent(event, userId) {
  return !event.ownerId || String(event.ownerId) === String(userId);
}
