import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Download,
  LogOut,
  Map,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  Sparkles,
  Star,
  Settings,
  Ticket,
  Trash2,
  Users,
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
import {
  downloadCertificate,
  loadAchievements,
  loadRecommendations,
  makeCheckInQr,
  verifyCheckIn,
} from "./lib/participation.js";
import "./Dashboard.css";

const emptyForm = {
  title: "",
  description: "",
  category: "",
  date: "",
  time: "",
  endTime: "",
  venue: "",
  venueLocation: "",
  capacity: "",
};

function displayDate(date) {
  if (!date) return "Date to be announced";
  const parsed = new Date(String(date).length === 10 ? `${date}T12:00:00` : date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function personName(user, profile) {
  return profile?.full_name || profile?.name || user?.user_metadata?.full_name || "Campus member";
}

function errorText(error) {
  return error?.message || "The request could not be completed.";
}

function reminderStorageKey(userId) {
  return `festify-reminders:${userId}`;
}

function readReminders(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(reminderStorageKey(userId)) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function eventStartDate(event) {
  const date = String(event.date || "").slice(0, 10);
  if (!date) return null;
  const start = new Date(`${date}T${event.time || "09:00"}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function displayReminderDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventForm({ initialValues, busy, onCancel, onSubmit }) {
  const [values, setValues] = useState(initialValues || emptyForm);
  const [mapPreview, setMapPreview] = useState(initialValues?.venueMapUrl || "");
  const [mapError, setMapError] = useState("");
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
        <label>Start time<input type="time" required value={values.time || ""} onChange={(event) => setField("time", event.target.value)} /></label>
        <label>End time<input type="time" required min={values.time || undefined} value={values.endTime || ""} onChange={(event) => setField("endTime", event.target.value)} /></label>
        <label>Venue / room<input required maxLength={120} value={values.venue} onChange={(event) => setField("venue", event.target.value)} placeholder="e.g. Innovation Hub, Room 204" /></label>
        <label className="workspace-field-wide">Venue location / directions<input required maxLength={300} value={values.venueLocation || ""} onChange={(event) => setField("venueLocation", event.target.value)} placeholder="Building, floor, room, campus address, or map link" /></label>
        <label>Capacity<input type="number" min="1" value={values.capacity} onChange={(event) => setField("capacity", event.target.value)} /></label>
        <label className="workspace-field-wide">
          Venue floor plan
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                setMapError("Choose a PNG, JPEG, or WebP image smaller than 5 MB.");
                event.target.value = "";
                return;
              }
              setMapError("");
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result || "");
                if (!url.startsWith("data:image/")) {
                  setMapError("The floor plan could not be read as an image.");
                  return;
                }
                setField("venueMapUrl", url);
                setMapPreview(url);
              };
              reader.onerror = () => setMapError("The floor plan could not be read. Please choose another image.");
              reader.readAsDataURL(file);
            }}
          />
          <span className="workspace-help">Floor plans stay in this browser session. Click the preview to mark the room.</span>
        </label>
        {mapError && <p className="workspace-inline-error workspace-field-wide" role="alert">{mapError}</p>}
        {mapPreview && (
          <div className="workspace-field-wide">
            <span className="workspace-map-label"><Map size={14} /> Room pin · click the map to place it</span>
            <button
              type="button"
              className="workspace-map-picker"
              aria-label="Click to mark the event room on the floor plan"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setField("venueMapPinX", Math.round(((event.clientX - bounds.left) / bounds.width) * 100));
                setField("venueMapPinY", Math.round(((event.clientY - bounds.top) / bounds.height) * 100));
              }}
            >
              <img src={mapPreview} alt="Uploaded venue floor plan preview" />
              <span
                className="workspace-map-pin"
                style={{ left: `${values.venueMapPinX ?? 50}%`, top: `${values.venueMapPinY ?? 50}%` }}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
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

function AttendanceScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const scanCallback = useRef(onScan);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [ticket, setTicket] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  useEffect(() => {
    scanCallback.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!cameraStarted) return undefined;
    let active = true;
    let stream;
    let timer;
    let detecting = false;
    const Detector = window.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return () => {};

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (cameraStream) => {
        if (!active) {
          cameraStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = cameraStream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ["qr_code"] });
        setCameraMessage("Point the camera at the student's check-in QR.");
        timer = window.setInterval(async () => {
          if (!active || detecting || !videoRef.current) return;
          detecting = true;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              window.clearInterval(timer);
              scanCallback.current(codes[0].rawValue);
            }
          } catch {
            setCameraMessage("QR scanning failed. Paste the ticket text below instead.");
            window.clearInterval(timer);
          } finally {
            detecting = false;
          }
        }, 500);
      })
      .catch((error) => {
        if (active) setCameraMessage(error.name === "NotAllowedError"
          ? "Camera permission was denied. Paste the ticket text below instead."
          : "Camera could not be started. Paste the ticket text below instead.");
      });

    return () => {
      active = false;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStarted]);

  const submitTicket = async (event) => {
    event.preventDefault();
    if (!ticket.trim() || scanBusy) return;
    setScanBusy(true);
    try {
      await scanCallback.current(ticket.trim());
    } finally {
      setScanBusy(false);
    }
  };

  const toggleCamera = () => {
    if (cameraStarted) {
      setCameraStarted(false);
      setCameraMessage("");
      return;
    }
    if (!window.BarcodeDetector) {
      setCameraMessage("Automatic QR scanning is not supported in this browser. Paste the ticket text below.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera access is not available here. Paste the ticket text below.");
      return;
    }
    setCameraMessage("Requesting camera access…");
    setCameraStarted(true);
  };

  return (
    <div className="workspace-scanner">
      <div className="workspace-scanner-heading">
        <div><strong>Verify event participation</strong><span>Each student ticket works once and expires after five minutes.</span></div>
        <button type="button" className="workspace-icon-button" onClick={onClose} aria-label="Close QR scanner"><X size={17} /></button>
      </div>
      <button type="button" className="workspace-secondary-button" onClick={toggleCamera}>
        <QrCode size={15} /> {cameraStarted ? "Stop camera" : "Start QR camera"}
      </button>
      {cameraStarted && <video ref={videoRef} className="workspace-scanner-video" muted playsInline aria-label="QR ticket camera" />}
      {cameraMessage && <p className="workspace-help" role="status">{cameraMessage}</p>}
      <form className="workspace-ticket-form" onSubmit={submitTicket}>
        <label htmlFor="manual-checkin-ticket">Or paste the QR ticket text</label>
        <textarea id="manual-checkin-ticket" rows={3} value={ticket} onChange={(event) => setTicket(event.target.value)} />
        <button type="submit" className="workspace-primary-button" disabled={scanBusy || !ticket.trim()}>
          {scanBusy ? <span className="workspace-spinner" /> : <Check size={15} />}
          {scanBusy ? "Verifying…" : "Verify and award 3 stars"}
        </button>
      </form>
    </div>
  );
}

export default function Dashboard({ role, user, profile, onLogOut }) {
  const [events, setEvents] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [pendingEvents, setPendingEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [registrationResults, setRegistrationResults] = useState({});
  const [busyEvent, setBusyEvent] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [scannerEvent, setScannerEvent] = useState(null);
  const [ticketEvent, setTicketEvent] = useState("");
  const [tickets, setTickets] = useState({});
  const [achievements, setAchievements] = useState({ stars: 0, participations: [] });
  const [recommendations, setRecommendations] = useState([]);
  const [studentDataError, setStudentDataError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminders, setReminders] = useState(() => readReminders(user.id));
  const [reminderOffsets, setReminderOffsets] = useState({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const remindersRef = useRef(reminders);
  const saveReminders = useCallback((nextReminders) => {
    try {
      localStorage.setItem(reminderStorageKey(user.id), JSON.stringify(nextReminders));
      remindersRef.current = nextReminders;
      setReminders(nextReminders);
    } catch (error) {
      setActionError(`Your reminders could not be saved in this browser: ${errorText(error)}`);
    }
  }, [user.id]);
  const sidebarItems = {
    student: [
      { href: "#events", label: "Discover events", icon: CalendarDays },
      { href: "#reminders", label: "Reminders", icon: Bell },
      { href: "#recommendations", label: "Smart picks", icon: Sparkles },
      { href: "#rewards", label: "My rewards", icon: Award },
    ],
    organizer: [
      { href: "#events", label: "My events", icon: CalendarDays },
      { href: "#participants", label: "Participants", icon: Users },
    ],
    admin: [
      { href: "#approvals", label: "Event approvals", icon: Check },
    ],
  }[role];

  useEffect(() => {
    if (role !== "student") return undefined;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      const dueReminders = remindersRef.current.filter((item) => !item.notified && item.remindAt <= now);
      if (!dueReminders.length) return;
      for (const reminder of dueReminders) {
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`Upcoming event: ${reminder.title}`, {
              body: `Your event starts ${displayReminderDate(reminder.startsAt)}.`,
            });
          } catch (error) {
            setActionError(`A reminder notification could not be shown: ${errorText(error)}`);
          }
        }
      }
      saveReminders(remindersRef.current.map((item) =>
        dueReminders.some((reminder) => reminder.id === item.id) ? { ...item, notified: true } : item
      ));
      if (!("Notification" in window) || Notification.permission !== "granted") {
        setNotice(`${dueReminders.map((item) => item.title).join(", ")} ${dueReminders.length === 1 ? "is" : "are"} coming up.`);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [role, saveReminders]);

  useEffect(() => {
    let active = true;
    fetchDashboardData(role, user.id)
      .then((data) => {
        if (!active) return;
        setEvents(data.events);
        setParticipantCounts(data.participantCounts || {});
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

  useEffect(() => {
    if (role !== "student") return undefined;
    let active = true;
    Promise.all([loadAchievements(user.id), loadRecommendations(user.id)])
      .then(([nextAchievements, nextRecommendations]) => {
        if (!active) return;
        setAchievements(nextAchievements);
        setRecommendations(nextRecommendations.recommendations || []);
      })
      .catch((error) => {
        if (active) setStudentDataError(errorText(error));
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
      const result = await registerForEvent(event.id, user.id);
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

  const toggleEventReminder = async (event) => {
    setActionError("");
    const existing = reminders.find((item) => String(item.eventId) === String(event.id));
    if (existing) {
      saveReminders(reminders.filter((item) => item.id !== existing.id));
      setNotice(`Reminder removed for “${event.title}”.`);
      return;
    }

    const startsAt = eventStartDate(event);
    const offsetMinutes = Number(reminderOffsets[event.id] || 60);
    const remindAt = startsAt ? startsAt.getTime() - offsetMinutes * 60 * 1000 : NaN;
    if (!startsAt || remindAt <= Date.now()) {
      setActionError("Choose a reminder time before the event starts.");
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        setActionError(`Browser notifications could not be enabled: ${errorText(error)}`);
        return;
      }
    }
    const offsetLabel = offsetMinutes >= 1440
      ? "1 day"
      : offsetMinutes >= 60
        ? `${offsetMinutes / 60} hour${offsetMinutes === 60 ? "" : "s"}`
        : `${offsetMinutes} minutes`;
    const reminder = {
      id: `${event.id}-${Date.now()}`,
      eventId: event.id,
      title: event.title,
      startsAt: startsAt.getTime(),
      remindAt,
      offsetLabel,
      notified: false,
    };
    saveReminders([...reminders.filter((item) => String(item.eventId) !== String(event.id)), reminder]);
    setNotice(`Reminder set for “${event.title}”, ${offsetLabel} before it starts.`);
  };

  const showTicket = async (event) => {
    setTicketEvent(String(event.id));
    setActionError("");
    try {
      const ticket = await makeCheckInQr(event.id, user.id);
      setTickets((current) => ({ ...current, [event.id]: ticket }));
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setTicketEvent("");
    }
  };

  const handleCheckIn = async (event, rawTicket) => {
    setActionError("");
    try {
      const attendance = await verifyCheckIn(rawTicket, event.id, user.id);
      setScannerEvent(null);
      setNotice(`Attendance verified. 3 stars awarded and certificate ${attendance.certificateId} is ready for the student.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorText(error));
    }
  };

  return (
    <main className="workspace">
      <aside className="workspace-sidebar" aria-label="Main navigation">
        <a className="workspace-brand" href="/" aria-label="Festify home">
          <span className="workspace-brand-mark"><Sparkles size={18} /></span>
          festify<span>.</span>
        </a>
        <div className="workspace-sidebar-role">{role} workspace</div>
        <nav className="workspace-sidebar-nav">
          {sidebarItems.map(({ href, label, icon: Icon }) => (
            <a className="workspace-sidebar-link" href={href} key={href}>
              <Icon size={16} /> {label}
            </a>
          ))}
        </nav>
        <div className="workspace-settings">
          <button
            type="button"
            className="workspace-sidebar-link workspace-settings-button"
            aria-expanded={settingsOpen}
            aria-controls="workspace-settings-menu"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings size={16} /> Settings
          </button>
          {settingsOpen && (
            <div className="workspace-settings-menu" id="workspace-settings-menu">
              <span>{name} · {role}</span>
              <button type="button" onClick={onLogOut}><LogOut size={15} /> Log out</button>
            </div>
          )}
        </div>
      </aside>

      <div className="workspace-content">
        <header className="workspace-header">
          <div className="workspace-account">
            <div className="workspace-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
            <div className="workspace-account-copy">
              <strong>{name}</strong>
              <span>{role}</span>
            </div>
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

        {role === "student" && (
          <>
            <section className="workspace-rewards" id="rewards" aria-label="Your participation rewards">
              <div className="workspace-rewards-total">
                <Star size={19} fill="currentColor" />
                <div><strong>{achievements.stars}</strong><span>stars earned</span></div>
              </div>
              <div className="workspace-rewards-copy">
                <Award size={17} />
                <span>Earn 3 stars and a certificate after an organizer verifies your event check-in.</span>
              </div>
              {achievements.participations.length > 0 && (
                <div className="workspace-certificates">
                  <strong>Your certificates</strong>
                  {achievements.participations.map((item) => (
                    <div className="workspace-certificate-row" key={item.certificateId}>
                      <span>{item.title}<small>{displayDate(item.date)} · {item.stars} stars</small></span>
                      <button
                        type="button"
                        className="workspace-secondary-button"
                        onClick={() => downloadCertificate(item, name).catch((error) => setActionError(errorText(error)))}
                      >
                        <Download size={14} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="workspace-reminders" id="reminders" aria-label="Your event reminders">
              <div className="workspace-recommendations-heading">
                <Bell size={17} />
                <div><h2>Your reminders</h2><p>Get a browser notification (if allowed) before an event starts.</p></div>
              </div>
              {reminders.length ? (
                <div className="workspace-reminder-list">
                  {reminders.map((reminder) => {
                    const isDue = reminder.remindAt <= currentTime;
                    return (
                      <div className="workspace-reminder-row" key={reminder.id}>
                        <div>
                          <strong>{reminder.title}</strong>
                          <span className={isDue ? "workspace-reminder-due" : ""}>
                            {isDue ? "Reminder due" : `Reminder ${displayReminderDate(reminder.remindAt)}`}
                            {" · "}Event {displayReminderDate(reminder.startsAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="workspace-secondary-button"
                          onClick={() => saveReminders(reminders.filter((item) => item.id !== reminder.id))}
                          aria-label={`Remove reminder for ${reminder.title}`}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="workspace-help">Choose a reminder on an event card below to get notified before it starts.</p>
              )}
              {!("Notification" in window) && (
                <p className="workspace-help">Browser notifications are unavailable here. Your reminders will still appear in this section when due while Festify is open.</p>
              )}
            </section>
            <section className="workspace-recommendations" id="recommendations">
              <div className="workspace-recommendations-heading">
                <Sparkles size={17} />
                <div><h2>Smart picks for you</h2><p>Personalized from your past participation categories.</p></div>
              </div>
              {studentDataError && <p className="workspace-inline-error" role="alert">{studentDataError}</p>}
              {recommendations.length ? recommendations.map((item) => (
                <div className="workspace-recommendation" key={item.category}>
                  <strong>{item.category}</strong>
                  <span>{item.reason}</span>
                  <div>{item.events.map((event) => <span className="workspace-recommendation-event" key={event.id}>{event.title}</span>)}</div>
                </div>
              )) : <p className="workspace-help">Join an event to build your history and unlock personalized picks.</p>}
            </section>
          </>
        )}

        {role === "organizer" && (
          <section className="workspace-toolbar" id="events">
            <div><h2>Your event submissions</h2><p>New events are sent to the local admin workspace for approval.</p></div>
            <button type="button" className="workspace-primary-button" onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
              <Plus size={17} /> New event
            </button>
          </section>
        )}
        {role === "student" && (
          <section className="workspace-toolbar" id="events">
            <div><h2>Approved campus events</h2><p>Discover what’s happening across your campus.</p></div>
            <span className="workspace-count">{events.length} {events.length === 1 ? "event" : "events"}</span>
          </section>
        )}
        {role === "admin" && (
          <section className="workspace-toolbar" id="approvals">
            <div><h2>Pending submissions</h2><p>Review and approve event submissions.</p></div>
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
              time: editingEvent.time,
              endTime: editingEvent.endTime,
              venue: editingEvent.venue,
              venueLocation: editingEvent.venueLocation,
              capacity: editingEvent.capacity,
              venueMapUrl: editingEvent.venueMapUrl,
              venueMapPinX: editingEvent.venueMapPinX,
              venueMapPinY: editingEvent.venueMapPinY,
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
          <section
            className="workspace-events"
            id={role === "organizer" ? "participants" : undefined}
            aria-label={role === "admin" ? "Pending event submissions" : "Campus events"}
          >
            {(role === "admin" ? pendingEvents : events).map((event) => {
              const response = registrationResults[event.id];
              const existingRegistration = registrations.find((item) => String(registrationEventId(item)) === String(event.id));
              const eventReminder = reminders.find((item) => String(item.eventId) === String(event.id));
              const startsAt = eventStartDate(event);
              const eventAlreadyStarted = !startsAt || startsAt.getTime() <= currentTime;
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
                    {(event.time || event.endTime) && (
                      <span>
                        <Clock3 size={15} />
                        {event.time || "Time to be announced"}{event.endTime ? ` – ${event.endTime}` : ""}
                      </span>
                    )}
                    <span><MapPin size={15} />{event.venue}</span>
                    {event.venueLocation && <span className="workspace-event-location">{event.venueLocation}</span>}
                  </div>
                  {(event.venueMapUrl || event.venueLocation) && (
                    <div className="workspace-event-map">
                      {event.venueMapUrl && (
                        <div className="workspace-map-preview">
                          <img src={event.venueMapUrl} alt={`Floor plan for ${event.venue}`} />
                          <span
                            className="workspace-map-pin"
                            style={{ left: `${event.venueMapPinX ?? 50}%`, top: `${event.venueMapPinY ?? 50}%` }}
                            aria-label="Organizer-marked event room"
                          />
                        </div>
                      )}
                      {event.venueLocation && <p><MapPin size={14} /> Organizer location: <strong>{event.venueLocation}</strong></p>}
                      <a
                        href={/^https?:\/\//i.test(event.venueLocation || "")
                          ? event.venueLocation
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueLocation || event.venue)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation size={14} /> Open venue directions
                      </a>
                    </div>
                  )}
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
                      {status && <span className="workspace-registration-status">Registration status: {status}</span>}
                      <label className="workspace-reminder-select">
                        Remind me
                        <select
                          value={reminderOffsets[event.id] || 60}
                          onChange={(change) => setReminderOffsets((current) => ({ ...current, [event.id]: change.target.value }))}
                          disabled={Boolean(eventReminder) || eventAlreadyStarted}
                        >
                          <option value="1440">1 day before</option>
                          <option value="60">1 hour before</option>
                          <option value="15">15 minutes before</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="workspace-secondary-button"
                        onClick={() => toggleEventReminder(event)}
                        disabled={eventAlreadyStarted && !eventReminder}
                      >
                        <Bell size={15} /> {eventReminder ? "Remove reminder" : "Set reminder"}
                      </button>
                      {isRegistered && (
                        <>
                          <button
                            type="button"
                            className="workspace-secondary-button"
                            onClick={() => showTicket(event)}
                            disabled={ticketEvent === String(event.id)}
                          >
                            {ticketEvent === String(event.id) ? <span className="workspace-spinner" /> : <QrCode size={15} />}
                            {ticketEvent === String(event.id) ? "Preparing QR…" : "Show check-in QR"}
                          </button>
                          {tickets[event.id] && (
                            <div className="workspace-ticket">
                              <img src={tickets[event.id].image} alt={`Single-use attendance QR for ${event.title}`} />
                              <p>Show this one-time code to the organizer at the event. Expires in five minutes.</p>
                              <textarea readOnly value={tickets[event.id].ticket} aria-label="Manual check-in ticket text" />
                              <button
                                type="button"
                                className="workspace-secondary-button"
                                onClick={() => {
                                  if (!navigator.clipboard?.writeText) {
                                    setActionError("Clipboard access is unavailable. Select and copy the ticket text above.");
                                    return;
                                  }
                                  navigator.clipboard.writeText(tickets[event.id].ticket)
                                    .then(() => setNotice("Check-in ticket copied. Switch to the Organizer workspace and paste it into the scanner."))
                                    .catch(() => setActionError("Could not copy the ticket. Select and copy the text above instead."));
                                }}
                              >
                                Copy manual check-in text
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {role === "organizer" && userOwnsEvent(event, user.id) && (
                    <div className="workspace-event-action">
                      <span className="workspace-event-note">Submission status: {event.status || "Pending"}</span>
                      <span
                        className="workspace-participant-count"
                        aria-label={`${participantCounts[event.id] || 0} ${participantCounts[event.id] === 1 ? "student" : "students"} registered`}
                      >
                        <Users size={15} />
                        {participantCounts[event.id] || 0} {participantCounts[event.id] === 1 ? "student" : "students"} registered
                        {event.capacity && ` · capacity ${event.capacity}`}
                      </span>
                      <button type="button" className="workspace-secondary-button" onClick={() => { setEditingEvent(event); setFormOpen(true); }}>Edit event</button>
                      {["approved", "published"].includes(String(event.status).toLowerCase()) && (
                        <button type="button" className="workspace-secondary-button" onClick={() => setScannerEvent(event)}>
                          <QrCode size={15} /> Scan attendance
                        </button>
                      )}
                      {scannerEvent?.id === event.id && (
                        <AttendanceScanner onScan={(ticket) => handleCheckIn(event, ticket)} onClose={() => setScannerEvent(null)} />
                      )}
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
      </div>
    </main>
  );
}

function userOwnsEvent(event, userId) {
  return !event.ownerId || String(event.ownerId) === String(userId);
}
