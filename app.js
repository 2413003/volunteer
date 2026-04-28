(() => {
  "use strict";

  const STORAGE = {
    monthlyGoal: "mk_chess_volunteer_hub_monthly_goal_v1",
    volunteerPurpose: "mk_chess_volunteer_hub_volunteer_purpose_v1"
  };

  // Set your live Supabase project details here before deploying the app.
  const APP_CONFIG = {
    supabaseUrl: "https://pfgvnbhvihleugpijjvr.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3ZuYmh2aWhsZXVncGlqanZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTU2ODcsImV4cCI6MjA4OTA5MTY4N30.xF-lTjR3z2tcjMjIv0am3cLYOBs3gHD3p7yq3FbDqcs",
    allowedEmailDomain: ""
  };

  const CHECK_IN_WINDOW_HOURS = 6;
  const CHECK_IN_GRACE_MINUTES = 30;
  const LEAFLET_VERSION = "1.9.4";
  const SESSION_VENUES = {
    learn: {
      key: "learn",
      titleSuggestion: "Learn Chess",
      shortLabel: "Unity Place",
      location: "Unity Place, MK9 1UP",
      description: "Beginners coaching. Small groups and 1:1 teaching.",
      url: "https://mkchess.co.uk/#unity-place",
      imageUrl: "https://mkchess.co.uk/assets/images/image80.jpg?v=a0f4c5bf",
      color: "#3C3489",
      bg: "#EEEDFE",
      dot: "#3C3489",
      lat: 52.0363588,
      lng: -0.7722635,
      aliases: ["learn chess", "unity place", "beginners"],
      recurrence: "last_friday",
      startHour: 18,
      startMinute: 0,
      roleBrief: "Welcome beginners, set up teaching boards, and support coaching tables.",
      arrivalNote: "Arrive 20 minutes early at Unity Place",
      backupPlan: "If delayed, message the session coordinator immediately",
      activityTitles: ["Set up teaching boards", "Welcome beginners", "Support coaching tables"]
    },
    bletchley: {
      key: "bletchley",
      titleSuggestion: "Play Chess Bletchley",
      shortLabel: "Bletchley",
      location: "South Central IOT, Bletchley MK3 6DR",
      description: "Casual play for all ages and abilities.",
      url: "https://mkchess.co.uk/#bletchley",
      imageUrl: "https://mkchess.co.uk/assets/images/image78.jpg?v=a0f4c5bf",
      color: "#0F6E56",
      bg: "#E1F5EE",
      dot: "#0F6E56",
      lat: 51.9950372,
      lng: -0.738573,
      aliases: ["bletchley", "south central iot"],
      recurrence: "first_wednesday",
      startHour: 18,
      startMinute: 0,
      roleBrief: "Welcome players, set up boards, and keep casual pairings moving.",
      arrivalNote: "Arrive 20 minutes early at Bletchley",
      backupPlan: "If delayed, message the session coordinator immediately",
      activityTitles: ["Set up boards", "Welcome players", "Support pairings"]
    },
    badminton: {
      key: "badminton",
      titleSuggestion: "Play Chess Badminton Centre",
      shortLabel: "Badminton Centre",
      location: "National Badminton Centre, MK8 9LA",
      description: "Casual play for all ages and abilities.",
      url: "https://mkchess.co.uk/#nextevent",
      imageUrl: "https://mkchess.co.uk/assets/images/image79.jpg?v=a0f4c5bf",
      color: "#993C1D",
      bg: "#FAECE7",
      dot: "#993C1D",
      lat: 52.0378731,
      lng: -0.7848841,
      aliases: ["badminton", "national badminton", "mk8"],
      recurrence: "second_thursday",
      startHour: 18,
      startMinute: 0,
      roleBrief: "Welcome players, set up boards, and support pairings through the session.",
      arrivalNote: "Arrive 20 minutes early at the Badminton Centre",
      backupPlan: "If delayed, message the session coordinator immediately",
      activityTitles: ["Set up boards", "Welcome players", "Support pairings"]
    },
    sunday: {
      key: "sunday",
      titleSuggestion: "Adults at Willen Lake",
      shortLabel: "Willen Lake",
      location: "Willen Lake Cafe, MK15 0DS",
      description: "Relaxed adults session overlooking the lake.",
      url: "https://mkchess.co.uk/#willen-lake",
      imageUrl: "https://mkchess.co.uk/assets/images/image07.jpg?v=8bcf13e8",
      color: "#92400E",
      bg: "#FEF3E2",
      dot: "#B45309",
      lat: 52.0517737,
      lng: -0.7209626,
      aliases: ["adults", "willen", "sunday"],
      recurrence: "all_sundays_from_start",
      startHour: 10,
      startMinute: 0,
      startDate: "2026-04-19",
      roleBrief: "Welcome adult players, set up boards, and support relaxed social play.",
      arrivalNote: "Arrive 15 minutes early at Willen Lake",
      backupPlan: "If delayed, message the session coordinator immediately",
      activityTitles: ["Set up boards", "Welcome adult players", "Support social play"]
    }
  };

  const state = {
    supabase: null,
    authSubscription: null,
    user: null,
    profile: null,
    volunteers: [],
    sessions: [],
    assignments: [],
    sessionActivities: [],
    commitments: [],
    attendance: [],
    feedback: [],
    sessionPulses: [],
    supportRequests: [],
    activitySuggestions: [],
    activitySuggestionVotes: [],
    metricsRows: [],
    metricsByVolunteer: {},
    selectedVolunteerId: null,
    selectedSessionId: null,
    attendanceSessionId: null,
    loading: false,
    syncInFlight: false,
    syncRequested: false,
    scheduleSeedInFlight: false,
    monthlyGoal: 2,
    volunteerPurpose: "community",
    sessionBrowserView: "calendar",
    sessionBrowserYear: new Date().getFullYear(),
    sessionBrowserMonth: new Date().getMonth(),
    sessionMapInstance: null,
    sessionMapMarkers: [],
    sessionMapReady: false,
    sessionMapError: ""
  };

  const el = {};
  let backendStatusClearTimer = null;
  let leafletLoadPromise = null;
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheEls();
    bindEvents();
    restoreSettings();
    renderAll();
    try {
      await connectSupabase();
      await refreshSession();
      await ensureAccountProvisioned();
      await loadProfile();
      await loadAllData();
      await ensureClubScheduleSeeded();
      attachAuthSubscription();
    } catch (error) {
      setBackendStatus(errorText(error, "App init failed"), "err");
      state.loading = false;
    }
    renderAll();
  }

  function cacheEls() {
    [
      "emailInput", "sendLinkBtn", "signOutBtn", "startSetupBtn", "addVolunteerBtn", "addSessionBtn",
      "authStatus", "backendStatus", "commandBoard", "sessionExplorer", "searchInput", "volunteerList", "volunteerDetail", "studioPanel", "directorySplit",
      "volunteerDialog", "volunteerForm", "volunteerNameInput", "volunteerTaglineInput", "volunteerBioInput", "volunteerStatus", "createVolunteerBtn",
      "sessionDialog", "sessionForm", "sessionTitleInput", "sessionVenueKeyInput", "sessionVenueHint", "sessionStartsInput", "sessionRequiredInput", "sessionRoleBriefInput", "sessionActivitiesInput", "sessionSuggestedActivities", "sessionArrivalNoteInput", "sessionBackupPlanInput", "sessionAssignAllInput", "sessionStatus", "createSessionBtn",
      "feedbackDialog", "feedbackForm", "feedbackVolunteerIdInput", "feedbackSessionSelect", "feedbackRatingInput", "feedbackTypeSelect", "feedbackNoteInput", "feedbackStatus", "submitFeedbackBtn",
      "reportDialog", "reportForm", "reportVolunteerIdInput", "reportSessionSelect", "reportReasonSelect", "reportDetailsInput", "reportStatus", "submitReportBtn",
      "attendanceDialog", "attendanceTitle", "attendanceRows", "attendanceForm", "attendanceStatus", "saveAttendanceBtn",
      "editVolunteerDialog", "editVolunteerForm", "editVolunteerIdInput", "editVolunteerNameInput", "editVolunteerTaglineInput", "editVolunteerBioInput", "editVolunteerStatus", "saveVolunteerProfileBtn",
      "activitySuggestionDialog", "activitySuggestionForm", "activitySuggestionTitleInput", "activitySuggestionDetailsInput", "activitySuggestionStatus", "suggestActivityBtn",
      "pulseDialog", "pulseForm", "pulseSessionSelect", "pulseClarityInput", "pulseSupportInput", "pulseStressInput", "pulseNoteInput", "pulseStatus", "submitPulseBtn",
      "supportDialog", "supportForm", "supportSessionSelect", "supportTypeSelect", "supportUrgencySelect", "supportDetailsInput", "supportStatus", "submitSupportBtn"
    ].forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    el.sendLinkBtn.addEventListener("click", onSendLink);
    el.signOutBtn.addEventListener("click", onSignOut);
    el.startSetupBtn.addEventListener("click", onStartSetup);
    el.addVolunteerBtn.addEventListener("click", openVolunteerDialog);
    el.addSessionBtn.addEventListener("click", openSessionDialog);
    el.searchInput.addEventListener("input", renderVolunteerList);

    el.commandBoard.addEventListener("click", onActionClick);
    el.sessionExplorer.addEventListener("click", onActionClick);
    el.volunteerDetail.addEventListener("click", onActionClick);
    el.studioPanel.addEventListener("click", onActionClick);
    el.volunteerList.addEventListener("click", onActionClick);
    el.volunteerList.addEventListener("click", onVolunteerListClick);
    if (el.sessionDialog) el.sessionDialog.addEventListener("click", onActionClick);

    el.volunteerForm.addEventListener("submit", onCreateVolunteer);
    el.sessionForm.addEventListener("submit", onCreateSession);
    el.feedbackForm.addEventListener("submit", onSubmitFeedback);
    el.reportForm.addEventListener("submit", onSubmitReport);
    el.attendanceForm.addEventListener("submit", onSubmitAttendance);
    el.editVolunteerForm.addEventListener("submit", onSaveVolunteerProfile);
    el.activitySuggestionForm.addEventListener("submit", onSubmitActivitySuggestion);
    el.pulseForm.addEventListener("submit", onSubmitPulse);
    el.supportForm.addEventListener("submit", onSubmitSupportRequest);
    if (el.pulseSessionSelect) el.pulseSessionSelect.addEventListener("change", onPulseSessionChanged);
    if (el.sessionVenueKeyInput) el.sessionVenueKeyInput.addEventListener("change", onSessionVenuePresetChange);
    window.addEventListener("resize", () => {
      if (state.sessionMapInstance && typeof state.sessionMapInstance.invalidateSize === "function") {
        state.sessionMapInstance.invalidateSize();
      }
    });

    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close]");
      if (!close) return;
      const dialogId = close.getAttribute("data-close");
      if (dialogId && el[dialogId] && typeof el[dialogId].close === "function") el[dialogId].close();
    });
  }

  function restoreSettings() {
    const savedGoal = safeGet(STORAGE.monthlyGoal);
    const savedPurpose = safeGet(STORAGE.volunteerPurpose);
    state.monthlyGoal = [1, 2, 4].includes(Number(savedGoal)) ? Number(savedGoal) : 2;
    state.volunteerPurpose = ["community", "coaching", "skills", "social"].includes(String(savedPurpose || ""))
      ? String(savedPurpose)
      : "community";

    if (!savedGoal) safeSet(STORAGE.monthlyGoal, "2");
    if (!savedPurpose) safeSet(STORAGE.volunteerPurpose, "community");
    safeRemove("mk_ops_monthly_goal_v1");
    safeRemove("mk_ops_volunteer_purpose_v1");
    safeRemove("mk_ops_url");
    safeRemove("mk_ops_key");
    safeRemove("mk_ops_domain");
    safeRemove("mk_ops_preview_mode_v2");
    safeRemove("mk_ops_preview_data_v2");
    safeRemove("mk_ops_simple_view_v3");
  }

  async function connectSupabase() {
    const url = String(APP_CONFIG.supabaseUrl || "").trim();
    const key = String(APP_CONFIG.supabaseAnonKey || "").trim();

    if (!url || !key) {
      state.supabase = null;
      setBackendStatus(missingBackendMessage(), "err");
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      state.supabase = null;
      setBackendStatus("Supabase library failed to load.", "err");
      return;
    }

    try {
      state.supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: "mk_chess_volunteer_hub_auth_v1"
        }
      });
      setBackendStatus("Backend connected.", "ok");
    } catch (error) {
      state.supabase = null;
      setBackendStatus(errorText(error, "Backend connection failed"), "err");
    }
  }

  function attachAuthSubscription() {
    if (!state.supabase) return;
    detachAuthSubscription();
    state.authSubscription = state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.user = session ? session.user : null;
      await syncFromAuth();
    });
  }

  function detachAuthSubscription() {
    if (state.authSubscription && state.authSubscription.data && state.authSubscription.data.subscription) {
      state.authSubscription.data.subscription.unsubscribe();
    }
    state.authSubscription = null;
  }

  async function refreshSession() {
    if (!state.supabase) {
      state.user = null;
      state.profile = null;
      return;
    }

    let data = null;
    let error = null;
    try {
      const response = await state.supabase.auth.getSession();
      data = response.data;
      error = response.error;
    } catch (caught) {
      error = caught;
    }
    if (error) {
      state.user = null;
      state.profile = null;
      const text = errorText(error, "Session check failed");
      if (!isAuthLockError(text)) setBackendStatus(text, "err");
      return;
    }
    state.user = data && data.session ? data.session.user : null;
  }

  async function syncFromAuth() {
    if (state.syncInFlight) {
      state.syncRequested = true;
      return;
    }
    state.syncInFlight = true;
    try {
      await ensureAccountProvisioned();
      await loadProfile();
      await loadAllData();
      await ensureClubScheduleSeeded();
    } catch (error) {
      const text = errorText(error, "Sync failed");
      if (isAuthLockError(text)) setBackendStatus("Sync delayed. Close duplicate tabs, then refresh.", "warn");
      else setBackendStatus(text, "err");
      state.loading = false;
    } finally {
      state.syncInFlight = false;
      renderAll();
      if (state.syncRequested) {
        state.syncRequested = false;
        await syncFromAuth();
      }
    }
  }

  async function ensureAccountProvisioned() {
    if (!state.user || !state.supabase) return;
    const suggestedName = String(state.user.email || "member").split("@")[0];
    const response = await rpc("mkchess_volunteer_hub_bootstrap_admin_setup", { p_display_name: suggestedName }, 20000);
    if (response.error && looksLikeMissingSetup(response.error.message || response.error)) {
      setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
    }
  }

  async function loadProfile() {
    if (!state.user || !state.supabase) {
      state.profile = null;
      return;
    }

    let response = null;
    try {
      response = await state.supabase
        .from("mkchess_volunteer_hub_profiles")
        .select("user_id,email,display_name,role,status,volunteer_id,created_at")
        .eq("user_id", state.user.id)
        .maybeSingle();
    } catch (error) {
      const text = errorText(error, "Profile load failed");
      if (isAuthLockError(text)) {
        state.profile = {
          user_id: state.user.id,
          email: state.user.email || "",
          display_name: state.user.email || "Member",
          role: "member",
          status: "pending",
          volunteer_id: null
        };
        return;
      }
      throw error;
    }

    if (response.error) {
      const message = errorText(response.error, "Unknown error");
      if (isAuthLockError(message)) {
        state.profile = {
          user_id: state.user.id,
          email: state.user.email || "",
          display_name: state.user.email || "Member",
          role: "member",
          status: "pending",
          volunteer_id: null
        };
        return;
      }
      if (looksLikeMissingSetup(response.error.message || response.error)) {
        setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
      } else if (isFetchFailure(message)) {
        setBackendStatus(unreachableBackendMessage(), "err");
      } else {
        setBackendStatus("Profile could not load right now. Refresh to retry.", "warn");
      }
      state.profile = {
        user_id: state.user.id,
        email: state.user.email || "",
        display_name: state.user.email || "Member",
        role: "member",
        status: "pending",
        volunteer_id: null
      };
      return;
    }

    state.profile = response.data || {
      user_id: state.user.id,
      email: state.user.email || "",
      display_name: state.user.email || "Member",
      role: "member",
      status: "pending",
      volunteer_id: null
    };
  }

  async function loadAllData() {
    if (!state.supabase) {
      state.volunteers = [];
      state.sessions = [];
      state.assignments = [];
      state.sessionActivities = [];
      state.commitments = [];
      state.attendance = [];
      state.feedback = [];
      state.sessionPulses = [];
      state.supportRequests = [];
      state.activitySuggestions = [];
      state.activitySuggestionVotes = [];
      state.metricsRows = [];
      state.metricsByVolunteer = {};
      return;
    }

    state.loading = true;
    renderAll();

    try {
      const sessionsPromise = state.supabase.from("mkchess_volunteer_hub_sessions")
        .select("*")
        .order("starts_at", { ascending: true });
      const [
        volunteersResponse,
        sessionsResponse,
        assignmentsResponse,
        sessionActivitiesResponse,
        commitmentsResponse,
        attendanceResponse,
        feedbackResponse,
        pulsesResponse,
        supportResponse,
        activitySuggestionsResponse,
        activitySuggestionVotesResponse,
        metricsResponse
      ] = await Promise.all([
        state.supabase.from("mkchess_volunteer_hub_volunteers")
          .select("id,owner_user_id,display_name,tagline,bio,active,created_at")
          .eq("active", true)
          .order("display_name", { ascending: true }),
        sessionsPromise,
        state.supabase.from("mkchess_volunteer_hub_session_assignments")
          .select("session_id,volunteer_id"),
        state.supabase.from("mkchess_volunteer_hub_session_activities")
          .select("id,session_id,title,details,sort_order,claimed_by_volunteer_id,claimed_at,created_by_user_id,created_at,updated_at")
          .order("session_id", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        state.supabase.from("mkchess_volunteer_hub_commitments")
          .select("session_id,volunteer_id,status,note,plan_leave_at,last_check_in_at,updated_at"),
        state.supabase.from("mkchess_volunteer_hub_attendance")
          .select("session_id,volunteer_id,outcome,note,marked_at"),
        state.supabase.from("mkchess_volunteer_hub_feedback")
          .select("id,session_id,volunteer_id,reviewer_user_id,rating,feedback_type,note,created_at")
          .order("created_at", { ascending: false })
          .limit(900),
        state.supabase.from("mkchess_volunteer_hub_session_pulses")
          .select("id,session_id,volunteer_id,clarity_rating,support_rating,stress_rating,note,created_by_user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(1200),
        state.supabase.from("mkchess_volunteer_hub_support_requests")
          .select("id,volunteer_id,session_id,request_type,urgency,details,status,resolution_note,created_by_user_id,resolved_by_user_id,created_at,resolved_at")
          .order("created_at", { ascending: false })
          .limit(1200),
        state.supabase.from("mkchess_volunteer_hub_activity_suggestions")
          .select("id,title,details,suggested_by_user_id,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(500),
        state.supabase.from("mkchess_volunteer_hub_activity_suggestion_votes")
          .select("suggestion_id,voter_user_id,created_at")
          .limit(5000),
        state.supabase.from("mkchess_volunteer_hub_volunteer_metrics")
          .select("*")
      ]);

      const errors = [
        volunteersResponse.error,
        sessionsResponse.error,
        assignmentsResponse.error,
        sessionActivitiesResponse.error,
        commitmentsResponse.error,
        attendanceResponse.error,
        feedbackResponse.error,
        pulsesResponse.error,
        supportResponse.error,
        activitySuggestionsResponse.error,
        activitySuggestionVotesResponse.error,
        metricsResponse.error
      ].filter(Boolean);

      if (errors.length) {
        const firstMessage = errorText(errors[0], "Data load failed");
        if (looksLikeMissingSetup(firstMessage)) {
          setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
        } else if (isFetchFailure(firstMessage)) {
          setBackendStatus(unreachableBackendMessage(), "err");
        } else {
          setBackendStatus("Data load issue: " + firstMessage, "err");
        }
      }

      state.volunteers = volunteersResponse.error ? [] : (volunteersResponse.data || []);
      state.sessions = sessionsResponse.error ? [] : normalizeSessionRows(sessionsResponse.data || []);
      state.assignments = assignmentsResponse.error ? [] : (assignmentsResponse.data || []);
      state.sessionActivities = sessionActivitiesResponse.error ? [] : (sessionActivitiesResponse.data || []);
      state.commitments = commitmentsResponse.error ? [] : (commitmentsResponse.data || []);
      state.attendance = attendanceResponse.error ? [] : (attendanceResponse.data || []);
      state.feedback = feedbackResponse.error ? [] : (feedbackResponse.data || []);
      state.sessionPulses = pulsesResponse.error ? [] : (pulsesResponse.data || []);
      state.supportRequests = supportResponse.error ? [] : (supportResponse.data || []);
      state.activitySuggestions = activitySuggestionsResponse.error ? [] : (activitySuggestionsResponse.data || []);
      state.activitySuggestionVotes = activitySuggestionVotesResponse.error ? [] : (activitySuggestionVotesResponse.data || []);
      state.metricsRows = metricsResponse.error ? [] : (metricsResponse.data || []);
      const derivedRows = computeDerivedMetricsRows();
      if (!state.metricsRows.length) {
        state.metricsRows = derivedRows;
      } else {
        const derivedByVolunteer = {};
        derivedRows.forEach((row) => { derivedByVolunteer[String(row.volunteer_id)] = row; });
        state.metricsRows = state.metricsRows.map((row) => {
          const derived = derivedByVolunteer[String(row.volunteer_id)];
          if (!derived) return row;
          return {
            ...row,
            pulse_count: derived.pulse_count,
            avg_clarity: derived.avg_clarity,
            avg_support: derived.avg_support,
            avg_stress: derived.avg_stress,
            open_support_count: derived.open_support_count,
            at_risk: Boolean(row.at_risk) || Boolean(derived.at_risk)
          };
        });
      }

      state.metricsByVolunteer = {};
      state.metricsRows.forEach((row) => {
        state.metricsByVolunteer[String(row.volunteer_id)] = row;
      });

      if (state.profile && state.profile.volunteer_id) {
        const mine = String(state.profile.volunteer_id);
        if (state.volunteers.some((v) => String(v.id) === mine)) state.selectedVolunteerId = mine;
      }
      if (!state.selectedVolunteerId || !state.volunteers.some((v) => String(v.id) === String(state.selectedVolunteerId))) {
        state.selectedVolunteerId = state.volunteers.length ? String(state.volunteers[0].id) : null;
      }
    } catch (error) {
      const text = errorText(error, "Data load failed");
      if (isAuthLockError(text)) {
        setBackendStatus("Sync delayed. Close duplicate tabs, then refresh.", "warn");
      } else if (isFetchFailure(text)) {
        setBackendStatus(unreachableBackendMessage(), "err");
      } else {
        setBackendStatus("Data load issue: " + text, "err");
      }
    } finally {
      state.loading = false;
    }
  }

  function renderAll() {
    renderHeader();
    renderLayout();
    renderCommandBoard();
    renderSessionExplorer();
    renderVolunteerList();
    renderVolunteerDetail();
    renderStudio();
  }

  function renderLayout() {
    if (el.directorySplit) {
      el.directorySplit.style.display = "grid";
    }
    if (el.studioPanel) {
      el.studioPanel.style.display = "grid";
    }
  }

  function renderHeader() {
    const signedIn = Boolean(state.user);
    const admin = isAdmin();
    const canManage = admin;

    el.sendLinkBtn.style.display = signedIn ? "none" : "";
    el.signOutBtn.style.display = signedIn ? "" : "none";
    el.emailInput.style.display = "";
    el.emailInput.disabled = signedIn;
    el.startSetupBtn.style.display = (signedIn && !admin) ? "" : "none";
    el.addVolunteerBtn.style.display = canManage ? "" : "none";
    el.addSessionBtn.style.display = canManage ? "" : "none";

    el.emailInput.placeholder = "member@yourdomain.com";
    if (signedIn) el.emailInput.value = state.user.email || "";
    else el.emailInput.value = "";

    if (!signedIn) {
      clearStatus(el.authStatus);
      return;
    }
    if (admin) {
      setStatus(el.authStatus, "Admin mode", "ok");
      return;
    }

    const role = state.profile ? String(state.profile.role || "member") : "member";
    const status = state.profile ? String(state.profile.status || "pending") : "pending";
    if (status === "approved") {
      setStatus(el.authStatus, role === "volunteer" ? "Volunteer mode" : "Signed in", "ok");
    } else {
      setStatus(el.authStatus, "Pending approval", "warn");
    }
  }
  function renderCommandBoard() {
    if (state.loading) {
      el.commandBoard.innerHTML = '<div class="empty">Loading overview...</div>';
      return;
    }

    const upcoming = upcomingSessions().slice(0, 8);
    const coverageRows = upcoming.map(sessionCoverageRow);
    const reminderRows = buildReminderQueue(coverageRows);
    const requiredTotal = coverageRows.reduce((sum, row) => sum + row.required, 0);
    const committedTotal = coverageRows.reduce((sum, row) => sum + row.committed, 0);
    const assignedTotal = coverageRows.reduce((sum, row) => sum + row.assigned, 0);
    const claimedActivities = coverageRows.reduce((sum, row) => sum + row.claimedActivityCount, 0);
    const totalActivities = coverageRows.reduce((sum, row) => sum + row.activityCount, 0);
    const coveragePct = requiredTotal ? Math.round((committedTotal / requiredTotal) * 100) : 0;
    const openSupportRequests = state.supportRequests
      .filter((row) => String(row.status || "open") === "open")
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const canSuggestActivity = Boolean(state.user) && isApprovedMember();
    const activityIdeasHtml = renderActivitySuggestionsHtml({ variant: "default", limit: 5 });

    const coverageHtml = coverageRows.length
      ? coverageRows.map((row) => {
        const badge = row.gap > 0 ? '<span class="warnpill">Need ' + row.gap + '</span>' : '<span class="okpill">Covered</span>';
        const canMark = isAdmin() && new Date(row.starts_at).getTime() <= Date.now() + 3600000;
        const nudgeButton = row.pendingIds.length
          ? '<button type="button" class="mini ghost" data-action="nudge-session" data-session-id="' + esc(row.id) + '" data-stage="Reminder">Nudge pending</button>'
          : '';
        const attendanceButton = canMark
          ? '<button type="button" class="mini ghost" data-action="open-attendance" data-session-id="' + esc(row.id) + '">Mark attendance</button>'
          : '';
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.title) + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(row.starts_at)) + '</p>',
          '<p class="muted">' + row.committed + '/' + row.required + ' committed • ' + row.claimedActivityCount + '/' + row.activityCount + ' activities claimed</p>',
          '<div class="inline-actions">' + nudgeButton + attendanceButton + '</div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No upcoming sessions yet.</div>';

    const remindersHtml = reminderRows.length
      ? reminderRows.map((row) => {
        const names = row.pendingIds.map((id) => volunteerNameById(id)).filter(Boolean).join(', ');
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.title) + '</p><span class="pill">' + esc(row.stageLabel) + '</span></div>',
          '<p class="muted">' + esc(formatDateTime(row.starts_at)) + '</p>',
          '<p class="muted">Waiting on: ' + esc(names || 'none') + '</p>',
          '<div class="inline-actions"><button type="button" class="mini ghost" data-action="nudge-session" data-session-id="' + esc(row.id) + '" data-stage="' + esc(row.stageLabel) + '">Copy reminder</button></div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No reminders are due right now.</div>';

    const supportHtml = openSupportRequests.length
      ? openSupportRequests.slice(0, 5).map((row) => {
        const volunteer = state.volunteers.find((vol) => String(vol.id) === String(row.volunteer_id));
        const session = row.session_id ? sessionById(row.session_id) : null;
        const resolveBtn = isAdmin()
          ? '<button type="button" class="mini ghost" data-action="resolve-support" data-support-id="' + esc(row.id) + '">Resolve</button>'
          : '';
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(volunteer ? volunteer.display_name : "Volunteer") + '</p><span class="pill">' + esc(row.urgency || "normal") + '</span></div>',
          session ? '<p class="muted">' + esc(session.title || "Session") + " • " + esc(formatDateTime(session.starts_at)) + '</p>' : '',
          '<p>' + esc(trimText(row.details || "", 140)) + '</p>',
          resolveBtn ? '<div class="inline-actions">' + resolveBtn + '</div>' : '',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No open support requests.</div>';

    const emptyActions = isAdmin()
      ? '<div class="inline-actions"><button type="button" class="mini" data-action="open-volunteer-dialog">Add volunteer</button><button type="button" class="mini ghost" data-action="open-session-dialog">Add session</button></div>'
      : '<p class="muted">Sign in after the backend is configured in code.</p>';

    el.commandBoard.innerHTML = [
      '<section class="metric-grid">',
      metricBox("Upcoming sessions", String(upcoming.length)),
      metricBox("Coverage", String(coveragePct) + "%"),
      metricBox("Claimed activities", totalActivities ? (claimedActivities + "/" + totalActivities) : "0"),
      metricBox("Open support", String(openSupportRequests.length)),
      '</section>',
      !state.volunteers.length ? '<div class="empty">No volunteers yet.' + emptyActions + '</div>' : '',
      '<section class="grid2">',
      '<div class="card"><h3>Upcoming Sessions</h3><div class="rows">' + coverageHtml + '</div></div>',
      '<div class="card"><h3>Activity Ideas</h3><div class="rows">' + activityIdeasHtml + '</div>' + (canSuggestActivity ? '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-activity-suggestion-dialog">Suggest activity</button></div>' : '') + '</div>',
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Pending Confirmations</h3><div class="rows">' + remindersHtml + '</div></div>',
      '<div class="card"><h3>Support Requests</h3><div class="rows">' + supportHtml + '</div></div>',
      '</section>'
    ].filter(Boolean).join('');
  }

  function renderSessionExplorer() {
    renderSessionVenueOptions();
    if (!el.sessionExplorer) return;
    const sessions = state.sessions
      .filter((session) => String(session.status || "scheduled") !== "cancelled")
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

    if (state.loading) {
      destroySessionMap();
      el.sessionExplorer.innerHTML = '<div class="empty">Loading sessions...</div>';
      return;
    }

    if (!sessions.length) {
      state.selectedSessionId = null;
    } else if (!state.selectedSessionId || !sessions.some((session) => String(session.id) === String(state.selectedSessionId))) {
      const fallback = upcomingSessions()[0] || sessions[0];
      state.selectedSessionId = String(fallback.id);
      state.sessionBrowserYear = new Date(fallback.starts_at).getFullYear();
      state.sessionBrowserMonth = new Date(fallback.starts_at).getMonth();
    }

    const selected = state.selectedSessionId ? (sessionById(state.selectedSessionId) || sessions[0] || null) : null;
    const browserHtml = state.sessionBrowserView === "map"
      ? renderSessionMapShellHtml()
      : renderSessionCalendarHtml(sessions);

    el.sessionExplorer.innerHTML = [
      '<section class="session-explorer">',
      '<div class="session-browser">',
      '<div class="session-browser-head">',
      '<div><h3>Session Explorer</h3><p class="session-browser-sub">Click a live session to see activities, ownership, and the volunteer profiles behind it.</p></div>',
      '<div class="toggle-pills">',
      '<button type="button" class="toggle-pill' + (state.sessionBrowserView === "calendar" ? ' active' : '') + '" data-action="set-session-browser-view" data-view="calendar">Calendar</button>',
      '<button type="button" class="toggle-pill' + (state.sessionBrowserView === "map" ? ' active' : '') + '" data-action="set-session-browser-view" data-view="map">Map</button>',
      '</div>',
      '</div>',
      browserHtml,
      '</div>',
      '<div class="session-detail">' + renderSelectedSessionDetail(selected) + '</div>',
      '</section>'
    ].join("");

    if (state.sessionBrowserView === "map") queueSessionMapRender();
    else destroySessionMap();
  }

  function renderSessionVenueOptions() {
    if (!el.sessionVenueKeyInput) return;
    const current = String(el.sessionVenueKeyInput.value || "");
    const options = ['<option value="">Custom / no map preset</option>']
      .concat(Object.values(SESSION_VENUES).map((venue) =>
        '<option value="' + esc(venue.key) + '">' + esc(venue.titleSuggestion + " • " + venue.shortLabel) + '</option>'
      ));
    el.sessionVenueKeyInput.innerHTML = options.join("");
    if (current && SESSION_VENUES[current]) el.sessionVenueKeyInput.value = current;
    updateSessionVenueHint();
  }

  function onSessionVenuePresetChange() {
    const preset = SESSION_VENUES[String(el.sessionVenueKeyInput && el.sessionVenueKeyInput.value || "")] || null;
    updateSessionVenueHint();
    if (!preset) return;

    const knownTitles = Object.values(SESSION_VENUES).map((row) => row.titleSuggestion);
    const currentTitle = String(el.sessionTitleInput && el.sessionTitleInput.value || "").trim();
    if (!currentTitle || knownTitles.includes(currentTitle)) {
      el.sessionTitleInput.value = preset.titleSuggestion;
    }
    if (!String(el.sessionArrivalNoteInput && el.sessionArrivalNoteInput.value || "").trim()) {
      el.sessionArrivalNoteInput.value = "Arrive 20 minutes early at " + preset.shortLabel;
    }
  }

  function updateSessionVenueHint() {
    if (!el.sessionVenueHint) return;
    const preset = SESSION_VENUES[String(el.sessionVenueKeyInput && el.sessionVenueKeyInput.value || "")] || null;
    el.sessionVenueHint.textContent = preset
      ? (preset.location + " • " + preset.description)
      : "Choose one of the real club venues to place this session in the calendar and map explorer.";
  }

  function renderSessionCalendarHtml(sessions) {
    const year = Number(state.sessionBrowserYear);
    const month = Number(state.sessionBrowserMonth);
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - ((firstOfMonth.getDay() + 6) % 7));
    const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byDay = {};
    sessions.forEach((session) => {
      const key = localDateKey(session.starts_at);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(session);
    });

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const key = localDateKey(day);
      const cellSessions = (byDay[key] || []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      const otherMonth = day.getMonth() !== month;
      const today = localDateKey(new Date()) === key;
      const chipsHtml = cellSessions.length
        ? '<div class="calendar-events">' + cellSessions.map((session) => {
          const venue = sessionVenuePreset(session);
          return [
            '<button type="button" class="calendar-chip' + (String(session.id) === String(state.selectedSessionId) ? ' active' : '') + '"',
            ' data-action="select-session" data-session-id="' + esc(session.id) + '" data-sync-month="0"',
            venue ? ' style="--chip-bg:' + esc(venue.bg) + ';--chip-color:' + esc(venue.color) + ';"' : '',
            '>',
            '<span class="calendar-chip-title">' + esc(session.title || "Session") + '</span>',
            '<span class="calendar-chip-meta">' + esc(formatTime(session.starts_at) + " • " + sessionVenueShortLabel(session)) + '</span>',
            '</button>'
          ].join("");
        }).join("") + '</div>'
        : '<div class="calendar-empty"></div>';

      cells.push(
        '<article class="calendar-cell' + (otherMonth ? ' other-month' : '') + (today ? ' today' : '') + '">' +
        '<div class="calendar-date">' + day.getDate() + '</div>' +
        chipsHtml +
        '</article>'
      );
    }

    return [
      '<div class="calendar-shell">',
      '<div class="session-calendar-head">',
      '<button type="button" class="ghost mini" data-action="shift-session-month" data-month-delta="-1">Prev</button>',
      '<button type="button" class="ghost mini" data-action="session-month-today">Today</button>',
      '<div class="session-calendar-title">' + esc(monthLabel) + '</div>',
      '<button type="button" class="ghost mini" data-action="shift-session-month" data-month-delta="1">Next</button>',
      '</div>',
      '<div class="calendar-heads">' + dayLabels.map((label) => '<div class="calendar-head">' + label + '</div>').join("") + '</div>',
      '<div class="calendar-grid">' + cells.join("") + '</div>',
      '</div>'
    ].join("");
  }

  function renderSessionMapShellHtml() {
    const visible = visibleSessionsForCurrentMonth().filter((session) => sessionVenueHasMap(session));
    const legend = visible.length
      ? '<div class="session-map-legend">' + visible.map((session) => {
        const venue = sessionVenuePreset(session);
        return '<span class="session-map-pill" style="border-color:' + esc(venue ? venue.color : "#d8d0c2") + ';color:' + esc(venue ? venue.color : "#5b5145") + ';">' + esc((session.title || "Session") + " • " + formatDate(session.starts_at)) + '</span>';
      }).join("") + '</div>'
      : '<p class="soft-note">No mapped sessions for this month yet. Use a venue preset when creating sessions to place them here.</p>';

    return [
      '<div class="session-map">',
      '<div class="session-calendar-head">',
      '<button type="button" class="ghost mini" data-action="shift-session-month" data-month-delta="-1">Prev</button>',
      '<button type="button" class="ghost mini" data-action="session-month-today">Today</button>',
      '<div class="session-calendar-title">' + esc(new Date(state.sessionBrowserYear, state.sessionBrowserMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })) + '</div>',
      '<button type="button" class="ghost mini" data-action="shift-session-month" data-month-delta="1">Next</button>',
      '</div>',
      '<div id="sessionMapCanvas" class="session-map-canvas"><div class="session-map-empty">Loading map...</div></div>',
      legend,
      '</div>'
    ].join("");
  }

  function renderSelectedSessionDetail(session) {
    if (!session) {
      const action = isAdmin()
        ? '<div class="inline-actions"><button type="button" class="mini" data-action="open-session-dialog">Add your first session</button></div>'
        : "";
      return '<div class="empty">The calendar and map stay visible here even before sessions are added. Add a real session to start assigning volunteers and claiming activities.' + action + '</div>';
    }

    const actorVolunteerId = myVolunteerId();
    const venue = sessionVenuePreset(session);
    const assignedIds = assignedVolunteerIds(session.id);
    const row = sessionCoverageRow(session);
    const activities = sessionActivitiesForSession(session.id);
    const claimedCount = activities.filter((activity) => activity.claimed_by_volunteer_id).length;
    const sessionStillOpen = new Date(session.starts_at).getTime() >= (Date.now() - 7200000);
    const myCommitment = actorVolunteerId && assignedIds.includes(String(actorVolunteerId))
      ? commitmentFor(actorVolunteerId, session.id)
      : null;
    const myStatus = myCommitment ? String(myCommitment.status || "") : "";
    const canCheckIn = sessionStillOpen && myStatus === "committed" && withinCheckInWindow(session.starts_at);
    const canTakeShift = sessionStillOpen && actorVolunteerId && !assignedIds.includes(String(actorVolunteerId));
    const attendanceButton = isAdmin() && new Date(session.starts_at).getTime() <= Date.now() + 3600000
      ? '<button type="button" class="mini ghost" data-action="open-attendance" data-session-id="' + esc(session.id) + '">Mark attendance</button>'
      : "";
    const takeShiftButton = canTakeShift
      ? '<button type="button" class="mini ghost" data-action="take-open-shift" data-session-id="' + esc(session.id) + '">Take this shift</button>'
      : "";
    const commitmentButtons = sessionStillOpen && actorVolunteerId && assignedIds.includes(String(actorVolunteerId))
      ? [
        '<button type="button" class="mini' + (myStatus === "committed" ? "" : " ghost") + '" data-action="set-commitment" data-session-id="' + esc(session.id) + '" data-status="committed">I can make it</button>',
        '<button type="button" class="mini' + (myStatus === "unavailable" ? "" : " ghost") + '" data-action="set-commitment" data-session-id="' + esc(session.id) + '" data-status="unavailable">Can\'t make it</button>',
        canCheckIn ? '<button type="button" class="mini ghost" data-action="check-in-session" data-session-id="' + esc(session.id) + '">I\'m on my way</button>' : ""
      ].join("")
      : "";
    const roleLine = [session.role_brief || "", session.arrival_note || "", session.backup_plan || ""].filter(Boolean);
    const rosterHtml = renderSessionRosterHtml(session);
    const historyHtml = renderSessionVolunteerHistoryHtml(session);
    const activitiesHtml = renderSessionActivitiesHtml(session.id, {
      actorVolunteerId,
      showClaimActions: Boolean(actorVolunteerId),
      emptyText: "No activities added yet."
    });

    return [
      '<div class="session-detail-top">',
      '<div class="session-detail-title-wrap">',
      '<h3 class="session-detail-title">' + esc(session.title || "Session") + '</h3>',
      '<div class="session-detail-meta"><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span>' + (venue ? '<span class="pill">' + esc(venue.shortLabel) + '</span>' : "") + '</div>',
      '<p class="session-detail-sub">' + esc(venue ? venue.location : "No mapped venue preset yet.") + '</p>',
      '</div>',
      '<div class="inline-actions">' + takeShiftButton + commitmentButtons + attendanceButton + '</div>',
      '</div>',
      '<section class="summary-grid">' +
      summaryCard("Coverage", row.committed + "/" + row.required, row.pendingIds.length ? (row.pendingIds.length + " still need to reply") : "Everyone has responded") +
      summaryCard("Activities", activities.length ? (claimedCount + "/" + activities.length) : "0", activities.length ? (claimedCount === activities.length ? "All responsibilities claimed" : "Some activities still open") : "No activities added yet") +
      summaryCard("Assigned", String(assignedIds.length), assignedIds.length ? "Volunteers linked to this session" : "No one assigned yet") +
      summaryCard("Impact", String(sessionImpactEstimate(session)), "Estimated member touchpoints supported") +
      '</section>',
      '<section class="session-detail-panels">',
      '<div class="session-venue-card"><h3>Session Brief</h3>' +
      (venue && venue.url ? '<p class="soft-note"><a href="' + esc(venue.url) + '" target="_blank" rel="noreferrer">Venue page</a></p>' : '') +
      roleLine.map((line) => '<p class="soft-note">' + esc(line) + '</p>').join("") +
      (!roleLine.length ? '<p class="soft-note">Add role clarity, arrival notes, or a backup plan when you create the session.</p>' : '') +
      '</div>',
      '<div class="card"><h3>Activities</h3><div class="rows">' + activitiesHtml + '</div></div>',
      '<div class="card"><h3>Volunteer Roster</h3><div class="session-roster">' + rosterHtml + '</div></div>',
      '<div class="card"><h3>Past History</h3><div class="session-history-list">' + historyHtml + '</div></div>',
      '</section>'
    ].join("");
  }

  function renderSessionRosterHtml(session) {
    const volunteerIds = assignedVolunteerIds(session.id);
    if (!volunteerIds.length) return '<div class="empty">No volunteers assigned yet.</div>';
    const activities = sessionActivitiesForSession(session.id);

    return volunteerIds
      .map((volunteerId) => {
        const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
        const metric = metricFor(volunteerId);
        const commitment = commitmentFor(volunteerId, session.id);
        const status = commitment ? String(commitment.status || "") : "";
        const badge = status === "committed"
          ? '<span class="okpill">Committed</span>'
          : status === "unavailable"
            ? '<span class="warnpill">Unavailable</span>'
            : '<span class="pill">No response</span>';
        const claimed = activities.filter((activity) => String(activity.claimed_by_volunteer_id || "") === String(volunteerId));
        const claimedLine = claimed.length ? ("Claiming: " + claimed.map((activity) => activity.title).join(", ")) : "No activities claimed yet";
        return {
          sortKey: status === "committed" ? 0 : status === "unavailable" ? 2 : 1,
          html: [
            '<article class="session-roster-item">',
            '<div class="session-roster-top"><div class="session-roster-main"><p class="session-roster-name">' + esc(volunteer ? volunteer.display_name : "Volunteer") + '</p><p class="session-roster-summary">' + esc(claimedLine) + '</p></div>' + badge + '</div>',
            '<p class="soft-note">Reliability ' + Math.round(Number(metric.reliability_score || 0)) + ' • attendance ' + Number(metric.attendance_rate_pct || 0) + '% • ' + countPositiveAttendance(volunteerId) + ' past sessions completed</p>',
            '<div class="inline-actions"><button type="button" class="mini ghost" data-action="select-volunteer" data-volunteer-id="' + esc(volunteerId) + '">View profile</button></div>',
            '</article>'
          ].join("")
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((row) => row.html)
      .join("");
  }

  function renderSessionVolunteerHistoryHtml(session) {
    const volunteerIds = assignedVolunteerIds(session.id);
    if (!volunteerIds.length) return '<div class="empty">No volunteer history yet.</div>';
    const rows = volunteerIds.map((volunteerId) => {
      const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
      const pastCount = pastSessionsForVolunteer(volunteerId).length;
      const feedbackCount = feedbackForVolunteer(volunteerId).length;
      const streak = showUpStreak(volunteerId);
      const milestone = volunteerMilestone(countPositiveAttendance(volunteerId));
      return [
        '<article class="session-history-item">',
        '<div class="session-history-top"><p class="session-roster-name">' + esc(volunteer ? volunteer.display_name : "Volunteer") + '</p><span class="pill">' + esc(milestone.currentLabel) + '</span></div>',
        '<p class="soft-note">' + esc(pastCount + " past sessions • " + feedbackCount + " feedback notes • streak " + streak) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="select-volunteer" data-volunteer-id="' + esc(volunteerId) + '">Open full history</button></div>',
        '</article>'
      ].join("");
    });
    return rows.join("");
  }

  function onSelectSession(sessionId, syncMonth) {
    const session = sessionById(sessionId);
    if (!session) return;
    state.selectedSessionId = String(session.id);
    if (syncMonth) {
      state.sessionBrowserYear = new Date(session.starts_at).getFullYear();
      state.sessionBrowserMonth = new Date(session.starts_at).getMonth();
    }
    renderSessionExplorer();
  }

  function onSetSessionBrowserView(view) {
    const mode = String(view || "");
    if (!["calendar", "map"].includes(mode)) return;
    state.sessionBrowserView = mode;
    renderSessionExplorer();
  }

  function onShiftSessionMonth(deltaRaw) {
    const delta = Number(deltaRaw || 0);
    if (!delta) return;
    const next = new Date(state.sessionBrowserYear, state.sessionBrowserMonth + delta, 1);
    state.sessionBrowserYear = next.getFullYear();
    state.sessionBrowserMonth = next.getMonth();
    renderSessionExplorer();
  }

  function onJumpSessionMonthToday() {
    const now = new Date();
    state.sessionBrowserYear = now.getFullYear();
    state.sessionBrowserMonth = now.getMonth();
    renderSessionExplorer();
  }

  function visibleSessionsForCurrentMonth() {
    return state.sessions
      .filter((session) => String(session.status || "scheduled") !== "cancelled")
      .filter((session) => {
        const date = new Date(session.starts_at);
        return date.getFullYear() === Number(state.sessionBrowserYear) && date.getMonth() === Number(state.sessionBrowserMonth);
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!isFinite(date.getTime())) return "";
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function sessionVenuePreset(session) {
    if (!session) return null;
    const direct = String(session.venue_key || "").trim().toLowerCase();
    if (direct && SESSION_VENUES[direct]) return SESSION_VENUES[direct];
    const title = String(session.title || "").trim().toLowerCase();
    for (const venue of Object.values(SESSION_VENUES)) {
      if (venue.aliases.some((alias) => title.includes(alias))) return venue;
    }
    return null;
  }

  function sessionVenueShortLabel(session) {
    const venue = sessionVenuePreset(session);
    return venue ? venue.shortLabel : "Venue TBD";
  }

  function sessionVenueHasMap(session) {
    const venue = sessionVenuePreset(session);
    return Boolean(venue && isFinite(Number(venue.lat)) && isFinite(Number(venue.lng)));
  }

  async function queueSessionMapRender() {
    const container = document.getElementById("sessionMapCanvas");
    if (!container) return;

    const sessions = visibleSessionsForCurrentMonth().filter((session) => sessionVenueHasMap(session));
    if (!sessions.length) {
      destroySessionMap();
      container.innerHTML = '<div class="session-map-empty">No mapped sessions for this month yet.</div>';
      return;
    }

    try {
      await loadLeafletAssets();
      if (!document.getElementById("sessionMapCanvas")) return;
      renderSessionMap(document.getElementById("sessionMapCanvas"), sessions);
    } catch (error) {
      destroySessionMap();
      const target = document.getElementById("sessionMapCanvas");
      if (target) target.innerHTML = '<div class="session-map-empty">' + esc(errorText(error, "Map could not load.")) + '</div>';
    }
  }

  function destroySessionMap() {
    if (state.sessionMapInstance && typeof state.sessionMapInstance.remove === "function") {
      try { state.sessionMapInstance.remove(); } catch (_error) {}
    }
    state.sessionMapInstance = null;
    state.sessionMapMarkers = [];
  }

  async function loadLeafletAssets() {
    if (window.L) return;
    if (leafletLoadPromise) return leafletLoadPromise;

    leafletLoadPromise = new Promise((resolve, reject) => {
      const existingCss = document.querySelector('link[data-leaflet="1"]');
      if (!existingCss) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@" + LEAFLET_VERSION + "/dist/leaflet.css";
        css.setAttribute("data-leaflet", "1");
        document.head.appendChild(css);
      }

      const existingScript = document.querySelector('script[data-leaflet="1"]');
      if (existingScript) {
        if (window.L) {
          resolve();
          return;
        }
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Map library failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@" + LEAFLET_VERSION + "/dist/leaflet.js";
      script.async = true;
      script.setAttribute("data-leaflet", "1");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Map library failed to load."));
      document.head.appendChild(script);
    });

    return leafletLoadPromise;
  }

  function renderSessionMap(container, sessions) {
    destroySessionMap();
    container.innerHTML = "";
    const map = window.L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false
    });
    state.sessionMapInstance = map;
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const venueOffsets = {};
    const markers = sessions.map((session) => {
      const venue = sessionVenuePreset(session);
      const isActive = String(session.id) === String(state.selectedSessionId);
      const offsetIndex = Number(venueOffsets[venue.key] || 0);
      venueOffsets[venue.key] = offsetIndex + 1;
      const angle = offsetIndex * (Math.PI / 3);
      const offsetRadius = offsetIndex === 0 ? 0 : 0.0012;
      const markerLat = Number(venue.lat) + (Math.sin(angle) * offsetRadius);
      const markerLng = Number(venue.lng) + (Math.cos(angle) * offsetRadius);
      const icon = window.L.divIcon({
        className: "session-map-marker-wrap",
        html: '<div class="session-map-marker' + (isActive ? ' is-active' : '') + '" style="--marker-color:' + esc(venue.color) + ';"><picture><source srcset="logo.svg" type="image/svg+xml"><img src="logo.png" alt="MK Chess" loading="lazy"></picture></div>',
        iconSize: [56, 62],
        iconAnchor: [28, 56],
        popupAnchor: [0, -16]
      });
      const marker = window.L.marker([markerLat, markerLng], { icon }).addTo(map);
      marker.bindPopup([
        '<div class="session-map-popup-media"><img src="' + esc(venue.imageUrl) + '" alt="' + esc(session.title || "Session") + '" loading="lazy" /></div>',
        '<div class="session-map-popup-body">',
        '<div class="session-map-popup-title">' + esc(session.title || "Session") + '</div>',
        '<div class="session-map-popup-row">' + esc(formatDateTime(session.starts_at)) + '</div>',
        '<div class="session-map-popup-row">' + esc(venue.location) + '</div>',
        '<div class="session-map-popup-row">' + esc(session.role_brief || venue.description) + '</div>',
        '<a href="#" class="session-map-popup-link" data-action="select-session" data-session-id="' + esc(session.id) + '" data-sync-month="0">View session</a>',
        '</div>'
      ].join(""));
      return marker;
    });

    state.sessionMapMarkers = markers;
    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [34, 34], maxZoom: 13 });
    setTimeout(() => {
      if (state.sessionMapInstance) state.sessionMapInstance.invalidateSize();
    }, 0);
  }

  async function ensureClubScheduleSeeded() {
    if (!state.supabase || !isAdmin() || state.scheduleSeedInFlight) return;
    state.scheduleSeedInFlight = true;
    try {
      const expected = buildRecurringClubSessions();
      if (!expected.length) return;

      const existingBySignature = new Map();
      state.sessions.forEach((session) => {
        existingBySignature.set(sessionSignature(session.title, session.starts_at), session);
      });

      let createdCount = 0;
      for (const entry of expected) {
        const signature = sessionSignature(entry.title, entry.startsAt);
        if (existingBySignature.has(signature)) continue;
        const createdId = await createClubScheduleSession(entry);
        if (!createdId) continue;
        createdCount += 1;
        existingBySignature.set(signature, {
          id: createdId,
          title: entry.title,
          starts_at: entry.startsAt.toISOString()
        });
      }

      if (createdCount) {
        await loadAllData();
        if (!state.selectedSessionId && state.sessions.length) {
          state.selectedSessionId = String(state.sessions[0].id);
        }
        setBackendStatus("Club schedule synced from your calendar.", "ok");
      }

      let activitiesAdded = 0;
      for (const entry of expected) {
        const signature = sessionSignature(entry.title, entry.startsAt);
        const session = state.sessions.find((row) => sessionSignature(row.title, row.starts_at) === signature);
        if (!session) continue;
        if (sessionActivitiesForSession(session.id).length) continue;
        const addResponse = await rpc("mkchess_volunteer_hub_add_session_activities", {
          p_session_id: session.id,
          p_titles: entry.activityTitles
        }, 25000);
        if (!addResponse.error) activitiesAdded += 1;
      }

      if (activitiesAdded) {
        await loadAllData();
        if (!createdCount) setBackendStatus("Club session activities synced.", "ok");
      }
    } finally {
      state.scheduleSeedInFlight = false;
    }
  }

  function buildRecurringClubSessions() {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 10, 0, 23, 59, 59, 999);
    const sessions = [];
    const seen = new Set();

    for (let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor <= rangeEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      Object.values(SESSION_VENUES).forEach((venue) => {
        recurringDatesForVenue(venue, year, month, rangeStart, rangeEnd).forEach((startsAt) => {
          const signature = sessionSignature(venue.titleSuggestion, startsAt);
          if (seen.has(signature)) return;
          seen.add(signature);
          sessions.push({
            title: venue.titleSuggestion,
            venueKey: venue.key,
            startsAt,
            requiredVolunteers: 2,
            roleBrief: venue.roleBrief,
            arrivalNote: venue.arrivalNote,
            backupPlan: venue.backupPlan,
            activityTitles: venue.activityTitles.slice()
          });
        });
      });
    }

    return sessions.sort((a, b) => a.startsAt - b.startsAt);
  }

  function recurringDatesForVenue(venue, year, month, rangeStart, rangeEnd) {
    const dates = [];
    if (venue.recurrence === "last_friday") {
      const day = lastWeekdayOfMonth(year, month, 5);
      dates.push(makeLocalSessionDate(year, month, day, venue.startHour, venue.startMinute));
    } else if (venue.recurrence === "first_wednesday") {
      const day = nthWeekdayOfMonth(year, month, 3, 1);
      dates.push(makeLocalSessionDate(year, month, day, venue.startHour, venue.startMinute));
    } else if (venue.recurrence === "second_thursday") {
      const day = nthWeekdayOfMonth(year, month, 4, 2);
      dates.push(makeLocalSessionDate(year, month, day, venue.startHour, venue.startMinute));
    } else if (venue.recurrence === "all_sundays_from_start") {
      const [startYear, startMonth, startDay] = String(venue.startDate || "2026-04-19").split("-").map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      allSundaysInMonth(year, month).forEach((day) => {
        const startsAt = makeLocalSessionDate(year, month, day, venue.startHour, venue.startMinute);
        if (startsAt >= startDate) dates.push(startsAt);
      });
    }

    return dates.filter((date) => date >= rangeStart && date <= rangeEnd);
  }

  function lastWeekdayOfMonth(year, month, weekday) {
    const date = new Date(year, month + 1, 0);
    while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
    return date.getDate();
  }

  function nthWeekdayOfMonth(year, month, weekday, nth) {
    const date = new Date(year, month, 1);
    let seen = 0;
    while (date.getMonth() === month) {
      if (date.getDay() === weekday) {
        seen += 1;
        if (seen === nth) return date.getDate();
      }
      date.setDate(date.getDate() + 1);
    }
    return 1;
  }

  function allSundaysInMonth(year, month) {
    const days = [];
    const date = new Date(year, month, 1);
    while (date.getDay() !== 0) date.setDate(date.getDate() + 1);
    while (date.getMonth() === month) {
      days.push(date.getDate());
      date.setDate(date.getDate() + 7);
    }
    return days;
  }

  function makeLocalSessionDate(year, month, day, hour, minute) {
    return new Date(year, month, day, Number(hour || 0), Number(minute || 0), 0, 0);
  }

  function sessionSignature(title, startsAt) {
    const date = startsAt instanceof Date ? startsAt : new Date(startsAt);
    if (!isFinite(date.getTime())) return String(title || "").trim().toLowerCase();
    return String(title || "").trim().toLowerCase() + "|" + date.toISOString().slice(0, 16);
  }

  async function createClubScheduleSession(entry) {
    const baseParams = {
      p_title: entry.title,
      p_starts_at: entry.startsAt.toISOString(),
      p_required_volunteers: entry.requiredVolunteers,
      p_assign_all: false,
      p_role_brief: entry.roleBrief,
      p_arrival_note: entry.arrivalNote,
      p_backup_plan: entry.backupPlan
    };

    let response = await callCreateSessionRpc({
      ...baseParams,
      p_venue_key: entry.venueKey
    }, 60000);

    if (response.error) {
      const message = errorText(response.error, "Create session failed");
      if (/timed out/i.test(message)) {
        await loadAllData();
        const existing = state.sessions.find((session) => sessionSignature(session.title, session.starts_at) === sessionSignature(entry.title, entry.startsAt));
        if (existing) return existing.id;
      }
      setBackendStatus("Club schedule sync failed: " + message, "err");
      return null;
    }

    const sessionId = response.data;
    if (!sessionId) return null;

    const activitiesResponse = await rpc("mkchess_volunteer_hub_add_session_activities", {
      p_session_id: sessionId,
      p_titles: entry.activityTitles
    }, 25000);
    if (activitiesResponse.error) {
      setBackendStatus("Session created, but activity import failed: " + errorText(activitiesResponse.error, "Unknown error"), "warn");
    }

    return sessionId;
  }

  async function callCreateSessionRpc(params, timeoutMs) {
    const payload = { ...(params || {}) };
    let response = await rpc("mkchess_volunteer_hub_create_session", payload, timeoutMs);
    if (!response.error) return response;

    const message = errorText(response.error, "Create session failed");
    if (!/no function matches|function .* does not exist|unexpected|named parameter|venue_key/i.test(message)) {
      return response;
    }

    const fallbackPayload = { ...payload };
    delete fallbackPayload.p_venue_key;
    return rpc("mkchess_volunteer_hub_create_session", fallbackPayload, timeoutMs);
  }

  function renderVolunteerList() {
    const selfFocus = false;
    if (el.searchInput) {
      el.searchInput.placeholder = selfFocus ? "Your panel" : "Search volunteers";
      el.searchInput.style.display = selfFocus ? "none" : "";
    }
    if (state.loading) {
      el.volunteerList.innerHTML = '<div class="empty">Loading volunteers...</div>';
      return;
    }

    const search = String(el.searchInput.value || "").trim().toLowerCase();
    const rows = state.volunteers
      .filter((volunteer) => {
        const haystack = ((volunteer.display_name || "") + " " + (volunteer.tagline || "") + " " + (volunteer.bio || "")).toLowerCase();
        return !search || haystack.includes(search);
      })
      .map((volunteer) => ({ volunteer, metric: metricFor(volunteer.id) }))
      .sort((a, b) => Number(b.metric.reliability_score || 0) - Number(a.metric.reliability_score || 0));

    if (!rows.length) {
      const actions = isAdmin() ? '<div class="inline-actions"><button type="button" class="mini" data-action="open-volunteer-dialog">Add volunteer</button></div>' : '';
      el.volunteerList.innerHTML = '<div class="empty">No volunteers yet.' + actions + '</div>';
      return;
    }

    if (!state.selectedVolunteerId || !rows.some((row) => String(row.volunteer.id) === String(state.selectedVolunteerId))) {
      state.selectedVolunteerId = String(rows[0].volunteer.id);
    }

    el.volunteerList.innerHTML = rows.map((row) => {
      const volunteer = row.volunteer;
      const metric = row.metric;
      const active = String(volunteer.id) === String(state.selectedVolunteerId) ? "active" : "";
      return [
        '<article class="vol ' + active + '" data-volunteer-id="' + esc(volunteer.id) + '">',
        '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
        '<div><p class="headline">' + esc(volunteer.display_name || 'Volunteer') + '</p><p class="muted">' + stars(metric.avg_rating) + ' ' + Number(metric.avg_rating || 0).toFixed(2) + ' • attendance ' + Number(metric.attendance_rate_pct || 0) + '%</p></div>',
        '<span class="score">Reliability ' + Math.round(Number(metric.reliability_score || 0)) + '</span>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderSimpleVolunteerList() {
    const myId = myVolunteerId();
    const selfFocus = Boolean(myId) && !isAdmin();
    if (selfFocus) {
      const mine = state.volunteers.find((row) => String(row.id) === String(myId));
      if (!mine) {
        el.volunteerList.innerHTML = '<div class="empty">No linked volunteer profile.</div>';
        return;
      }
      state.selectedVolunteerId = String(mine.id);
      const metric = metricFor(mine.id);
      const upcoming = upcomingSessionsForVolunteer(mine.id).slice(0, 2);
      const next = upcoming[0] || null;
      const helped30 = countPositiveAttendance(mine.id, 30);
      const monthlyGoal = Number(state.monthlyGoal || 2);
      const goalRemaining = Math.max(0, monthlyGoal - helped30);
      const goalLine = goalRemaining > 0
        ? (goalRemaining + " more this month to hit your goal")
        : "Monthly goal reached";

      el.volunteerList.innerHTML = [
        '<section class="card">',
        '<h3>Your Snapshot</h3>',
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(mine.display_name || "Volunteer") + '</p><span class="score">★ ' + Number(metric.avg_rating || 0).toFixed(1) + '</span></div>',
        '<p class="muted">' + esc(mine.tagline || "Thanks for supporting MK Chess Club.") + '</p>',
        '</article>',
        '<article class="row">',
        '<div class="row-top"><p class="headline">This month: ' + helped30 + "/" + monthlyGoal + '</p><span class="' + (goalRemaining > 0 ? 'pill' : 'okpill') + '">' + esc(goalRemaining > 0 ? "In progress" : "On track") + '</span></div>',
        '<p class="muted">' + esc(goalLine) + '</p>',
        next ? '<p class="muted">Next up: ' + esc(next.title || "Session") + " • " + esc(formatDateTime(next.starts_at)) + '</p>' : '<p class="muted">No upcoming session assigned yet.</p>',
        '</article>',
        '</section>'
      ].join("");
      return;
    }

    const search = String(el.searchInput.value || "").trim().toLowerCase();
    const rows = state.volunteers
      .filter((volunteer) => {
        const haystack = ((volunteer.display_name || "") + " " + (volunteer.tagline || "") + " " + (volunteer.bio || "")).toLowerCase();
        return !search || haystack.includes(search);
      })
      .map((volunteer) => ({ volunteer, metric: metricFor(volunteer.id) }))
      .sort((a, b) => String(a.volunteer.display_name || "").localeCompare(String(b.volunteer.display_name || "")));

    if (!rows.length) {
      const actions = isAdmin() ? '<div class="inline-actions"><button type="button" class="mini" data-action="open-volunteer-dialog">Add volunteer</button></div>' : '';
      el.volunteerList.innerHTML = '<div class="empty">No volunteers yet.' + actions + '</div>';
      return;
    }

    if (!state.selectedVolunteerId || !rows.some((row) => String(row.volunteer.id) === String(state.selectedVolunteerId))) {
      state.selectedVolunteerId = String(rows[0].volunteer.id);
    }

    el.volunteerList.innerHTML = rows.map((entry) => {
      const volunteer = entry.volunteer;
      const metric = entry.metric;
      const active = String(volunteer.id) === String(state.selectedVolunteerId) ? "active" : "";
      const upcoming = upcomingSessionsForVolunteer(volunteer.id);
      const next = upcoming[0] || null;
      const rating = Number(metric.avg_rating || 0);
      const rightBadge = rating > 0 ? ("★ " + rating.toFixed(1)) : "New";
      const subtitle = next
        ? ("Next: " + formatDateTime(next.starts_at))
        : (volunteer.tagline ? volunteer.tagline : "No upcoming sessions");
      return [
        '<article class="vol ' + active + '" data-volunteer-id="' + esc(volunteer.id) + '">',
        '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
        '<div><p class="headline">' + esc(volunteer.display_name || 'Volunteer') + '</p><p class="muted">' + esc(subtitle) + '</p></div>',
        '<span class="score">' + esc(rightBadge) + '</span>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderVolunteerDetail() {
    if (!state.selectedVolunteerId) {
      const actions = isAdmin() ? '<div class="inline-actions"><button type="button" data-action="open-volunteer-dialog">Add volunteer</button></div>' : '';
      el.volunteerDetail.innerHTML = '<div class="empty">Select a volunteer.' + actions + '</div>';
      return;
    }

    const volunteer = state.volunteers.find((row) => String(row.id) === String(state.selectedVolunteerId));
    if (!volunteer) {
      el.volunteerDetail.innerHTML = '<div class="empty">Volunteer not found.</div>';
      return;
    }

    const metric = metricFor(volunteer.id);
    const upcoming = upcomingSessionsForVolunteer(volunteer.id).slice(0, 6);
    const feedbackRows = feedbackForVolunteer(volunteer.id).slice(0, 6);
    const helpedCount = countPositiveAttendance(volunteer.id);
    const streak = showUpStreak(volunteer.id);
    const pendingCount = pendingUpcomingResponses(volunteer.id);
    const nextSession = upcoming[0] || null;
    const myId = myVolunteerId();
    const actorUserId = state.user ? String(state.user.id) : "";
    const canClaimActivities = Boolean(myId) && String(myId) === String(volunteer.id);
    const canClaim = Boolean(state.user) && !myId && !volunteer.owner_user_id;
    const canLeaveFeedback = Boolean(state.user) && isApprovedMember() && pastSessionsForVolunteer(volunteer.id).length > 0;
    const canReport = Boolean(state.user) && isApprovedMember() && (!volunteer.owner_user_id || String(volunteer.owner_user_id) !== actorUserId);
    const canEdit = isAdmin() || String(volunteer.owner_user_id || "") === actorUserId;

    const feedbackButton = canLeaveFeedback ? '<button type="button" class="mini" data-action="open-feedback" data-volunteer-id="' + esc(volunteer.id) + '">Leave feedback</button>' : '';
    const reportButton = canReport ? '<button type="button" class="mini ghost" data-action="open-report" data-volunteer-id="' + esc(volunteer.id) + '">Report issue</button>' : '';
    const claimButton = canClaim ? '<button type="button" class="mini ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Claim profile</button>' : '';
    const nudgeButton = isAdmin() ? '<button type="button" class="mini ghost" data-action="nudge-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Copy nudge</button>' : '';
    const editButton = canEdit ? '<button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button>' : '';
    const ratingValue = Number(metric.avg_rating || 0);
    const supportCount = Number(metric.open_support_count || 0);
    const summaryHtml = [
      summaryCard(
        "Reliability",
        String(Math.round(Number(metric.reliability_score || 0))),
        pendingCount > 0 ? (pendingCount + " response" + (pendingCount === 1 ? "" : "s") + " still pending") : "Responses are up to date"
      ),
      summaryCard(
        "Attendance",
        Number(metric.attendance_rate_pct || 0) + "%",
        helpedCount + " completed session" + (helpedCount === 1 ? "" : "s")
      ),
      summaryCard(
        "Rating",
        ratingValue > 0 ? ratingValue.toFixed(1) : "New",
        feedbackRows.length ? (feedbackRows.length + " recent feedback note" + (feedbackRows.length === 1 ? "" : "s")) : "No feedback yet"
      )
    ].join("");
    const overviewBits = [];
    if (streak > 0) overviewBits.push("Streak " + streak);
    if (supportCount > 0) overviewBits.push(supportCount + " open support request" + (supportCount === 1 ? "" : "s"));
    if (nextSession) overviewBits.push("Next: " + nextSession.title + " on " + formatDate(nextSession.starts_at));
    const overviewLine = overviewBits.length ? overviewBits.join(" • ") : "No additional session activity yet.";

    const upcomingHtml = upcoming.length
      ? upcoming.map((session) => {
        const commitment = commitmentFor(volunteer.id, session.id);
        const status = commitment ? String(commitment.status || "") : "";
        const badge = status === "committed" ? '<span class="okpill">Committed</span>' : status === "unavailable" ? '<span class="warnpill">Unavailable</span>' : '<span class="pill">No response</span>';
        const plan = commitment && commitment.plan_leave_at ? "Leave " + formatTime(commitment.plan_leave_at) : "";
        const checkin = commitment && commitment.last_check_in_at ? "Checked in " + formatDateTime(commitment.last_check_in_at) : "";
        const roleLine = [session.role_brief || "", session.arrival_note || "", session.backup_plan || ""].filter(Boolean).join(" • ");
        const line = [plan, checkin].filter(Boolean).join(" • ");
        const activitiesHtml = renderSessionActivitiesHtml(session.id, {
          actorVolunteerId: canClaimActivities ? volunteer.id : null,
          showClaimActions: canClaimActivities,
          emptyText: "No activities added yet."
        });
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(session.starts_at)) + '</p>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
          line ? '<p class="muted">' + esc(line) + '</p>' : '',
          '<div class="rows">' + activitiesHtml + '</div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No upcoming assigned sessions.</div>';

    const feedbackHtml = feedbackRows.length
      ? feedbackRows.map((row) => {
        const session = sessionById(row.session_id);
        const type = row.feedback_type ? String(row.feedback_type) : "general";
        return [
          '<article class="review">',
          '<div class="row-top"><p class="muted">' + esc(session ? session.title : 'Session') + ' • ' + esc(formatDate(session ? session.starts_at : row.created_at)) + '</p><p class="muted">' + stars(row.rating) + '</p></div>',
          '<p class="muted">' + esc(type) + '</p>',
          '<p>' + esc(row.note || '') + '</p>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No feedback yet.</div>';
    const pastHistoryRows = pastSessionsForVolunteer(volunteer.id).slice(0, 8);
    const pastHistoryHtml = pastHistoryRows.length
      ? pastHistoryRows.map((session) => {
        const attendanceRow = attendanceFor(volunteer.id, session.id);
        const outcome = attendanceRow ? String(attendanceRow.outcome || "") : "";
        const badge = outcome === "showed_up"
          ? '<span class="okpill">Showed up</span>'
          : outcome === "late"
            ? '<span class="pill">Late</span>'
            : outcome === "excused"
              ? '<span class="pill">Excused</span>'
              : outcome === "no_show"
                ? '<span class="warnpill">No show</span>'
                : '<span class="pill">Awaiting mark</span>';
        const claimed = sessionActivitiesForSession(session.id)
          .filter((activity) => String(activity.claimed_by_volunteer_id || "") === String(volunteer.id))
          .map((activity) => activity.title);
        const claimedLine = claimed.length ? ("Claimed: " + claimed.join(", ")) : "No claimed activities recorded.";
        return [
          '<article class="session-history-item">',
          '<div class="session-history-top"><p class="session-roster-name">' + esc(session.title || "Session") + '</p>' + badge + '</div>',
          '<p class="soft-note">' + esc(formatDateTime(session.starts_at)) + '</p>',
          '<p class="soft-note">' + esc(claimedLine) + '</p>',
          '<div class="inline-actions"><button type="button" class="mini ghost" data-action="select-session" data-session-id="' + esc(session.id) + '" data-sync-month="1">Open session</button></div>',
          '</article>'
        ].join("");
      }).join("")
      : '<div class="empty">No past session history yet.</div>';

    el.volunteerDetail.innerHTML = [
      '<section class="hero">',
      '<div class="hero-top">',
      '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
      '<div><h2>' + esc(volunteer.display_name || 'Volunteer') + '</h2><p class="muted">' + esc(volunteer.tagline || volunteer.bio || '') + '</p></div>',
      '<div class="inline-actions">' + feedbackButton + reportButton + claimButton + editButton + nudgeButton + '</div>',
      '</div>',
      '<p class="section-note">' + esc(overviewLine) + '</p>',
      '<section class="summary-grid">' + summaryHtml + '</section>',
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Upcoming Commitments</h3><div class="rows">' + upcomingHtml + '</div></div>',
      '<div class="card"><h3>Recent Feedback</h3><div class="reviews">' + feedbackHtml + '</div></div>',
      '</section>',
      '<section class="card"><h3>Past Session History</h3><div class="session-history-list">' + pastHistoryHtml + '</div></section>',
    ].join('');
  }

  function renderStudio() {
    if (state.loading) {
      el.studioPanel.innerHTML = '<div class="empty">Loading studio...</div>';
      return;
    }
    if (!state.user) {
      el.studioPanel.innerHTML = '<div class="empty">Sign in to open your volunteer studio.</div>';
      return;
    }

    const volunteerId = myVolunteerId();
    if (!volunteerId) {
      const claimHelp = state.selectedVolunteerId
        ? '<div class="inline-actions"><button type="button" class="ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(state.selectedVolunteerId) + '">Claim selected profile</button></div>'
        : '<p class="muted">Ask the coordinator to add your volunteer profile, then claim it here.</p>';
      el.studioPanel.innerHTML = '<div class="empty">No linked volunteer profile yet.' + claimHelp + '</div>';
      return;
    }

    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) {
      el.studioPanel.innerHTML = '<div class="empty">Linked volunteer profile not found.</div>';
      return;
    }

    const upcoming = upcomingSessionsForVolunteer(volunteerId).slice(0, 10);
    const openShifts = upcomingSessions()
      .filter((session) => !assignedVolunteerIds(session.id).includes(String(volunteerId)))
      .slice(0, 8);
    const pastAssigned = pastSessionsForVolunteer(volunteerId).slice(0, 12);
    const actorId = state.user ? String(state.user.id) : "";
    const pendingPulseSessions = pastAssigned.filter((session) => !pulseFor(volunteerId, session.id, actorId)).slice(0, 6);
    const pendingCount = pendingUpcomingResponses(volunteerId);
    const helped30 = countPositiveAttendance(volunteerId, 30);
    const monthlyGoal = Number(state.monthlyGoal || 2);
    const nextSession = upcoming[0] || null;
    const mySupportRows = state.supportRequests
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 6);
    const openSupportCount = mySupportRows.filter((row) => String(row.status || "open") === "open").length;
    const checkInNowRows = upcoming.filter((session) => {
      const commitment = commitmentFor(volunteerId, session.id);
      if (!commitment) return false;
      return String(commitment.status || "") === "committed" && !commitment.last_check_in_at && withinCheckInWindow(session.starts_at);
    });

    let actionCardHtml = "";
    if (checkInNowRows.length) {
      const first = checkInNowRows[0];
      actionCardHtml = [
        '<section class="card">',
        '<h3>Next Step</h3>',
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(first.title || 'Session') + '</p><span class="warnpill">Check-in window open</span></div>',
        '<p class="muted">' + esc(formatDateTime(first.starts_at)) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini" data-action="check-in-session" data-session-id="' + esc(first.id) + '">I\'m on my way</button></div>',
        '</article>',
        '</section>'
      ].join('');
    } else if (pendingPulseSessions.length) {
      const firstPulse = pendingPulseSessions[0];
      actionCardHtml = [
        '<section class="card">',
        '<h3>Next Step</h3>',
        '<article class="row">',
        '<div class="row-top"><p class="headline">Submit your session pulse</p><span class="pill">1 min</span></div>',
        '<p class="muted">' + esc(firstPulse.title || "Session") + " • " + esc(formatDate(firstPulse.starts_at)) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini" data-action="open-pulse-dialog" data-session-id="' + esc(firstPulse.id) + '">Submit pulse</button></div>',
        '</article>',
        '</section>'
      ].join('');
    } else if (pendingCount > 0) {
      actionCardHtml = [
        '<section class="card">',
        '<h3>Next Step</h3>',
        '<article class="row">',
        '<div class="row-top"><p class="headline">Confirm upcoming availability</p><span class="pill">' + pendingCount + ' pending</span></div>',
        '<p class="muted">Responding early improves session quality and your reliability score.</p>',
        '</article>',
        '</section>'
      ].join('');
    }

    const rowsHtml = upcoming.length
      ? upcoming.map((session) => {
        const commitment = commitmentFor(volunteerId, session.id);
        const status = commitment ? String(commitment.status || "") : "";
        const committedClass = status === "committed" ? "" : " ghost";
        const unavailableClass = status === "unavailable" ? "" : " ghost";
        const checkedIn = commitment && commitment.last_check_in_at;
        const canCheckIn = status === "committed" && withinCheckInWindow(session.starts_at);
        const plan = commitment && commitment.plan_leave_at ? "Leave " + formatTime(commitment.plan_leave_at) : "";
        const checkin = checkedIn ? "Checked in " + formatDateTime(commitment.last_check_in_at) : "";
        const roleLine = [session.role_brief || "", session.arrival_note || "", session.backup_plan || ""].filter(Boolean).join(" • ");
        const planLine = [plan, checkin].filter(Boolean).join(" • ");
        const activitiesHtml = renderSessionActivitiesHtml(session.id, {
          actorVolunteerId: volunteerId,
          showClaimActions: true,
          emptyText: "No activities added yet."
        });

        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span></div>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
          planLine ? '<p class="muted">' + esc(planLine) + '</p>' : '',
          '<div class="rows">' + activitiesHtml + '</div>',
          '<div class="inline-actions">',
          '<button type="button" class="mini' + committedClass + '" data-action="set-commitment" data-session-id="' + esc(session.id) + '" data-status="committed">I can make it</button>',
          '<button type="button" class="mini' + unavailableClass + '" data-action="set-commitment" data-session-id="' + esc(session.id) + '" data-status="unavailable">Can\'t make it</button>',
          canCheckIn ? '<button type="button" class="mini ghost" data-action="check-in-session" data-session-id="' + esc(session.id) + '">I\'m on my way</button>' : '',
          (!canCheckIn && checkedIn) ? '<span class="okpill">Checked in</span>' : '',
          '</div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No upcoming sessions assigned.</div>';

    const openShiftHtml = openShifts.length
      ? openShifts.map((session) => {
        const roleLine = [session.role_brief || "", session.arrival_note || "", session.backup_plan || ""].filter(Boolean).join(" • ");
        const activitiesHtml = renderSessionActivitiesHtml(session.id, {
          actorVolunteerId: volunteerId,
          showClaimActions: true,
          emptyText: "No activities added yet."
        });
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || "Session") + '</p><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span></div>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
          '<div class="rows">' + activitiesHtml + '</div>',
          '<div class="inline-actions"><button type="button" class="mini ghost" data-action="take-open-shift" data-session-id="' + esc(session.id) + '">Take this shift</button></div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No open shifts right now.</div>';

    const pulseBacklogHtml = pendingPulseSessions.length
      ? pendingPulseSessions.map((session) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(session.title || "Session") + '</p><span class="pill">' + esc(formatDate(session.starts_at)) + '</span></div>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-pulse-dialog" data-session-id="' + esc(session.id) + '">Submit pulse</button></div>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">Pulse submissions are up to date.</div>';
    const mySupportHtml = mySupportRows.length
      ? mySupportRows.map((row) => {
        const session = row.session_id ? sessionById(row.session_id) : null;
        const status = String(row.status || "open");
        const statusClass = status === "open" ? "warnpill" : "okpill";
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.request_type || "support") + '</p><span class="' + statusClass + '">' + esc(status) + '</span></div>',
          session ? '<p class="muted">' + esc(session.title || "Session") + " • " + esc(formatDateTime(session.starts_at)) + '</p>' : '',
          '<p class="muted">' + esc(formatDate(row.created_at)) + ' • urgency ' + esc(row.urgency || "normal") + '</p>',
          '<p>' + esc(row.details || "") + '</p>',
          row.resolution_note ? '<p class="muted">Resolution: ' + esc(row.resolution_note) + '</p>' : '',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No support requests yet.</div>';
    const summaryHtml = [
      summaryCard(
        "Next step",
        checkInNowRows.length ? "Check in" : (pendingPulseSessions.length ? "Send pulse" : (pendingCount > 0 ? "Reply" : "Clear")),
        checkInNowRows.length
          ? "You can check in for your next session now."
          : (pendingPulseSessions.length
            ? "Share a quick pulse for your last session."
            : (pendingCount > 0 ? (pendingCount + " upcoming response" + (pendingCount === 1 ? "" : "s") + " still pending") : "Nothing urgent right now."))
      ),
      summaryCard(
        "Upcoming",
        String(upcoming.length),
        nextSession ? (nextSession.title + " • " + formatDate(nextSession.starts_at)) : "No upcoming sessions assigned"
      ),
      summaryCard(
        "This month",
        helped30 + "/" + monthlyGoal,
        helped30 >= monthlyGoal ? "Monthly goal reached" : ((monthlyGoal - helped30) + " more to goal")
      ),
      summaryCard(
        "Support",
        String(openSupportCount),
        openSupportCount ? "Requests still open" : "No open support requests"
      )
    ].join("");
    const overviewLine = "Claim activities inside each session card so everyone can see who owns what.";

    el.studioPanel.innerHTML = [
      '<section class="hero">',
      '<div class="hero-top">',
      '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
      '<div><h2>My Studio</h2><p class="muted">' + esc(volunteer.display_name || 'Volunteer') + '</p></div>',
      '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button><button type="button" class="mini ghost" data-action="open-support-dialog">Need support</button><button type="button" class="mini ghost" data-action="open-pulse-dialog">Session pulse</button><button type="button" class="mini ghost" data-action="open-activity-suggestion-dialog">Suggest activity</button></div>',
      '</div>',
      '<p class="section-note">' + esc(overviewLine) + '</p>',
      '<section class="summary-grid">' + summaryHtml + '</section>',
      '</section>',
      actionCardHtml,
      '<section class="card"><h3>Upcoming Sessions</h3><div class="rows">' + rowsHtml + '</div></section>',
      '<section class="grid2"><div class="card"><h3>Available Sessions</h3><div class="rows">' + openShiftHtml + '</div></div><div class="card"><h3>Pulses To Submit</h3><div class="rows">' + pulseBacklogHtml + '</div></div></section>',
      '<section class="card"><h3>My Support Requests</h3><div class="rows">' + mySupportHtml + '</div></section>'
    ].join('');
  }

  async function onActionClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = String(target.getAttribute("data-action") || "");

    if (action === "select-session") { event.preventDefault(); onSelectSession(target.getAttribute("data-session-id"), String(target.getAttribute("data-sync-month") || "") === "1"); return; }
    if (action === "set-session-browser-view") { onSetSessionBrowserView(target.getAttribute("data-view")); return; }
    if (action === "shift-session-month") { onShiftSessionMonth(target.getAttribute("data-month-delta")); return; }
    if (action === "session-month-today") { onJumpSessionMonthToday(); return; }
    if (action === "select-volunteer") {
      state.selectedVolunteerId = String(target.getAttribute("data-volunteer-id") || "");
      renderVolunteerList();
      renderVolunteerDetail();
      if (el.directorySplit && typeof el.directorySplit.scrollIntoView === "function") {
        el.directorySplit.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (action === "open-volunteer-dialog") { openVolunteerDialog(); return; }
    if (action === "open-session-dialog") { openSessionDialog(); return; }
    if (action === "open-feedback") { openFeedbackDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-report") { openReportDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-edit-volunteer") { openEditVolunteerDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-activity-suggestion-dialog") { openActivitySuggestionDialog(); return; }
    if (action === "claim-volunteer") { await onClaimVolunteer(target.getAttribute("data-volunteer-id")); return; }
    if (action === "toggle-session-activity-claim") { await onToggleSessionActivityClaim(target.getAttribute("data-activity-id"), target.getAttribute("data-mode")); return; }
    if (action === "set-commitment") { await onSetCommitment(target.getAttribute("data-session-id"), target.getAttribute("data-status")); return; }
    if (action === "check-in-session") { await onCheckInSession(target.getAttribute("data-session-id")); return; }
    if (action === "toggle-activity-suggestion-vote") { await onToggleActivitySuggestionVote(target.getAttribute("data-suggestion-id")); return; }
    if (action === "add-suggested-activity") { onAddSuggestedActivityToDraft(target.getAttribute("data-suggestion-id")); return; }
    if (action === "nudge-session") { await copySessionNudge(target.getAttribute("data-session-id"), target.getAttribute("data-stage")); return; }
    if (action === "nudge-volunteer") { await copyVolunteerNudge(target.getAttribute("data-volunteer-id")); return; }
    if (action === "copy-recognition") { await copyRecognitionNudge(target.getAttribute("data-volunteer-id")); return; }
    if (action === "copy-recovery") { await copyRecoveryNudge(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-attendance") { openAttendanceDialog(target.getAttribute("data-session-id")); return; }
    if (action === "open-pulse-dialog") { openPulseDialog(target.getAttribute("data-session-id")); return; }
    if (action === "open-support-dialog") { openSupportDialog(target.getAttribute("data-session-id")); return; }
    if (action === "resolve-support") { await onResolveSupportRequest(target.getAttribute("data-support-id")); return; }
    if (action === "take-open-shift") { await onTakeOpenShift(target.getAttribute("data-session-id")); return; }
    if (action === "set-goal") { onSetMonthlyGoal(target.getAttribute("data-goal")); return; }
    if (action === "set-purpose") { onSetVolunteerPurpose(target.getAttribute("data-purpose")); return; }
  }

  function onVolunteerListClick(event) {
    if (event.target.closest("[data-action]")) return;
    const row = event.target.closest("[data-volunteer-id]");
    if (!row) return;
    state.selectedVolunteerId = row.getAttribute("data-volunteer-id");
    renderVolunteerList();
    renderVolunteerDetail();
  }

  async function onSendLink() {
    if (!state.supabase) {
      setStatus(el.authStatus, missingBackendMessage(), "err");
      return;
    }
    const email = String(el.emailInput.value || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus(el.authStatus, "Enter a valid email.", "err");
      return;
    }
    const allowedDomain = normalizeDomain(APP_CONFIG.allowedEmailDomain || "");
    if (allowedDomain && !email.endsWith("@" + allowedDomain)) {
      setStatus(el.authStatus, "Email must end with @" + allowedDomain, "err");
      return;
    }

    el.sendLinkBtn.disabled = true;
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await state.supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
      });
      if (error) {
        setStatus(el.authStatus, "Login failed: " + errorText(error, "Unknown error"), "err");
        return;
      }
      setStatus(el.authStatus, "Login link sent. Open it in this same browser.", "ok");
    } catch (error) {
      setStatus(el.authStatus, errorText(error, "Login failed"), "err");
    } finally {
      el.sendLinkBtn.disabled = false;
    }
  }

  async function onSignOut() {
    if (state.supabase) {
      try { await state.supabase.auth.signOut(); } catch (_error) {}
    }
    state.user = null;
    state.profile = null;
    await loadAllData();
    renderAll();
  }

  async function onStartSetup() {
    if (!state.user || !state.supabase) {
      setStatus(el.authStatus, "Sign in first.", "err");
      return;
    }
    el.startSetupBtn.disabled = true;
    const label = el.startSetupBtn.textContent;
    el.startSetupBtn.textContent = "Setting up...";
    try {
      const preferred = String(state.user.email || "club admin").split("@")[0];
      const response = await rpc("mkchess_volunteer_hub_bootstrap_admin_setup", { p_display_name: preferred }, 20000);
      if (response.error) {
        const message = errorText(response.error, "Setup failed");
        if (looksLikeMissingSetup(message)) setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
        else setBackendStatus("Setup failed: " + message, "err");
        return;
      }
      await refreshSession();
      await loadAllData();
      renderAll();
      setBackendStatus("Setup complete.", "ok");
    } finally {
      el.startSetupBtn.disabled = false;
      el.startSetupBtn.textContent = label || "Start setup";
    }
  }

  function openVolunteerDialog() {
    if (!isAdmin()) {
      setBackendStatus("Admin role required.", "err");
      return;
    }
    el.volunteerForm.reset();
    clearStatus(el.volunteerStatus);
    openDialog(el.volunteerDialog);
  }

  async function onCreateVolunteer(event) {
    event.preventDefault();
    clearStatus(el.volunteerStatus);
    const name = String(el.volunteerNameInput.value || "").trim();
    const tagline = String(el.volunteerTaglineInput.value || "").trim();
    const bio = String(el.volunteerBioInput.value || "").trim();
    if (name.length < 2) {
      setStatus(el.volunteerStatus, "Name must be at least 2 characters.", "err");
      return;
    }

    el.createVolunteerBtn.disabled = true;
    const label = el.createVolunteerBtn.textContent;
    el.createVolunteerBtn.textContent = "Creating...";
    try {
      const response = await rpc("mkchess_volunteer_hub_create_volunteer", {
        p_display_name: name,
        p_tagline: tagline || null,
        p_bio: bio || null
      }, 60000);
      if (response.error) {
        const message = errorText(response.error, "Create failed");
        if (/timed out/i.test(message)) {
          await loadAllData();
          const now = Date.now();
          const created = state.volunteers.find((row) => {
            if (String(row.display_name || "").trim().toLowerCase() !== name.toLowerCase()) return false;
            const createdAt = new Date(row.created_at || 0).getTime();
            return isFinite(createdAt) && Math.abs(now - createdAt) <= 300000;
          });
          if (created) {
            state.selectedVolunteerId = String(created.id);
            renderAll();
            setBackendStatus("Volunteer created.", "ok");
            if (el.volunteerDialog.open) el.volunteerDialog.close();
            return;
          }
        }
        if (looksLikeMissingSetup(message)) setStatus(el.volunteerStatus, "Run supabase/all_in_one_setup.sql first.", "err");
        else setStatus(el.volunteerStatus, message, "err");
        return;
      }
      await loadAllData();
      if (response.data) state.selectedVolunteerId = String(response.data);
      renderAll();
      setBackendStatus("Volunteer created.", "ok");
      if (el.volunteerDialog.open) el.volunteerDialog.close();
    } finally {
      el.createVolunteerBtn.disabled = false;
      el.createVolunteerBtn.textContent = label || "Create Volunteer";
    }
  }

  function openSessionDialog() {
    if (!isAdmin()) {
      setBackendStatus("Admin role required.", "err");
      return;
    }
    renderSessionVenueOptions();
    el.sessionForm.reset();
    clearStatus(el.sessionStatus);
    const soon = new Date(Date.now() + 86400000);
    soon.setMinutes(0, 0, 0);
    if (el.sessionVenueKeyInput) el.sessionVenueKeyInput.value = "learn";
    el.sessionStartsInput.value = toDatetimeLocal(soon);
    el.sessionRequiredInput.value = "2";
    el.sessionRoleBriefInput.value = "Welcome attendees, set boards, and support pairings";
    el.sessionActivitiesInput.value = defaultSessionActivityLines();
    el.sessionTitleInput.value = SESSION_VENUES.learn.titleSuggestion;
    el.sessionArrivalNoteInput.value = "Arrive 20 minutes early at " + SESSION_VENUES.learn.shortLabel;
    el.sessionBackupPlanInput.value = "If delayed, message coordinator immediately";
    el.sessionAssignAllInput.value = "0";
    updateSessionVenueHint();
    renderSessionDialogSuggestionButtons();
    openDialog(el.sessionDialog);
  }

  async function onCreateSession(event) {
    event.preventDefault();
    clearStatus(el.sessionStatus);
    const title = String(el.sessionTitleInput.value || "").trim();
    const venueKey = String(el.sessionVenueKeyInput.value || "").trim().toLowerCase();
    const startsRaw = String(el.sessionStartsInput.value || "").trim();
    const required = Math.max(1, Math.min(20, Number(el.sessionRequiredInput.value || 2)));
    const roleBrief = String(el.sessionRoleBriefInput.value || "").trim();
    const activityTitles = parseActivityTitles(el.sessionActivitiesInput.value);
    const arrivalNote = String(el.sessionArrivalNoteInput.value || "").trim();
    const backupPlan = String(el.sessionBackupPlanInput.value || "").trim();
    const assignAll = String(el.sessionAssignAllInput.value || "0") === "1";
    if (title.length < 3) {
      setStatus(el.sessionStatus, "Title must be at least 3 characters.", "err");
      return;
    }
    if (roleBrief.length < 4) {
      setStatus(el.sessionStatus, "Role clarity is required.", "err");
      return;
    }
    if (!activityTitles.length) {
      setStatus(el.sessionStatus, "Add at least one volunteer activity.", "err");
      return;
    }
    const startsAt = new Date(startsRaw);
    if (!isFinite(startsAt.getTime())) {
      setStatus(el.sessionStatus, "Invalid start date/time.", "err");
      return;
    }

    el.createSessionBtn.disabled = true;
    const label = el.createSessionBtn.textContent;
    el.createSessionBtn.textContent = "Creating...";
    try {
      const response = await callCreateSessionRpc({
        p_title: title,
        p_starts_at: startsAt.toISOString(),
        p_required_volunteers: required,
        p_assign_all: assignAll,
        p_venue_key: venueKey || null,
        p_role_brief: roleBrief,
        p_arrival_note: arrivalNote || null,
        p_backup_plan: backupPlan || null
      }, 60000);
      if (response.error) {
        const message = errorText(response.error, "Create failed");
        if (/timed out/i.test(message)) {
          await loadAllData();
          const created = state.sessions.find((row) => {
            if (String(row.title || "").trim().toLowerCase() !== title.toLowerCase()) return false;
            const starts = new Date(row.starts_at || 0).getTime();
            return isFinite(starts) && Math.abs(starts - startsAt.getTime()) <= 60000;
          });
          if (created) {
            state.selectedSessionId = String(created.id);
            state.sessionBrowserYear = new Date(created.starts_at).getFullYear();
            state.sessionBrowserMonth = new Date(created.starts_at).getMonth();
            const activitiesResponse = await rpc("mkchess_volunteer_hub_add_session_activities", {
              p_session_id: created.id,
              p_titles: activityTitles
            }, 25000);
            if (activitiesResponse.error) {
              setStatus(el.sessionStatus, errorText(activitiesResponse.error, "Session activities save failed"), "err");
              renderAll();
              return;
            }
            await loadAllData();
            renderAll();
            setBackendStatus("Session created.", "ok");
            if (el.sessionDialog.open) el.sessionDialog.close();
            return;
          }
        }
        if (looksLikeMissingSetup(message)) setStatus(el.sessionStatus, "Run supabase/all_in_one_setup.sql first.", "err");
        else setStatus(el.sessionStatus, message, "err");
        return;
      }
      if (response.data) {
        const activitiesResponse = await rpc("mkchess_volunteer_hub_add_session_activities", {
          p_session_id: response.data,
          p_titles: activityTitles
        }, 25000);
        if (activitiesResponse.error) {
          setStatus(el.sessionStatus, errorText(activitiesResponse.error, "Session activities save failed"), "err");
          await loadAllData();
          renderAll();
          return;
        }
      }
      await loadAllData();
      if (response.data) {
        state.selectedSessionId = String(response.data);
        const createdSession = sessionById(response.data);
        if (createdSession) {
          state.sessionBrowserYear = new Date(createdSession.starts_at).getFullYear();
          state.sessionBrowserMonth = new Date(createdSession.starts_at).getMonth();
        }
      }
      renderAll();
      setBackendStatus("Session created.", "ok");
      if (el.sessionDialog.open) el.sessionDialog.close();
    } finally {
      el.createSessionBtn.disabled = false;
      el.createSessionBtn.textContent = label || "Create Session";
    }
  }

  function openFeedbackDialog(volunteerId) {
    if (!state.user) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;

    clearStatus(el.feedbackStatus);
    el.feedbackForm.reset();
    el.feedbackVolunteerIdInput.value = String(volunteer.id);

    const reviewerId = String(state.user.id);
    const alreadyReviewed = new Set(
      state.feedback
        .filter((row) => String(row.reviewer_user_id || "") === reviewerId && String(row.volunteer_id || "") === String(volunteer.id))
        .map((row) => String(row.session_id))
    );

    const sessions = pastSessionsForVolunteer(volunteer.id).filter((session) => !alreadyReviewed.has(String(session.id)));
    el.feedbackSessionSelect.innerHTML = '<option value="">Select session</option>' + sessions.map((session) => '<option value="' + esc(session.id) + '">' + esc(session.title || 'Session') + ' • ' + esc(formatDate(session.starts_at)) + '</option>').join('');
    if (!sessions.length) setStatus(el.feedbackStatus, "No eligible sessions left for feedback.", "warn");
    openDialog(el.feedbackDialog);
  }

  async function onSubmitFeedback(event) {
    event.preventDefault();
    clearStatus(el.feedbackStatus);
    const volunteerId = String(el.feedbackVolunteerIdInput.value || "").trim();
    const sessionId = String(el.feedbackSessionSelect.value || "").trim();
    const rating = Number(el.feedbackRatingInput.value || 0);
    const feedbackType = String(el.feedbackTypeSelect.value || "general").trim();
    const note = String(el.feedbackNoteInput.value || "").trim();
    if (!volunteerId || !sessionId) {
      setStatus(el.feedbackStatus, "Select a session.", "err");
      return;
    }
    if (!rating || rating < 1 || rating > 5) {
      setStatus(el.feedbackStatus, "Select rating 1-5.", "err");
      return;
    }

    el.submitFeedbackBtn.disabled = true;
    const label = el.submitFeedbackBtn.textContent;
    el.submitFeedbackBtn.textContent = "Submitting...";
    try {
      const response = await rpc("mkchess_volunteer_hub_submit_feedback", {
        p_session_id: sessionId,
        p_volunteer_id: volunteerId,
        p_rating: rating,
        p_feedback_type: feedbackType || null,
        p_note: note || null
      }, 25000);
      if (response.error) {
        setStatus(el.feedbackStatus, errorText(response.error, "Submit failed"), "err");
        return;
      }
      await loadAllData();
      renderAll();
      setBackendStatus("Feedback submitted.", "ok");
      if (el.feedbackDialog.open) el.feedbackDialog.close();
    } finally {
      el.submitFeedbackBtn.disabled = false;
      el.submitFeedbackBtn.textContent = label || "Submit Feedback";
    }
  }
  function openReportDialog(volunteerId) {
    if (!state.user) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;

    clearStatus(el.reportStatus);
    el.reportForm.reset();
    el.reportVolunteerIdInput.value = String(volunteer.id);
    const sessions = pastSessionsForVolunteer(volunteer.id);
    el.reportSessionSelect.innerHTML = '<option value="">No specific session</option>' + sessions.map((session) => '<option value="' + esc(session.id) + '">' + esc(session.title || 'Session') + ' • ' + esc(formatDate(session.starts_at)) + '</option>').join('');
    openDialog(el.reportDialog);
  }

  async function onSubmitReport(event) {
    event.preventDefault();
    clearStatus(el.reportStatus);
    const volunteerId = String(el.reportVolunteerIdInput.value || "").trim();
    const sessionIdRaw = String(el.reportSessionSelect.value || "").trim();
    const reason = String(el.reportReasonSelect.value || "").trim();
    const details = String(el.reportDetailsInput.value || "").trim();
    if (!volunteerId) { setStatus(el.reportStatus, "Volunteer required.", "err"); return; }
    if (!reason) { setStatus(el.reportStatus, "Select a reason.", "err"); return; }
    if (details.length < 5) { setStatus(el.reportStatus, "Add a bit more detail.", "err"); return; }

    el.submitReportBtn.disabled = true;
    const label = el.submitReportBtn.textContent;
    el.submitReportBtn.textContent = "Submitting...";
    try {
      const response = await rpc("mkchess_volunteer_hub_submit_report", {
        p_session_id: sessionIdRaw || null,
        p_volunteer_id: volunteerId,
        p_reason: reason,
        p_details: details
      }, 25000);
      if (response.error) { setStatus(el.reportStatus, errorText(response.error, "Submit failed"), "err"); return; }
      setBackendStatus("Report submitted.", "ok");
      if (el.reportDialog.open) el.reportDialog.close();
    } finally {
      el.submitReportBtn.disabled = false;
      el.submitReportBtn.textContent = label || "Submit Report";
    }
  }

  function openEditVolunteerDialog(volunteerId) {
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;
    const canEdit = isAdmin() || (state.user && String(volunteer.owner_user_id || "") === String(state.user.id));
    if (!canEdit) { setBackendStatus("Only owner or admin can edit this profile.", "err"); return; }

    clearStatus(el.editVolunteerStatus);
    el.editVolunteerForm.reset();
    el.editVolunteerIdInput.value = String(volunteer.id);
    el.editVolunteerNameInput.value = String(volunteer.display_name || "");
    el.editVolunteerTaglineInput.value = String(volunteer.tagline || "");
    el.editVolunteerBioInput.value = String(volunteer.bio || "");
    openDialog(el.editVolunteerDialog);
  }

  async function onSaveVolunteerProfile(event) {
    event.preventDefault();
    clearStatus(el.editVolunteerStatus);
    const volunteerId = String(el.editVolunteerIdInput.value || "").trim();
    const name = String(el.editVolunteerNameInput.value || "").trim();
    const tagline = String(el.editVolunteerTaglineInput.value || "").trim();
    const bio = String(el.editVolunteerBioInput.value || "").trim();
    if (!volunteerId) { setStatus(el.editVolunteerStatus, "Volunteer missing.", "err"); return; }
    if (name.length < 2) { setStatus(el.editVolunteerStatus, "Name must be at least 2 characters.", "err"); return; }

    el.saveVolunteerProfileBtn.disabled = true;
    const label = el.saveVolunteerProfileBtn.textContent;
    el.saveVolunteerProfileBtn.textContent = "Saving...";
    try {
      const response = await rpc("mkchess_volunteer_hub_update_volunteer_profile", {
        p_volunteer_id: volunteerId,
        p_display_name: name,
        p_tagline: tagline || null,
        p_bio: bio || null
      }, 25000);
      if (response.error) { setStatus(el.editVolunteerStatus, errorText(response.error, "Save failed"), "err"); return; }
      await loadAllData();
      renderAll();
      setBackendStatus("Volunteer profile updated.", "ok");
      if (el.editVolunteerDialog.open) el.editVolunteerDialog.close();
    } finally {
      el.saveVolunteerProfileBtn.disabled = false;
      el.saveVolunteerProfileBtn.textContent = label || "Save Changes";
    }
  }

  function openActivitySuggestionDialog() {
    if (!state.user || !state.supabase) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    if (!isApprovedMember()) {
      setBackendStatus("Approved member access is required.", "err");
      return;
    }
    clearStatus(el.activitySuggestionStatus);
    el.activitySuggestionForm.reset();
    openDialog(el.activitySuggestionDialog);
  }

  async function onSubmitActivitySuggestion(event) {
    event.preventDefault();
    clearStatus(el.activitySuggestionStatus);
    if (!state.user || !state.supabase) {
      setStatus(el.activitySuggestionStatus, "Sign in first.", "err");
      return;
    }
    if (!isApprovedMember()) {
      setStatus(el.activitySuggestionStatus, "Approved member access is required.", "err");
      return;
    }

    const title = String(el.activitySuggestionTitleInput.value || "").trim();
    const details = String(el.activitySuggestionDetailsInput.value || "").trim();
    if (title.length < 3) {
      setStatus(el.activitySuggestionStatus, "Add a slightly longer activity title.", "err");
      return;
    }

    el.suggestActivityBtn.disabled = true;
    const label = el.suggestActivityBtn.textContent;
    el.suggestActivityBtn.textContent = "Sending...";
    try {
      const response = await rpc("mkchess_volunteer_hub_suggest_activity", {
        p_title: title,
        p_details: details || null
      }, 25000);
      if (response.error) {
        setStatus(el.activitySuggestionStatus, errorText(response.error, "Suggestion failed"), "err");
        return;
      }
      await loadAllData();
      renderAll();
      setBackendStatus("Activity idea saved for the team to vote on.", "ok");
      if (el.activitySuggestionDialog.open) el.activitySuggestionDialog.close();
    } finally {
      el.suggestActivityBtn.disabled = false;
      el.suggestActivityBtn.textContent = label || "Send Suggestion";
    }
  }

  async function onToggleActivitySuggestionVote(suggestionId) {
    if (!suggestionId) return;
    if (!state.user || !state.supabase) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    if (!isApprovedMember()) {
      setBackendStatus("Approved member access is required.", "err");
      return;
    }
    const response = await rpc("mkchess_volunteer_hub_toggle_activity_suggestion_vote", { p_suggestion_id: suggestionId }, 25000);
    if (response.error) {
      setBackendStatus(errorText(response.error, "Vote failed"), "err");
      return;
    }
    await loadAllData();
    renderAll();
    setBackendStatus(response.data ? "Vote added." : "Vote removed.", "ok");
  }

  async function onToggleSessionActivityClaim(activityId, mode) {
    if (!activityId) return;
    if (!state.user || !state.supabase) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    if (!myVolunteerId()) {
      setBackendStatus("Claim a volunteer profile first.", "err");
      return;
    }
    const activity = sessionActivityById(activityId);
    if (!activity) {
      setBackendStatus("Activity not found.", "err");
      return;
    }
    const rpcName = String(mode || "") === "release" ? "mkchess_volunteer_hub_unclaim_session_activity" : "mkchess_volunteer_hub_claim_session_activity";
    const response = await rpc(rpcName, { p_activity_id: activityId }, 25000);
    if (response.error) {
      setBackendStatus(errorText(response.error, "Activity update failed"), "err");
      return;
    }
    await loadAllData();
    renderAll();
    if (rpcName === "mkchess_volunteer_hub_claim_session_activity") setBackendStatus("Activity claimed. You are marked in for that session.", "ok");
    else setBackendStatus("Activity released.", "ok");
  }

  function onAddSuggestedActivityToDraft(suggestionId) {
    if (!el.sessionActivitiesInput) return;
    const suggestion = state.activitySuggestions.find((row) => String(row.id) === String(suggestionId));
    if (!suggestion) return;
    const title = String(suggestion.title || "").trim();
    if (!title) return;
    const existing = parseActivityTitles(el.sessionActivitiesInput.value);
    if (existing.some((value) => value.toLowerCase() === title.toLowerCase())) {
      setBackendStatus("That activity is already in the session draft.", "ok");
      return;
    }
    existing.push(title);
    el.sessionActivitiesInput.value = existing.join("\n");
    setBackendStatus("Activity added to the session draft.", "ok");
  }

  function openPulseDialog(sessionId) {
    if (!state.user || !state.supabase) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    const volunteerId = myVolunteerId();
    if (!volunteerId) {
      setBackendStatus("Claim a volunteer profile first.", "err");
      return;
    }

    clearStatus(el.pulseStatus);
    el.pulseForm.reset();
    const actorUserId = String(state.user.id);
    const forcedId = sessionId ? String(sessionId) : "";
    const candidates = pastSessionsForVolunteer(volunteerId).filter((session) => {
      if (forcedId && String(session.id) === forcedId) return true;
      return !pulseFor(volunteerId, session.id, actorUserId);
    }).slice(0, 24);

    if (!candidates.length) {
      setBackendStatus("No completed sessions need a pulse right now.", "ok");
      return;
    }

    el.pulseSessionSelect.innerHTML = '<option value="">Select session</option>' + candidates.map((session) =>
      '<option value="' + esc(session.id) + '">' + esc(session.title || "Session") + " • " + esc(formatDate(session.starts_at)) + "</option>"
    ).join("");

    const preferredId = forcedId && candidates.some((session) => String(session.id) === forcedId)
      ? forcedId
      : String(candidates[0].id);
    el.pulseSessionSelect.value = preferredId;
    onPulseSessionChanged();
    openDialog(el.pulseDialog);
  }

  function onPulseSessionChanged() {
    const volunteerId = myVolunteerId();
    const sessionId = String(el.pulseSessionSelect.value || "");
    el.pulseClarityInput.value = "";
    el.pulseSupportInput.value = "";
    el.pulseStressInput.value = "";
    el.pulseNoteInput.value = "";
    if (!volunteerId || !sessionId) return;
    const actorUserId = state.user ? String(state.user.id) : "";
    const existing = pulseFor(volunteerId, sessionId, actorUserId);
    if (!existing) return;
    el.pulseClarityInput.value = String(existing.clarity_rating || "");
    el.pulseSupportInput.value = String(existing.support_rating || "");
    el.pulseStressInput.value = String(existing.stress_rating || "");
    el.pulseNoteInput.value = String(existing.note || "");
  }

  async function onSubmitPulse(event) {
    event.preventDefault();
    clearStatus(el.pulseStatus);
    if (!state.user || !state.supabase) {
      setStatus(el.pulseStatus, "Sign in first.", "err");
      return;
    }
    if (!myVolunteerId()) {
      setStatus(el.pulseStatus, "Claim a volunteer profile first.", "err");
      return;
    }

    const sessionId = String(el.pulseSessionSelect.value || "").trim();
    const clarity = Number(el.pulseClarityInput.value || 0);
    const support = Number(el.pulseSupportInput.value || 0);
    const stress = Number(el.pulseStressInput.value || 0);
    const note = String(el.pulseNoteInput.value || "").trim();

    if (!sessionId) { setStatus(el.pulseStatus, "Choose a session.", "err"); return; }
    if (![clarity, support, stress].every((value) => value >= 1 && value <= 5)) {
      setStatus(el.pulseStatus, "All pulse ratings must be 1-5.", "err");
      return;
    }

    el.submitPulseBtn.disabled = true;
    const label = el.submitPulseBtn.textContent;
    el.submitPulseBtn.textContent = "Submitting...";
    try {
      const response = await rpc("mkchess_volunteer_hub_submit_session_pulse", {
        p_session_id: sessionId,
        p_clarity_rating: clarity,
        p_support_rating: support,
        p_stress_rating: stress,
        p_note: note || null
      }, 25000);
      if (response.error) {
        setStatus(el.pulseStatus, errorText(response.error, "Pulse submit failed"), "err");
        return;
      }
      await loadAllData();
      renderAll();
      setBackendStatus("Pulse submitted. Your input helps us make volunteering better every week.", "ok");
      if (el.pulseDialog.open) el.pulseDialog.close();
    } finally {
      el.submitPulseBtn.disabled = false;
      el.submitPulseBtn.textContent = label || "Submit Pulse";
    }
  }

  function openSupportDialog(sessionId) {
    if (!state.user || !state.supabase) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    const volunteerId = myVolunteerId();
    if (!volunteerId) {
      setBackendStatus("Claim a volunteer profile first.", "err");
      return;
    }

    clearStatus(el.supportStatus);
    el.supportForm.reset();
    el.supportUrgencySelect.value = "normal";
    const upcoming = upcomingSessionsForVolunteer(volunteerId);
    const recentPast = pastSessionsForVolunteer(volunteerId).slice(0, 6);
    const byId = {};
    [...upcoming, ...recentPast].forEach((session) => { byId[String(session.id)] = session; });
    const options = Object.values(byId).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    el.supportSessionSelect.innerHTML = '<option value="">No specific session</option>' + options.map((session) =>
      '<option value="' + esc(session.id) + '">' + esc(session.title || "Session") + " • " + esc(formatDateTime(session.starts_at)) + "</option>"
    ).join("");
    if (sessionId && options.some((session) => String(session.id) === String(sessionId))) {
      el.supportSessionSelect.value = String(sessionId);
    }
    openDialog(el.supportDialog);
  }

  async function onSubmitSupportRequest(event) {
    event.preventDefault();
    clearStatus(el.supportStatus);
    if (!state.user || !state.supabase) {
      setStatus(el.supportStatus, "Sign in first.", "err");
      return;
    }
    if (!myVolunteerId()) {
      setStatus(el.supportStatus, "Claim a volunteer profile first.", "err");
      return;
    }

    const sessionIdRaw = String(el.supportSessionSelect.value || "").trim();
    const requestType = String(el.supportTypeSelect.value || "").trim();
    const urgency = String(el.supportUrgencySelect.value || "normal").trim();
    const details = String(el.supportDetailsInput.value || "").trim();
    if (!requestType) { setStatus(el.supportStatus, "Select a request type.", "err"); return; }
    if (details.length < 6) { setStatus(el.supportStatus, "Add a bit more detail.", "err"); return; }

    el.submitSupportBtn.disabled = true;
    const label = el.submitSupportBtn.textContent;
    el.submitSupportBtn.textContent = "Sending...";
    try {
      const response = await rpc("mkchess_volunteer_hub_submit_support_request", {
        p_session_id: sessionIdRaw || null,
        p_request_type: requestType,
        p_urgency: urgency || "normal",
        p_details: details
      }, 25000);
      if (response.error) {
        setStatus(el.supportStatus, errorText(response.error, "Request failed"), "err");
        return;
      }
      await loadAllData();
      renderAll();
      setBackendStatus("Support request sent.", "ok");
      if (el.supportDialog.open) el.supportDialog.close();
    } finally {
      el.submitSupportBtn.disabled = false;
      el.submitSupportBtn.textContent = label || "Send Request";
    }
  }

  async function onResolveSupportRequest(supportId) {
    if (!isAdmin()) {
      setBackendStatus("Admin role required.", "err");
      return;
    }
    const request = state.supportRequests.find((row) => String(row.id) === String(supportId));
    if (!request) {
      setBackendStatus("Support request not found.", "err");
      return;
    }
    const note = window.prompt("Optional resolution note:", String(request.resolution_note || ""));
    if (note === null) return;
    const response = await rpc("mkchess_volunteer_hub_resolve_support_request", {
      p_request_id: supportId,
      p_status: "resolved",
      p_resolution_note: String(note || "").trim() || null
    }, 25000);
    if (response.error) {
      setBackendStatus(errorText(response.error, "Resolve failed"), "err");
      return;
    }
    await loadAllData();
    renderAll();
    setBackendStatus("Support request resolved.", "ok");
  }

  function openAttendanceDialog(sessionId) {
    if (!isAdmin()) { setBackendStatus("Admin role required.", "err"); return; }
    const session = sessionById(sessionId);
    if (!session) return;

    state.attendanceSessionId = String(session.id);
    el.attendanceTitle.textContent = "Mark Attendance • " + String(session.title || "Session");
    clearStatus(el.attendanceStatus);

    const volunteerIds = assignedVolunteerIds(session.id);
    const volunteers = volunteerIds.map((id) => state.volunteers.find((row) => String(row.id) === String(id))).filter(Boolean);
    if (!volunteers.length) {
      el.attendanceRows.innerHTML = '<div class="empty">No assigned volunteers for this session.</div>';
      openDialog(el.attendanceDialog);
      return;
    }

    el.attendanceRows.innerHTML = volunteers.map((volunteer) => {
      const row = attendanceFor(volunteer.id, session.id);
      const currentOutcome = row ? String(row.outcome || "") : "";
      const note = row ? String(row.note || "") : "";
      return [
        '<article class="att" data-att-volunteer="' + esc(volunteer.id) + '">',
        '<div><p class="headline">' + esc(volunteer.display_name || 'Volunteer') + '</p></div>',
        '<select class="att-outcome">',
        '<option value="">Skip</option>',
        '<option value="showed_up"' + (currentOutcome === 'showed_up' ? ' selected' : '') + '>Showed up</option>',
        '<option value="late"' + (currentOutcome === 'late' ? ' selected' : '') + '>Late</option>',
        '<option value="no_show"' + (currentOutcome === 'no_show' ? ' selected' : '') + '>No-show</option>',
        '<option value="excused"' + (currentOutcome === 'excused' ? ' selected' : '') + '>Excused</option>',
        '</select>',
        '<input class="att-note" type="text" maxlength="400" placeholder="Optional note" value="' + esc(note) + '" />',
        '</article>'
      ].join('');
    }).join('');

    openDialog(el.attendanceDialog);
  }

  async function onSubmitAttendance(event) {
    event.preventDefault();
    clearStatus(el.attendanceStatus);
    if (!state.attendanceSessionId) { setStatus(el.attendanceStatus, "No session selected.", "err"); return; }

    const rows = Array.from(el.attendanceRows.querySelectorAll("[data-att-volunteer]"));
    const calls = [];
    rows.forEach((row) => {
      const volunteerId = row.getAttribute("data-att-volunteer");
      const outcome = String((row.querySelector(".att-outcome") || {}).value || "").trim();
      const note = String((row.querySelector(".att-note") || {}).value || "").trim();
      if (!outcome) return;
      calls.push(rpc("mkchess_volunteer_hub_mark_attendance", {
        p_session_id: state.attendanceSessionId,
        p_volunteer_id: volunteerId,
        p_outcome: outcome,
        p_note: note || null
      }, 25000));
    });

    if (!calls.length) { setStatus(el.attendanceStatus, "No attendance updates selected.", "warn"); return; }

    el.saveAttendanceBtn.disabled = true;
    const label = el.saveAttendanceBtn.textContent;
    el.saveAttendanceBtn.textContent = "Saving...";
    try {
      const responses = await Promise.all(calls);
      const failed = responses.find((response) => response.error);
      if (failed) { setStatus(el.attendanceStatus, errorText(failed.error, "Attendance save failed"), "err"); return; }
      await loadAllData();
      renderAll();
      setBackendStatus("Attendance updated.", "ok");
      if (el.attendanceDialog.open) el.attendanceDialog.close();
    } finally {
      el.saveAttendanceBtn.disabled = false;
      el.saveAttendanceBtn.textContent = label || "Save Attendance";
    }
  }

  async function onClaimVolunteer(volunteerId) {
    if (!state.user || !state.supabase) { setBackendStatus("Sign in first.", "err"); return; }
    const response = await rpc("mkchess_volunteer_hub_claim_volunteer", { p_volunteer_id: volunteerId }, 25000);
    if (response.error) { setBackendStatus(errorText(response.error, "Claim failed"), "err"); return; }
    await refreshSession();
    await loadAllData();
    renderAll();
    setBackendStatus("Profile linked. You are ready to start taking shifts.", "ok");
  }

  async function onSetCommitment(sessionId, status) {
    if (!state.user || !state.supabase) { setBackendStatus("Sign in first.", "err"); return; }

    let note = null;
    let planLeaveAt = null;
    const session = sessionById(sessionId);

    if (status === "committed") {
      if (!session) { setBackendStatus("Session not found.", "err"); return; }
      const defaultTime = defaultLeaveTime(session.starts_at);
      planLeaveAt = combineSessionDateAndClock(session.starts_at, defaultTime);
      note = "Auto leave plan " + defaultTime;
    }

    if (status === "unavailable") {
      note = "Marked unavailable";
    }

    const response = await rpc("mkchess_volunteer_hub_set_commitment", {
      p_session_id: sessionId,
      p_status: status,
      p_note: note,
      p_plan_leave_at: planLeaveAt
    }, 25000);

    if (response.error) { setBackendStatus(errorText(response.error, "Commitment update failed"), "err"); return; }
    await loadAllData();
    renderAll();
    if (status === "committed") {
      const label = session ? String(session.title || "your session") : "your session";
      setBackendStatus("Great, you are confirmed for " + label + ".", "ok");
    } else {
      setBackendStatus("Availability updated. Thanks for the early notice.", "ok");
    }
  }

  async function onCheckInSession(sessionId) {
    if (!state.user || !state.supabase) { setBackendStatus("Sign in first.", "err"); return; }
    const response = await rpc("mkchess_volunteer_hub_check_in_session", { p_session_id: sessionId, p_note: "On my way" }, 25000);
    if (response.error) { setBackendStatus(errorText(response.error, "Check-in failed"), "err"); return; }
    await loadAllData();
    renderAll();
    setBackendStatus("Checked in. Thank you for showing up for the club.", "ok");
  }

  async function onTakeOpenShift(sessionId) {
    if (!sessionById(sessionId)) {
      setBackendStatus("Session not found.", "err");
      return;
    }
    await onSetCommitment(sessionId, "committed");
  }

  function onSetMonthlyGoal(goalRaw) {
    const goal = Number(goalRaw || 0);
    if (![1, 2, 4].includes(goal)) return;
    state.monthlyGoal = goal;
    safeSet(STORAGE.monthlyGoal, String(goal));
    setBackendStatus("Great choice. Monthly target set to " + goal + " session(s).", "ok");
    renderAll();
  }

  function onSetVolunteerPurpose(purposeRaw) {
    const purpose = String(purposeRaw || "");
    if (!["community", "coaching", "skills", "social"].includes(purpose)) return;
    state.volunteerPurpose = purpose;
    safeSet(STORAGE.volunteerPurpose, purpose);
    const summary = purposeSummary(purpose);
    setBackendStatus("Focus updated: " + summary.title + ".", "ok");
    renderAll();
  }

  function parseActivityTitles(raw) {
    const seen = new Set();
    return String(raw || "")
      .split(/\r?\n/)
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 24);
  }

  function defaultSessionActivityLines() {
    const suggested = topActivitySuggestions(3).map((row) => String(row.suggestion.title || "").trim()).filter(Boolean);
    if (suggested.length) return suggested.join("\n");
    return [
      "Set up boards",
      "Welcome new players",
      "Support pairings"
    ].join("\n");
  }

  function renderSessionDialogSuggestionButtons() {
    if (!el.sessionSuggestedActivities) return;
    const suggestions = topActivitySuggestions(6);
    if (!suggestions.length) {
      el.sessionSuggestedActivities.innerHTML = '<button type="button" class="mini ghost" data-action="open-activity-suggestion-dialog">Suggest a new activity</button>';
      return;
    }
    el.sessionSuggestedActivities.innerHTML = suggestions.map((entry) =>
      '<button type="button" class="mini ghost" data-action="add-suggested-activity" data-suggestion-id="' + esc(entry.suggestion.id) + '">' +
      esc(entry.suggestion.title || "Suggested activity") +
      ' (' + entry.votes + ')' +
      '</button>'
    ).join("") + '<button type="button" class="mini ghost" data-action="open-activity-suggestion-dialog">Suggest a new activity</button>';
  }

  function topActivitySuggestions(limit) {
    return state.activitySuggestions
      .map((suggestion) => ({
        suggestion,
        votes: activitySuggestionVoteCount(suggestion.id)
      }))
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return new Date(b.suggestion.created_at || 0) - new Date(a.suggestion.created_at || 0);
      })
      .slice(0, Math.max(1, Number(limit || 6)));
  }

  function activitySuggestionVoteCount(suggestionId) {
    return state.activitySuggestionVotes.filter((row) => String(row.suggestion_id) === String(suggestionId)).length;
  }

  function hasVotedActivitySuggestion(suggestionId, voterUserId) {
    return state.activitySuggestionVotes.some((row) =>
      String(row.suggestion_id) === String(suggestionId) &&
      String(row.voter_user_id || "") === String(voterUserId || "")
    );
  }

  function sessionActivitiesForSession(sessionId) {
    return state.sessionActivities
      .filter((row) => String(row.session_id) === String(sessionId))
      .sort((a, b) => {
        const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
  }

  function normalizeSessionRows(rows) {
    return rows.map((row) => ({
      ...row,
      venue_key: String(row && row.venue_key || "").trim().toLowerCase(),
      role_brief: String(row && row.role_brief || ""),
      arrival_note: String(row && row.arrival_note || ""),
      backup_plan: String(row && row.backup_plan || ""),
      status: String(row && row.status || "scheduled")
    }));
  }

  function sessionActivityById(activityId) {
    return state.sessionActivities.find((row) => String(row.id) === String(activityId)) || null;
  }

  function sessionActivityClaimedCount(sessionId) {
    return sessionActivitiesForSession(sessionId).filter((row) => row.claimed_by_volunteer_id).length;
  }

  function renderSessionActivitiesHtml(sessionId, options) {
    const opts = options || {};
    const actorVolunteerId = opts.actorVolunteerId ? String(opts.actorVolunteerId) : "";
    const showClaimActions = Boolean(opts.showClaimActions && actorVolunteerId);
    const activities = sessionActivitiesForSession(sessionId);
    const emptyText = opts.emptyText || "No activities set for this session yet.";
    if (!activities.length) return '<div class="empty">' + esc(emptyText) + '</div>';

    return activities.map((activity) => {
      const claimedById = activity.claimed_by_volunteer_id ? String(activity.claimed_by_volunteer_id) : "";
      const claimedByName = claimedById ? (volunteerNameById(claimedById) || "Volunteer") : "";
      const claimedByMe = actorVolunteerId && claimedById === actorVolunteerId;
      const statusBadge = claimedById
        ? (claimedByMe ? '<span class="okpill">You</span>' : '<span class="pill">' + esc(claimedByName) + '</span>')
        : '<span class="warnpill">Open</span>';
      const actionsHtml = showClaimActions
        ? (!claimedById
          ? '<div class="inline-actions"><button type="button" class="mini ghost" data-action="toggle-session-activity-claim" data-activity-id="' + esc(activity.id) + '" data-mode="claim">Claim activity</button></div>'
          : (claimedByMe
            ? '<div class="inline-actions"><button type="button" class="mini ghost" data-action="toggle-session-activity-claim" data-activity-id="' + esc(activity.id) + '" data-mode="release">Release</button></div>'
            : ""))
        : "";
      const bodyLine = String(activity.details || "").trim()
        || (claimedById ? ("Claimed by " + claimedByName + ".") : "Nobody has claimed this yet.");
      return [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(activity.title || "Volunteer activity") + '</p>' + statusBadge + '</div>',
        '<p class="muted">' + esc(bodyLine) + '</p>',
        actionsHtml,
        '</article>'
      ].join("");
    }).join("");
  }

  function renderActivitySuggestionsHtml(options) {
    const opts = options || {};
    const limit = Math.max(1, Number(opts.limit || 5));
    const showUseButton = Boolean(opts.showUseButton);
    const actorUserId = state.user ? String(state.user.id) : "";
    const canVote = Boolean(state.user) && isApprovedMember();
    const rows = topActivitySuggestions(limit);
    if (!rows.length) {
      const cta = canVote ? '<button type="button" class="mini ghost" data-action="open-activity-suggestion-dialog">Suggest the first one</button>' : '';
      return '<div class="empty">No activity suggestions yet.' + (cta ? '<div class="inline-actions">' + cta + '</div>' : '') + '</div>';
    }

    return rows.map((entry) => {
      const suggestion = entry.suggestion;
      const votes = entry.votes;
      const voted = hasVotedActivitySuggestion(suggestion.id, actorUserId);
      const detail = String(suggestion.details || "").trim();
      const voteLine = votes + " vote" + (votes === 1 ? "" : "s");
      const voteButton = canVote
        ? '<button type="button" class="mini' + (voted ? "" : " ghost") + '" data-action="toggle-activity-suggestion-vote" data-suggestion-id="' + esc(suggestion.id) + '">' + (voted ? "Voted" : "Vote") + '</button>'
        : "";
      const useButton = showUseButton
        ? '<button type="button" class="mini ghost" data-action="add-suggested-activity" data-suggestion-id="' + esc(suggestion.id) + '">Add to session</button>'
        : "";
      return [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(suggestion.title || "Activity idea") + '</p><span class="pill">' + esc(voteLine) + '</span></div>',
        detail ? '<p class="muted">' + esc(trimText(detail, 150)) + '</p>' : '',
        '<div class="inline-actions">' + voteButton + useButton + '</div>',
        '</article>'
      ].join("");
    }).join("");
  }

  async function copySessionNudge(sessionId, stageLabelRaw) {
    const session = sessionById(sessionId);
    if (!session) return;
    const row = sessionCoverageRow(session);
    if (!row.pendingIds.length) { setBackendStatus("No pending volunteers for this session.", "ok"); return; }

    const names = row.pendingIds.map((id) => volunteerNameById(id)).filter(Boolean);
    const stageLabel = stageLabelRaw || reminderStageLabel(session.starts_at) || "Reminder";
    const text =
      stageLabel + ": " +
      (session.title || "session") +
      " is on " + formatDateTime(session.starts_at) +
      ". Please confirm availability and set your leave time in Volunteer Ops." +
      (names.length ? " Pending: " + names.join(", ") + "." : "");

    await copyText(text, "Session reminder copied.");
  }

  async function copyVolunteerNudge(volunteerId) {
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;
    const upcoming = upcomingSessionsForVolunteer(volunteer.id).slice(0, 3);
    const sessionText = upcoming.length
      ? upcoming.map((session) => (session.title || "Session") + " (" + formatDate(session.starts_at) + ")").join(", ")
      : "your upcoming sessions";
    const text =
      "Hi " + (volunteer.display_name || "there") +
      " - please confirm availability for " + sessionText +
      " in Volunteer Ops and set your leave time so we can run sessions smoothly.";
    await copyText(text, "Volunteer nudge copied.");
  }

  async function copyRecognitionNudge(volunteerId) {
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;
    const streak = showUpStreak(volunteer.id);
    const text =
      "Thank you " + (volunteer.display_name || "volunteer") +
      " for consistently showing up and supporting the chess sessions." +
      (streak >= 1 ? " You are on a " + streak + "-session show-up streak." : "") +
      " We appreciate your reliability and impact.";
    await copyText(text, "Recognition note copied.");
  }

  async function copyRecoveryNudge(volunteerId) {
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;
    const pendingCount = pendingUpcomingResponses(volunteer.id);
    const text =
      "Hi " + (volunteer.display_name || "there") +
      " - checking in to support your next sessions." +
      " If anything is making attendance hard, tell us and we can adjust assignments." +
      (pendingCount > 0 ? " You currently have " + pendingCount + " upcoming response(s) pending in Volunteer Ops." : "");
    await copyText(text, "Recovery note copied.");
  }

  async function copyText(text, successMessage) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setBackendStatus(successMessage, "ok");
    } catch (_error) {
      setBackendStatus("Copy failed. Message: " + text, "warn");
    }
  }

  async function rpc(name, params, timeoutMs) {
    if (!state.supabase) return { data: null, error: new Error("Backend not connected.") };
    try {
      const response = await withTimeout(
        state.supabase.rpc(name, params || {}),
        Number(timeoutMs || 30000),
        name + " timed out"
      );
      return response || { data: null, error: new Error("No response from server.") };
    } catch (error) {
      return { data: null, error };
    }
  }

  function computeDerivedMetricsRows() {
    return state.volunteers.map((volunteer) => {
      const volunteerId = String(volunteer.id);
      const feedbackRows = state.feedback.filter((row) => String(row.volunteer_id) === volunteerId);
      const attendanceRows = state.attendance.filter((row) => String(row.volunteer_id) === volunteerId);
      const pulseRows = state.sessionPulses.filter((row) => String(row.volunteer_id) === volunteerId);
      const now = Date.now();
      const upcomingSessionIds = Array.from(new Set(
        state.assignments
          .filter((row) => String(row.volunteer_id) === volunteerId)
          .map((row) => String(row.session_id))
      ))
        .filter((sessionId) => {
          const session = sessionById(sessionId);
          if (!session) return false;
          const starts = new Date(session.starts_at).getTime();
          return isFinite(starts) && starts >= (now - 7200000) && String(session.status || "scheduled") !== "cancelled";
        });
      const assignedUpcoming = upcomingSessionIds.length;
      const respondedUpcoming = upcomingSessionIds.filter((sessionId) => {
        const commitment = commitmentFor(volunteerId, sessionId);
        const status = commitment ? String(commitment.status || "") : "";
        return status === "committed" || status === "unavailable";
      }).length;
      const committedUpcoming = upcomingSessionIds.filter((sessionId) => {
        const commitment = commitmentFor(volunteerId, sessionId);
        return commitment && String(commitment.status || "") === "committed";
      }).length;
      const responseRate = assignedUpcoming ? Math.round((respondedUpcoming / assignedUpcoming) * 100) : 0;

      const positiveAttendance = attendanceRows.filter((row) => ["showed_up", "late", "excused"].includes(String(row.outcome || ""))).length;
      const attendanceRate = attendanceRows.length ? Math.round((positiveAttendance / attendanceRows.length) * 100) : 0;

      const avgRatingRaw = feedbackRows.length
        ? feedbackRows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / feedbackRows.length
        : 0;
      const avgRating = Number(avgRatingRaw.toFixed(2));
      const feedbackCount = feedbackRows.length;
      const avgClarity = pulseRows.length ? Number((pulseRows.reduce((sum, row) => sum + Number(row.clarity_rating || 0), 0) / pulseRows.length).toFixed(2)) : 0;
      const avgSupport = pulseRows.length ? Number((pulseRows.reduce((sum, row) => sum + Number(row.support_rating || 0), 0) / pulseRows.length).toFixed(2)) : 0;
      const avgStress = pulseRows.length ? Number((pulseRows.reduce((sum, row) => sum + Number(row.stress_rating || 0), 0) / pulseRows.length).toFixed(2)) : 0;
      const openSupportCount = state.supportRequests.filter((row) => String(row.volunteer_id) === volunteerId && String(row.status || "open") === "open").length;

      const cutoff90 = now - (90 * 86400000);
      const noShow90 = attendanceRows.filter((row) => {
        if (String(row.outcome || "") !== "no_show") return false;
        const session = sessionById(row.session_id);
        const at = session ? new Date(session.starts_at).getTime() : new Date(row.marked_at).getTime();
        return isFinite(at) && at >= cutoff90;
      }).length;

      const ratingScore = avgRating ? (avgRating / 5) * 100 : 70;
      const pulseScore = pulseRows.length ? Math.max(0, Math.min(100, Math.round(((avgClarity + avgSupport + (6 - avgStress)) / 15) * 100))) : 70;
      const reliability = Math.max(0, Math.min(100, Math.round(
        (attendanceRate * 0.35) +
        (responseRate * 0.25) +
        (ratingScore * 0.20) +
        (pulseScore * 0.20) -
        Math.min(noShow90 * 8, 24) -
        Math.min(openSupportCount * 5, 15)
      )));

      return {
        volunteer_id: volunteer.id,
        avg_rating: avgRating,
        feedback_count: feedbackCount,
        assigned_upcoming: assignedUpcoming,
        responded_upcoming: respondedUpcoming,
        committed_upcoming: committedUpcoming,
        response_rate_pct: responseRate,
        attendance_rate_pct: attendanceRate,
        no_show_90d: noShow90,
        pulse_count: pulseRows.length,
        avg_clarity: avgClarity,
        avg_support: avgSupport,
        avg_stress: avgStress,
        open_support_count: openSupportCount,
        reliability_score: reliability,
        at_risk: responseRate < 70 || attendanceRate < 80 || (feedbackCount >= 3 && avgRating < 3.8) || noShow90 >= 2 || (pulseRows.length >= 2 && avgSupport < 3.0) || openSupportCount >= 2
      };
    });
  }

  function upcomingSessions() {
    const now = Date.now() - 7200000;
    return state.sessions
      .filter((session) => new Date(session.starts_at).getTime() >= now && String(session.status || "scheduled") !== "cancelled")
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  function pastSessionsForVolunteer(volunteerId) {
    const now = Date.now();
    return state.sessions
      .filter((session) => new Date(session.starts_at).getTime() <= now && String(session.status || "scheduled") !== "cancelled")
      .filter((session) => assignedVolunteerIds(session.id).includes(String(volunteerId)))
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  }

  function upcomingSessionsForVolunteer(volunteerId) {
    const now = Date.now() - 7200000;
    return state.sessions
      .filter((session) => new Date(session.starts_at).getTime() >= now && String(session.status || "scheduled") !== "cancelled")
      .filter((session) => assignedVolunteerIds(session.id).includes(String(volunteerId)))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  function sessionCoverageRow(session) {
    const volunteerIds = assignedVolunteerIds(session.id);
    const activities = sessionActivitiesForSession(session.id);
    const assigned = volunteerIds.length;
    const required = Math.max(1, Number(session.required_volunteers || 2));
    let committed = 0;
    let responded = 0;
    const pendingIds = [];

    volunteerIds.forEach((volunteerId) => {
      const commitment = commitmentFor(volunteerId, session.id);
      const status = commitment ? String(commitment.status || "") : "";
      if (status === "committed") committed += 1;
      if (status === "committed" || status === "unavailable") responded += 1;
      if (!status) pendingIds.push(String(volunteerId));
    });

    return {
      id: String(session.id),
      title: String(session.title || "Session"),
      starts_at: session.starts_at,
      assigned,
      required,
      committed,
      responded,
      gap: Math.max(0, required - committed),
      pendingIds,
      activityCount: activities.length,
      claimedActivityCount: activities.filter((activity) => activity.claimed_by_volunteer_id).length
    };
  }

  function buildReminderQueue(coverageRows) {
    return coverageRows
      .filter((row) => row.pendingIds.length > 0)
      .map((row) => {
        const stageLabel = reminderStageLabel(row.starts_at);
        if (!stageLabel) return null;
        return { ...row, stageLabel };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  function reminderStageLabel(startsAtIso) {
    const diffHours = (new Date(startsAtIso).getTime() - Date.now()) / 3600000;
    if (diffHours <= 4 && diffHours > -0.5) return "Final check";
    if (diffHours <= 24 && diffHours > 4) return "24h reminder";
    if (diffHours <= 48 && diffHours > 24) return "48h reminder";
    return "";
  }

  function withinCheckInWindow(startsAtIso) {
    const sessionTime = new Date(startsAtIso).getTime();
    const now = Date.now();
    const openWindow = sessionTime - (CHECK_IN_WINDOW_HOURS * 3600000);
    const closeWindow = sessionTime + (CHECK_IN_GRACE_MINUTES * 60000);
    return now >= openWindow && now <= closeWindow;
  }

  function defaultLeaveTime(startsAtIso) {
    const start = new Date(startsAtIso);
    const leave = new Date(start.getTime() - 30 * 60000);
    return formatTime(leave.toISOString());
  }

  function normalizeClockInput(input) {
    const value = String(input || "").trim();
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!m) return "";
    return m[1].padStart(2, "0") + ":" + m[2].padStart(2, "0");
  }

  function combineSessionDateAndClock(startsAtIso, hhmm) {
    const sessionDate = new Date(startsAtIso);
    const [hh, mm] = hhmm.split(":").map(Number);
    const leave = new Date(sessionDate);
    leave.setHours(hh, mm, 0, 0);
    if (leave.getTime() > sessionDate.getTime()) leave.setDate(leave.getDate() - 1);
    return leave.toISOString();
  }

  function volunteerNameById(volunteerId) {
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    return volunteer ? volunteer.display_name : "";
  }

  function assignedVolunteerIds(sessionId) {
    return Array.from(new Set(
      state.assignments
        .filter((row) => String(row.session_id) === String(sessionId))
        .map((row) => String(row.volunteer_id))
    ));
  }

  function commitmentFor(volunteerId, sessionId) {
    const rows = state.commitments
      .filter((row) => String(row.volunteer_id) === String(volunteerId) && String(row.session_id) === String(sessionId))
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    return rows[0] || null;
  }

  function attendanceFor(volunteerId, sessionId) {
    const rows = state.attendance
      .filter((row) => String(row.volunteer_id) === String(volunteerId) && String(row.session_id) === String(sessionId))
      .sort((a, b) => new Date(b.marked_at || 0) - new Date(a.marked_at || 0));
    return rows[0] || null;
  }

  function isPositiveAttendanceOutcome(outcome) {
    return ["showed_up", "late", "excused"].includes(String(outcome || ""));
  }

  function attendanceTimestamp(row) {
    const session = sessionById(row.session_id);
    const at = session ? new Date(session.starts_at).getTime() : new Date(row.marked_at || 0).getTime();
    return isFinite(at) ? at : 0;
  }

  function countPositiveAttendance(volunteerId, days) {
    const cutoff = days ? (Date.now() - (Math.max(1, Number(days)) * 86400000)) : null;
    return state.attendance.filter((row) => {
      if (String(row.volunteer_id) !== String(volunteerId)) return false;
      if (!isPositiveAttendanceOutcome(row.outcome)) return false;
      if (!cutoff) return true;
      return attendanceTimestamp(row) >= cutoff;
    }).length;
  }

  function volunteerMilestone(helpedCount) {
    const helped = Math.max(0, Number(helpedCount || 0));
    const levels = [
      { label: "Starter", target: 1 },
      { label: "Core Helper", target: 5 },
      { label: "Club Anchor", target: 12 },
      { label: "Community Champion", target: 25 }
    ];
    let current = levels[0];
    let next = levels[0];
    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      if (helped >= level.target) current = level;
      if (helped < level.target) {
        next = level;
        return {
          currentLabel: current.label,
          nextLabel: next.label,
          nextTarget: next.target,
          remaining: Math.max(0, next.target - helped)
        };
      }
    }
    return {
      currentLabel: levels[levels.length - 1].label,
      nextLabel: levels[levels.length - 1].label,
      nextTarget: levels[levels.length - 1].target,
      remaining: 0
    };
  }

  function volunteerBadges(metric, streak, helpedCount, praiseCount) {
    const badges = [];
    if (Number(streak || 0) >= 3) badges.push("Consistency streak");
    if (Number(metric && metric.response_rate_pct || 0) >= 90) badges.push("Fast responder");
    if (Number(helpedCount || 0) >= 10) badges.push("Trusted regular");
    if (Number(praiseCount || 0) >= 3) badges.push("Member favourite");
    if (!badges.length) badges.push("Building momentum");
    return badges;
  }

  function purposeSummary(purposeKey) {
    const key = String(purposeKey || "community");
    if (key === "coaching") {
      return {
        title: "Help members improve",
        body: "Your presence creates better games, better habits, and faster progress."
      };
    }
    if (key === "skills") {
      return {
        title: "Grow my own leadership",
        body: "Each session builds confidence, communication, and coaching skill."
      };
    }
    if (key === "social") {
      return {
        title: "Belong to the community",
        body: "Showing up keeps friendships strong and makes sessions more welcoming."
      };
    }
    return {
      title: "Give back to the chess community",
      body: "Reliable volunteering keeps sessions running and gives members a great experience."
    };
  }

  function impactEstimate(helpedCount) {
    const sessions = Math.max(0, Number(helpedCount || 0));
    return Math.round(sessions * 10);
  }

  function goalProgressPct(currentCount, goalCount) {
    const goal = Math.max(1, Number(goalCount || 1));
    const current = Math.max(0, Number(currentCount || 0));
    return Math.max(0, Math.min(100, Math.round((current / goal) * 100)));
  }

  function motivationMessage(helpedThisMonth, monthlyGoal, streak, praiseCount) {
    const helped = Math.max(0, Number(helpedThisMonth || 0));
    const goal = Math.max(1, Number(monthlyGoal || 1));
    const run = Math.max(0, Number(streak || 0));
    const praise = Math.max(0, Number(praiseCount || 0));
    if (helped >= goal && run >= 3) return "You are leading by example. The club can count on you.";
    if (run >= 3) return "Your consistency is becoming one of the club's strengths.";
    if (praise >= 2) return "Members notice your impact. Keep the momentum going.";
    if (helped >= goal) return "Goal achieved this month. Brilliant contribution.";
    return "Every session you cover makes the club more welcoming and reliable.";
  }

  function nextRecognitionReward(helpedCount) {
    const helped = Math.max(0, Number(helpedCount || 0));
    const tiers = [
      { target: 1, label: "Starter recognition" },
      { target: 5, label: "Core helper shout-out" },
      { target: 12, label: "Club anchor spotlight" },
      { target: 25, label: "Community champion award" }
    ];
    for (let i = 0; i < tiers.length; i += 1) {
      const tier = tiers[i];
      if (helped < tier.target) {
        return { label: tier.label, remaining: tier.target - helped, target: tier.target };
      }
    }
    return { label: tiers[tiers.length - 1].label, remaining: 0, target: tiers[tiers.length - 1].target };
  }

  function sessionImpactEstimate(session) {
    if (!session) return 0;
    const required = Math.max(1, Number(session.required_volunteers || 2));
    return (required * 10) + 4;
  }

  function buildVolunteerMission(volunteerId, actorUserId) {
    const upcoming = upcomingSessionsForVolunteer(volunteerId);
    const checkInNow = upcoming.find((session) => {
      const commitment = commitmentFor(volunteerId, session.id);
      return commitment && String(commitment.status || "") === "committed" && !commitment.last_check_in_at && withinCheckInWindow(session.starts_at);
    }) || null;
    if (checkInNow) return { kind: "check_in", badge: "Now", session: checkInNow };

    const firstPending = upcoming.find((session) => !commitmentFor(volunteerId, session.id)) || null;
    if (firstPending) return { kind: "confirm", badge: "Pending", session: firstPending };

    const pulsePending = pastSessionsForVolunteer(volunteerId).find((session) => !pulseFor(volunteerId, session.id, actorUserId)) || null;
    if (pulsePending) return { kind: "pulse", badge: "1 min", session: pulsePending };

    const openShift = upcomingSessions().find((session) => !assignedVolunteerIds(session.id).includes(String(volunteerId))) || null;
    if (openShift) return { kind: "take_shift", badge: "Open", session: openShift };

    const nextAssigned = upcoming[0] || null;
    if (nextAssigned) return { kind: "ready", badge: "Ready", session: nextAssigned };

    return { kind: "idle", badge: "Clear", session: null };
  }

  function trimText(value, maxLength) {
    const text = String(value || "").trim();
    const limit = Math.max(20, Number(maxLength || 140));
    if (text.length <= limit) return text;
    return text.slice(0, limit - 3).trimEnd() + "...";
  }

  function feedbackForVolunteer(volunteerId) {
    return state.feedback
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  function pulsesForVolunteer(volunteerId) {
    return state.sessionPulses
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  function pulseFor(volunteerId, sessionId, createdByUserId) {
    const rows = state.sessionPulses
      .filter((row) => String(row.volunteer_id) === String(volunteerId) && String(row.session_id) === String(sessionId))
      .filter((row) => !createdByUserId || String(row.created_by_user_id || "") === String(createdByUserId))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return rows[0] || null;
  }

  function pendingUpcomingResponses(volunteerId) {
    return upcomingSessionsForVolunteer(volunteerId).filter((session) => !commitmentFor(volunteerId, session.id)).length;
  }

  function showUpStreak(volunteerId) {
    const rows = state.attendance
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .map((row) => {
        const session = sessionById(row.session_id);
        return {
          outcome: String(row.outcome || ""),
          at: session ? session.starts_at : row.marked_at
        };
      })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

    let streak = 0;
    for (const row of rows) {
      if (row.outcome === "showed_up" || row.outcome === "late" || row.outcome === "excused") {
        streak += 1;
        continue;
      }
      if (row.outcome === "no_show") break;
    }
    return streak;
  }

  function recentNoShowCount(volunteerId, days) {
    const cutoff = Date.now() - (Math.max(1, Number(days || 30)) * 86400000);
    return state.attendance.filter((row) => {
      if (String(row.volunteer_id) !== String(volunteerId)) return false;
      if (String(row.outcome || "") !== "no_show") return false;
      const session = sessionById(row.session_id);
      const at = session ? new Date(session.starts_at).getTime() : new Date(row.marked_at).getTime();
      return isFinite(at) && at >= cutoff;
    }).length;
  }

  function metricFor(volunteerId) {
    return state.metricsByVolunteer[String(volunteerId)] || {
      volunteer_id: volunteerId,
      avg_rating: 0,
      feedback_count: 0,
      assigned_upcoming: 0,
      responded_upcoming: 0,
      committed_upcoming: 0,
      response_rate_pct: 0,
      attendance_rate_pct: 0,
      no_show_90d: 0,
      pulse_count: 0,
      avg_clarity: 0,
      avg_support: 0,
      avg_stress: 0,
      open_support_count: 0,
      reliability_score: 0,
      at_risk: false
    };
  }

  function sessionById(sessionId) {
    return state.sessions.find((row) => String(row.id) === String(sessionId)) || null;
  }

  function isAdmin() {
    return Boolean(state.profile && state.profile.role === "admin" && state.profile.status === "approved");
  }

  function isApprovedMember() {
    return Boolean(state.profile && state.profile.status === "approved");
  }

  function myVolunteerId() {
    return state.profile && state.profile.volunteer_id ? String(state.profile.volunteer_id) : null;
  }

  function metricBox(label, value) {
    return '<article class="metric"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div></article>';
  }

  function summaryCard(label, value, note) {
    return '<article class="summary-card"><div class="summary-label">' + esc(label) + '</div><div class="summary-value">' + esc(value) + '</div>' + (note ? '<p class="summary-note">' + esc(note) + '</p>' : '') + '</article>';
  }

  function openDialog(node) {
    if (!node || typeof node.showModal !== "function") return;
    if (!node.open) node.showModal();
  }

  function setBackendStatus(text, type) {
    setStatus(el.backendStatus, text, type);
    if (backendStatusClearTimer) {
      clearTimeout(backendStatusClearTimer);
      backendStatusClearTimer = null;
    }
    if (type === "ok" && text) {
      backendStatusClearTimer = setTimeout(() => {
        if (!el.backendStatus) return;
        if (el.backendStatus.classList.contains("ok")) clearStatus(el.backendStatus);
      }, 2600);
    }
  }

  function setStatus(node, text, type) {
    if (!node) return;
    node.textContent = text || "";
    node.className = "status" + (type ? " " + type : "");
  }

  function clearStatus(node) {
    if (!node) return;
    node.textContent = "";
    node.className = "status";
  }

  function normalizeDomain(value) {
    return String(value || "").trim().toLowerCase().replace(/^@/, "");
  }

  function isFetchFailure(message) {
    return /failed to fetch/i.test(String(message || ""));
  }

  function missingBackendMessage() {
    return "Set APP_CONFIG.supabaseUrl and APP_CONFIG.supabaseAnonKey in app.js.";
  }

  function unreachableBackendMessage() {
    return "Could not reach Supabase. Check APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, and that the project is online.";
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_error) {}
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_error) { return null; }
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_error) {}
  }

  function looksLikeMissingSetup(message) {
    const text = String(message || "").toLowerCase();
    if (!/mkchess_volunteer_hub_/.test(text) && !/relation .* does not exist|schema cache|undefined function|function .* does not exist|no function matches/.test(text)) return false;
    return /does not exist|schema cache|undefined function|not found|no function matches/.test(text);
  }

  function isAuthLockError(message) {
    const text = String(message || "");
    return /lock:mk_chess_volunteer_hub_auth_v1/i.test(text) ||
      /navigatorlockacquiretimeouterror/i.test(text) ||
      /another request stole it/i.test(text);
  }

  function errorText(error, fallback) {
    if (!error) return fallback || "Error";
    if (typeof error === "string") return error;
    if (error.message) return String(error.message);
    return fallback || "Error";
  }

  function withTimeout(promise, ms, timeoutMessage) {
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage || "Timed out")), Math.max(1000, Number(ms || 30000)));
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  function mean(values) {
    if (!values.length) return 0;
    const numbers = values.map((row) => Number(row || 0)).filter((row) => isFinite(row) && row > 0);
    if (!numbers.length) return 0;
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }

  function stars(rating) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "V";
    const first = parts[0].charAt(0) || "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase() || "V";
  }

  function toDatetimeLocal(date) {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (!isFinite(date.getTime())) return "Unknown";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (!isFinite(date.getTime())) return "Unknown";
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatTime(iso) {
    const date = new Date(iso);
    if (!isFinite(date.getTime())) return "--:--";
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();

