(() => {
  "use strict";

  const STORAGE = {
    url: "mk_ops_url",
    key: "mk_ops_key",
    domain: "mk_ops_domain",
    previewMode: "mk_ops_preview_mode_v2",
    previewData: "mk_ops_preview_data_v2",
    simpleView: "mk_ops_simple_view_v3",
    monthlyGoal: "mk_ops_monthly_goal_v1",
    volunteerPurpose: "mk_ops_volunteer_purpose_v1"
  };

  const DEFAULT_SUPABASE = {
    url: "https://pfgvnbhvihleugpijjvr.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3ZuYmh2aWhsZXVncGlqanZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTU2ODcsImV4cCI6MjA4OTA5MTY4N30.xF-lTjR3z2tcjMjIv0am3cLYOBs3gHD3p7yq3FbDqcs"
  };

  const CHECK_IN_WINDOW_HOURS = 6;
  const CHECK_IN_GRACE_MINUTES = 30;

  const state = {
    supabase: null,
    authSubscription: null,
    user: null,
    profile: null,
    volunteers: [],
    sessions: [],
    assignments: [],
    commitments: [],
    attendance: [],
    feedback: [],
    sessionPulses: [],
    supportRequests: [],
    metricsRows: [],
    metricsByVolunteer: {},
    selectedVolunteerId: null,
    attendanceSessionId: null,
    loading: false,
    previewMode: true,
    syncInFlight: false,
    syncRequested: false,
    simpleView: true,
    monthlyGoal: 2,
    volunteerPurpose: "community"
  };

  const el = {};
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheEls();
    bindEvents();
    restoreSettings();
    renderAll();
    try {
      await connectSupabase();
      if (!state.previewMode) {
        await refreshSession();
        await ensureAccountProvisioned();
        await loadProfile();
      }
      await loadAllData();
      if (!state.previewMode) attachAuthSubscription();
    } catch (error) {
      setBackendStatus(errorText(error, "App init failed"), "err");
      state.loading = false;
    }
    renderAll();
  }

  function cacheEls() {
    [
      "emailInput", "sendLinkBtn", "signOutBtn", "startSetupBtn", "addVolunteerBtn", "addSessionBtn", "toggleSimpleBtn", "demoModeBtn", "openSettingsBtn",
      "authStatus", "backendStatus", "commandBoard", "searchInput", "volunteerList", "volunteerDetail", "studioPanel",
      "settingsDialog", "supaUrlInput", "supaKeyInput", "allowedDomainInput", "connectBtn",
      "volunteerDialog", "volunteerForm", "volunteerNameInput", "volunteerTaglineInput", "volunteerBioInput", "volunteerStatus", "createVolunteerBtn",
      "sessionDialog", "sessionForm", "sessionTitleInput", "sessionStartsInput", "sessionRequiredInput", "sessionRoleBriefInput", "sessionArrivalNoteInput", "sessionBackupPlanInput", "sessionAssignAllInput", "sessionStatus", "createSessionBtn",
      "feedbackDialog", "feedbackForm", "feedbackVolunteerIdInput", "feedbackSessionSelect", "feedbackRatingInput", "feedbackTypeSelect", "feedbackNoteInput", "feedbackStatus", "submitFeedbackBtn",
      "reportDialog", "reportForm", "reportVolunteerIdInput", "reportSessionSelect", "reportReasonSelect", "reportDetailsInput", "reportStatus", "submitReportBtn",
      "attendanceDialog", "attendanceTitle", "attendanceRows", "attendanceForm", "attendanceStatus", "saveAttendanceBtn",
      "editVolunteerDialog", "editVolunteerForm", "editVolunteerIdInput", "editVolunteerNameInput", "editVolunteerTaglineInput", "editVolunteerBioInput", "editVolunteerStatus", "saveVolunteerProfileBtn",
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
    el.toggleSimpleBtn.addEventListener("click", onToggleSimpleView);
    el.demoModeBtn.addEventListener("click", onTogglePreviewMode);
    el.openSettingsBtn.addEventListener("click", () => openDialog(el.settingsDialog));
    el.connectBtn.addEventListener("click", onConnectClick);
    el.searchInput.addEventListener("input", renderVolunteerList);

    el.commandBoard.addEventListener("click", onActionClick);
    el.volunteerDetail.addEventListener("click", onActionClick);
    el.studioPanel.addEventListener("click", onActionClick);
    el.volunteerList.addEventListener("click", onActionClick);
    el.volunteerList.addEventListener("click", onVolunteerListClick);

    el.volunteerForm.addEventListener("submit", onCreateVolunteer);
    el.sessionForm.addEventListener("submit", onCreateSession);
    el.feedbackForm.addEventListener("submit", onSubmitFeedback);
    el.reportForm.addEventListener("submit", onSubmitReport);
    el.attendanceForm.addEventListener("submit", onSubmitAttendance);
    el.editVolunteerForm.addEventListener("submit", onSaveVolunteerProfile);
    el.pulseForm.addEventListener("submit", onSubmitPulse);
    el.supportForm.addEventListener("submit", onSubmitSupportRequest);
    if (el.pulseSessionSelect) el.pulseSessionSelect.addEventListener("change", onPulseSessionChanged);

    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close]");
      if (!close) return;
      const dialogId = close.getAttribute("data-close");
      if (dialogId && el[dialogId] && typeof el[dialogId].close === "function") el[dialogId].close();
    });
  }

  function restoreSettings() {
    const savedUrl = safeGet(STORAGE.url);
    const savedKey = safeGet(STORAGE.key);
    const savedDomain = safeGet(STORAGE.domain);
    const savedPreview = safeGet(STORAGE.previewMode);
    const savedSimple = safeGet(STORAGE.simpleView);
    const savedGoal = safeGet(STORAGE.monthlyGoal);
    const savedPurpose = safeGet(STORAGE.volunteerPurpose);

    el.supaUrlInput.value = savedUrl || DEFAULT_SUPABASE.url;
    el.supaKeyInput.value = savedKey || DEFAULT_SUPABASE.anonKey;
    el.allowedDomainInput.value = savedDomain || "";
    state.previewMode = savedPreview === null ? true : savedPreview === "1";
    state.simpleView = savedSimple === null ? true : savedSimple === "1";
    state.monthlyGoal = [1, 2, 4].includes(Number(savedGoal)) ? Number(savedGoal) : 2;
    state.volunteerPurpose = ["community", "coaching", "skills", "social"].includes(String(savedPurpose || ""))
      ? String(savedPurpose)
      : "community";

    if (!savedUrl) safeSet(STORAGE.url, DEFAULT_SUPABASE.url);
    if (!savedKey) safeSet(STORAGE.key, DEFAULT_SUPABASE.anonKey);
    if (savedPreview === null) safeSet(STORAGE.previewMode, "1");
    if (savedSimple === null) safeSet(STORAGE.simpleView, "1");
    if (!savedGoal) safeSet(STORAGE.monthlyGoal, "2");
    if (!savedPurpose) safeSet(STORAGE.volunteerPurpose, "community");
  }

  function onToggleSimpleView() {
    state.simpleView = !state.simpleView;
    safeSet(STORAGE.simpleView, state.simpleView ? "1" : "0");
    renderAll();
  }

  async function onTogglePreviewMode() {
    state.previewMode = !state.previewMode;
    safeSet(STORAGE.previewMode, state.previewMode ? "1" : "0");
    await reconnectAndReload();
    setBackendStatus(state.previewMode ? "Preview mode active (local demo data)." : "Live mode active.", "ok");
  }

  async function onConnectClick() {
    safeSet(STORAGE.url, String(el.supaUrlInput.value || "").trim());
    safeSet(STORAGE.key, String(el.supaKeyInput.value || "").trim());
    safeSet(STORAGE.domain, normalizeDomain(el.allowedDomainInput.value));
    await reconnectAndReload();
    if (el.settingsDialog.open) el.settingsDialog.close();
  }

  async function reconnectAndReload() {
    detachAuthSubscription();
    await connectSupabase();
    if (!state.previewMode) {
      await refreshSession();
      await ensureAccountProvisioned();
      await loadProfile();
    } else {
      state.user = null;
      state.profile = null;
    }
    await loadAllData();
    if (!state.previewMode) attachAuthSubscription();
    renderAll();
  }

  async function connectSupabase() {
    const url = String(safeGet(STORAGE.url) || "").trim();
    const key = String(safeGet(STORAGE.key) || "").trim();

    if (!url || !key) {
      state.supabase = null;
      setBackendStatus("Set Supabase URL and anon key in Settings.", "err");
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
          storageKey: "mk_volunteer_ops_auth_v3"
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
      if (state.previewMode) return;
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
    if (state.previewMode) {
      state.user = null;
      state.profile = null;
      return;
    }
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
    if (state.previewMode) return;
    if (state.syncInFlight) {
      state.syncRequested = true;
      return;
    }
    state.syncInFlight = true;
    try {
      await ensureAccountProvisioned();
      await loadProfile();
      await loadAllData();
    } catch (error) {
      const text = errorText(error, "Sync failed");
      if (isAuthLockError(text)) setBackendStatus("Session sync busy in another tab. Close duplicate tabs to avoid auth lock conflicts.", "warn");
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
    if (state.previewMode || !state.user || !state.supabase) return;
    const suggestedName = String(state.user.email || "member").split("@")[0];
    const response = await rpc("ops_bootstrap_admin_setup", { p_display_name: suggestedName }, 20000);
    if (response.error && looksLikeMissingSetup(response.error.message || response.error)) {
      setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
    }
  }

  async function loadProfile() {
    if (state.previewMode) {
      state.profile = {
        user_id: "preview-user",
        email: "preview@local",
        display_name: "Preview Volunteer",
        role: "member",
        status: "approved",
        volunteer_id: state.profile && state.profile.volunteer_id ? state.profile.volunteer_id : null
      };
      return;
    }

    if (!state.user || !state.supabase) {
      state.profile = null;
      return;
    }

    let response = null;
    try {
      response = await state.supabase
        .from("ops_profiles")
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
      } else {
        setBackendStatus("Profile load issue: " + message, "err");
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
    if (state.previewMode) {
      state.loading = false;
      loadPreviewData();
      return;
    }

    if (!state.supabase) {
      state.volunteers = [];
      state.sessions = [];
      state.assignments = [];
      state.commitments = [];
      state.attendance = [];
      state.feedback = [];
      state.sessionPulses = [];
      state.supportRequests = [];
      state.metricsRows = [];
      state.metricsByVolunteer = {};
      return;
    }

    state.loading = true;
    renderAll();

    try {
      const [
        volunteersResponse,
        sessionsResponse,
        assignmentsResponse,
        commitmentsResponse,
        attendanceResponse,
        feedbackResponse,
        pulsesResponse,
        supportResponse,
        metricsResponse
      ] = await Promise.all([
        state.supabase.from("ops_volunteers")
          .select("id,owner_user_id,display_name,tagline,bio,active,created_at")
          .eq("active", true)
          .order("display_name", { ascending: true }),
        state.supabase.from("ops_sessions")
          .select("id,title,starts_at,required_volunteers,status,role_brief,arrival_note,backup_plan,created_at")
          .order("starts_at", { ascending: true }),
        state.supabase.from("ops_session_assignments")
          .select("session_id,volunteer_id"),
        state.supabase.from("ops_commitments")
          .select("session_id,volunteer_id,status,note,plan_leave_at,last_check_in_at,updated_at"),
        state.supabase.from("ops_attendance")
          .select("session_id,volunteer_id,outcome,note,marked_at"),
        state.supabase.from("ops_feedback")
          .select("id,session_id,volunteer_id,reviewer_user_id,rating,feedback_type,note,created_at")
          .order("created_at", { ascending: false })
          .limit(900),
        state.supabase.from("ops_session_pulses")
          .select("id,session_id,volunteer_id,clarity_rating,support_rating,stress_rating,note,created_by_user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(1200),
        state.supabase.from("ops_support_requests")
          .select("id,volunteer_id,session_id,request_type,urgency,details,status,resolution_note,created_by_user_id,resolved_by_user_id,created_at,resolved_at")
          .order("created_at", { ascending: false })
          .limit(1200),
        state.supabase.from("ops_volunteer_metrics")
          .select("*")
      ]);

      const errors = [
        volunteersResponse.error,
        sessionsResponse.error,
        assignmentsResponse.error,
        commitmentsResponse.error,
        attendanceResponse.error,
        feedbackResponse.error,
        pulsesResponse.error,
        supportResponse.error,
        metricsResponse.error
      ].filter(Boolean);

      if (errors.length) {
        const firstMessage = errorText(errors[0], "Data load failed");
        if (looksLikeMissingSetup(firstMessage)) {
          setBackendStatus("Run supabase/all_in_one_setup.sql in Supabase SQL Editor.", "err");
        } else {
          setBackendStatus("Data load issue: " + firstMessage, "err");
        }
      }

      state.volunteers = volunteersResponse.error ? [] : (volunteersResponse.data || []);
      state.sessions = sessionsResponse.error ? [] : (sessionsResponse.data || []);
      state.assignments = assignmentsResponse.error ? [] : (assignmentsResponse.data || []);
      state.commitments = commitmentsResponse.error ? [] : (commitmentsResponse.data || []);
      state.attendance = attendanceResponse.error ? [] : (attendanceResponse.data || []);
      state.feedback = feedbackResponse.error ? [] : (feedbackResponse.data || []);
      state.sessionPulses = pulsesResponse.error ? [] : (pulsesResponse.data || []);
      state.supportRequests = supportResponse.error ? [] : (supportResponse.data || []);
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
        setBackendStatus("Auth lock conflict detected. Close duplicate tabs or use Preview mode.", "warn");
      } else {
        setBackendStatus("Data load issue: " + text, "err");
      }
    } finally {
      state.loading = false;
    }
  }

  function renderAll() {
    renderHeader();
    renderCommandBoard();
    renderVolunteerList();
    renderVolunteerDetail();
    renderStudio();
  }

  function renderHeader() {
    const signedIn = Boolean(state.user);
    const admin = isAdmin();
    if (el.toggleSimpleBtn) el.toggleSimpleBtn.textContent = state.simpleView ? "Advanced view" : "Simple view";
    if (el.demoModeBtn) el.demoModeBtn.textContent = state.previewMode ? "Preview: On" : "Preview: Off";

    el.sendLinkBtn.style.display = state.previewMode ? "none" : (signedIn ? "none" : "");
    el.signOutBtn.style.display = state.previewMode ? "none" : (signedIn ? "" : "none");
    el.emailInput.disabled = state.previewMode || signedIn;
    el.startSetupBtn.style.display = (!state.previewMode && signedIn && !admin) ? "" : "none";
    el.addVolunteerBtn.style.display = admin ? "" : "none";
    el.addSessionBtn.style.display = admin ? "" : "none";

    if (state.previewMode) {
      el.emailInput.value = "Preview mode enabled";
      setStatus(el.authStatus, "Preview mode active. Volunteer experience loaded instantly, no login needed.", "ok");
      return;
    }

    if (signedIn) el.emailInput.value = state.user.email || "";
    else if (el.emailInput.value === "Preview mode enabled") el.emailInput.value = "";

    if (!signedIn) {
      setStatus(el.authStatus, "Sign in for live data, or keep Preview mode on to explore instantly.", "");
      return;
    }
    if (admin) {
      setStatus(el.authStatus, "Admin signed in: " + (state.user.email || "") + " • session coordinator mode", "ok");
      return;
    }

    const role = state.profile ? String(state.profile.role || "member") : "member";
    const status = state.profile ? String(state.profile.status || "pending") : "pending";
    const statusLine = status === "approved"
      ? "Signed in: " + (state.user.email || "") + " (" + role + ", approved)"
      : "Signed in: " + (state.user.email || "") + " (" + role + ", pending approval for live submissions)";
    setStatus(el.authStatus, statusLine, status === "approved" ? "ok" : "warn");
  }
  function renderCommandBoard() {
    if (state.loading) {
      el.commandBoard.innerHTML = '<div class="empty">Loading next actions...</div>';
      return;
    }
    if (state.simpleView) {
      renderSimpleCommandBoard();
      return;
    }

    const upcoming = upcomingSessions().slice(0, 8);
    const coverageRows = upcoming.map(sessionCoverageRow);
    const reminderRows = buildReminderQueue(coverageRows);
    const requiredTotal = coverageRows.reduce((sum, row) => sum + row.required, 0);
    const committedTotal = coverageRows.reduce((sum, row) => sum + row.committed, 0);
    const respondedTotal = coverageRows.reduce((sum, row) => sum + row.responded, 0);
    const assignedTotal = coverageRows.reduce((sum, row) => sum + row.assigned, 0);
    const coveragePct = requiredTotal ? Math.round((committedTotal / requiredTotal) * 100) : 0;
    const responsePct = assignedTotal ? Math.round((respondedTotal / assignedTotal) * 100) : 0;
    const avgSatisfaction = mean(state.feedback.map((row) => Number(row.rating || 0)));
    const avgSupportPulse = mean(state.sessionPulses.map((row) => Number(row.support_rating || 0)));
    const openSupportRequests = state.supportRequests
      .filter((row) => String(row.status || "open") === "open")
      .sort((a, b) => {
        const urgencyWeight = { urgent: 3, high: 2, normal: 1 };
        const wa = urgencyWeight[String(a.urgency || "normal")] || 1;
        const wb = urgencyWeight[String(b.urgency || "normal")] || 1;
        if (wa !== wb) return wb - wa;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

    if (!state.volunteers.length) {
      const actions = isAdmin()
        ? '<div class="inline-actions"><button type="button" data-action="open-volunteer-dialog">Add volunteer</button><button type="button" class="ghost" data-action="open-session-dialog">Add session</button></div>'
        : '<div class="inline-actions"><button type="button" class="ghost" data-action="open-settings">Settings</button></div>';
      el.commandBoard.innerHTML = [
        '<section class="metric-grid">',
        metricBox("Upcoming sessions", String(upcoming.length)),
        metricBox("Coverage", String(coveragePct) + "%"),
        metricBox("Response", String(responsePct) + "%"),
        metricBox("Avg support", avgSupportPulse ? avgSupportPulse.toFixed(2) : "0.00"),
        '</section>',
        '<div class="empty">No volunteers yet.' + actions + '</div>'
      ].join('');
      return;
    }

    const riskRows = state.volunteers
      .map((volunteer) => {
        const metric = metricFor(volunteer.id);
        const reasons = [];
        if (Number(metric.response_rate_pct || 0) < 70) reasons.push("low response");
        if (Number(metric.attendance_rate_pct || 100) < 80) reasons.push("attendance dip");
        if (Number(metric.feedback_count || 0) >= 3 && Number(metric.avg_rating || 0) < 3.8) reasons.push("rating dip");
        if (Number(metric.no_show_90d || 0) >= 2) reasons.push("repeat no-shows");
        if (Number(metric.open_support_count || 0) >= 1) reasons.push("support request open");
        if (Number(metric.pulse_count || 0) >= 2 && Number(metric.avg_support || 0) < 3) reasons.push("low support pulse");
        if (Number(metric.pulse_count || 0) >= 2 && Number(metric.avg_stress || 0) >= 4) reasons.push("high stress pulse");
        if (!reasons.length) return null;
        return { volunteer, metric, reasons };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.metric.reliability_score || 0) - Number(b.metric.reliability_score || 0))
      .slice(0, 5);

    const recognitionRows = state.volunteers
      .map((volunteer) => ({
        volunteer,
        metric: metricFor(volunteer.id),
        streak: showUpStreak(volunteer.id)
      }))
      .filter((row) => row.streak >= 3)
      .sort((a, b) => {
        if (b.streak !== a.streak) return b.streak - a.streak;
        return Number(b.metric.reliability_score || 0) - Number(a.metric.reliability_score || 0);
      })
      .slice(0, 4);

    const recoveryRows = state.volunteers
      .map((volunteer) => {
        const recentNoShows = recentNoShowCount(volunteer.id, 30);
        if (recentNoShows < 1) return null;
        return {
          volunteer,
          recentNoShows,
          pendingCount: pendingUpcomingResponses(volunteer.id)
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.recentNoShows !== a.recentNoShows) return b.recentNoShows - a.recentNoShows;
        return b.pendingCount - a.pendingCount;
      })
      .slice(0, 4);

    const pulseRiskRows = state.volunteers
      .map((volunteer) => {
        const metric = metricFor(volunteer.id);
        if (Number(metric.pulse_count || 0) < 1) return null;
        const support = Number(metric.avg_support || 0);
        const clarity = Number(metric.avg_clarity || 0);
        const stress = Number(metric.avg_stress || 0);
        if (support >= 3.5 && clarity >= 3.5 && stress <= 3.5) return null;
        return { volunteer, support, clarity, stress };
      })
      .filter(Boolean)
      .sort((a, b) => (a.support + a.clarity - a.stress) - (b.support + b.clarity - b.stress))
      .slice(0, 4);

    const topRows = state.volunteers
      .map((volunteer) => ({ volunteer, metric: metricFor(volunteer.id) }))
      .sort((a, b) => Number(b.metric.reliability_score || 0) - Number(a.metric.reliability_score || 0))
      .slice(0, 3);

    const coverageHtml = coverageRows.length
      ? coverageRows.map((row) => {
        const badge = row.gap > 0 ? '<span class="warnpill">Need ' + row.gap + '</span>' : '<span class="okpill">Covered</span>';
        const canMark = isAdmin() && new Date(row.starts_at).getTime() <= Date.now() + 3600000;
        const stageLabel = reminderStageLabel(row.starts_at);
        const nudgeButton = row.pendingIds.length
          ? '<button type="button" class="mini ghost" data-action="nudge-session" data-session-id="' + esc(row.id) + '" data-stage="' + esc(stageLabel || "Reminder") + '">Nudge pending</button>'
          : '';
        const attendanceButton = canMark
          ? '<button type="button" class="mini ghost" data-action="open-attendance" data-session-id="' + esc(row.id) + '">Mark attendance</button>'
          : '';
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.title) + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(row.starts_at)) + '</p>',
          '<p class="muted">Committed ' + row.committed + '/' + row.required + ' • Responded ' + row.responded + '/' + row.assigned + '</p>',
          '<div class="inline-actions">' + nudgeButton + attendanceButton + '</div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No upcoming sessions.<div class="inline-actions"><button type="button" class="ghost" data-action="open-session-dialog">Add session</button></div></div>';

    const remindersHtml = reminderRows.length
      ? reminderRows.map((row) => {
        const names = row.pendingIds.map((id) => volunteerNameById(id)).filter(Boolean).join(', ');
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.stageLabel) + ' • ' + esc(row.title) + '</p><span class="pill">' + esc(formatDateTime(row.starts_at)) + '</span></div>',
          '<p class="muted">Pending: ' + esc(names || 'none') + '</p>',
          '<div class="inline-actions"><button type="button" class="mini ghost" data-action="nudge-session" data-session-id="' + esc(row.id) + '" data-stage="' + esc(row.stageLabel) + '">Copy reminder</button></div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No reminders due now.</div>';

    const riskHtml = riskRows.length
      ? riskRows.map((row) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="warnpill">Reliability ' + Math.round(Number(row.metric.reliability_score || 0)) + '</span></div>',
        '<p class="muted">' + esc(row.reasons.join(' + ')) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="nudge-volunteer" data-volunteer-id="' + esc(row.volunteer.id) + '">Copy nudge</button></div>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">No high-risk volunteers right now.</div>';

    const recognitionHtml = recognitionRows.length
      ? recognitionRows.map((row) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="okpill">' + row.streak + ' session streak</span></div>',
        '<p class="muted">Reliable show-up run. Reinforce this momentum.</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="copy-recognition" data-volunteer-id="' + esc(row.volunteer.id) + '">Copy thank-you</button></div>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">No streak milestones yet.</div>';

    const recoveryHtml = recoveryRows.length
      ? recoveryRows.map((row) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="warnpill">' + row.recentNoShows + ' no-show in 30d</span></div>',
        '<p class="muted">Pending responses: ' + row.pendingCount + '. Send a direct check-in message.</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="copy-recovery" data-volunteer-id="' + esc(row.volunteer.id) + '">Copy recovery note</button></div>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">No no-show recovery actions due.</div>';

    const topHtml = topRows.length
      ? topRows.map((row, index) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + (index + 1) + '. ' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="okpill">Reliability ' + Math.round(Number(row.metric.reliability_score || 0)) + '</span></div>',
        '<p class="muted">' + stars(row.metric.avg_rating) + ' • attendance ' + Number(row.metric.attendance_rate_pct || 0) + '%</p>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">No data yet.</div>';

    const supportHtml = openSupportRequests.length
      ? openSupportRequests.slice(0, 6).map((row) => {
        const volunteer = state.volunteers.find((vol) => String(vol.id) === String(row.volunteer_id));
        const session = row.session_id ? sessionById(row.session_id) : null;
        const urgency = String(row.urgency || "normal");
        const urgencyBadge = urgency === "urgent" ? "warnpill" : (urgency === "high" ? "pill" : "okpill");
        const resolveBtn = isAdmin()
          ? '<button type="button" class="mini ghost" data-action="resolve-support" data-support-id="' + esc(row.id) + '">Resolve</button>'
          : "";
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(volunteer ? volunteer.display_name : "Volunteer") + '</p><span class="' + urgencyBadge + '">' + esc(urgency) + '</span></div>',
          session ? '<p class="muted">' + esc(session.title || "Session") + " • " + esc(formatDateTime(session.starts_at)) + '</p>' : '',
          '<p class="muted">' + esc(row.request_type || "support") + " • " + esc(formatDate(row.created_at)) + '</p>',
          '<p>' + esc(row.details || "") + '</p>',
          '<div class="inline-actions">' + resolveBtn + '</div>',
          '</article>'
        ].join('');
      }).join('')
      : '<div class="empty">No open support requests.</div>';

    const pulseRiskHtml = pulseRiskRows.length
      ? pulseRiskRows.map((row) => [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(row.volunteer.display_name || "Volunteer") + '</p><span class="pill">Pulse risk</span></div>',
        '<p class="muted">Clarity ' + row.clarity.toFixed(1) + ' • Support ' + row.support.toFixed(1) + ' • Stress ' + row.stress.toFixed(1) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="copy-recovery" data-volunteer-id="' + esc(row.volunteer.id) + '">Copy support outreach</button></div>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">Pulse trends look healthy.</div>';

    el.commandBoard.innerHTML = [
      '<section class="metric-grid">',
      metricBox("Upcoming sessions", String(upcoming.length)),
      metricBox("Coverage", String(coveragePct) + "%"),
      metricBox("Response", String(responsePct) + "%"),
      metricBox("Avg rating", avgSatisfaction ? avgSatisfaction.toFixed(2) : "0.00"),
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Coverage</h3><div class="rows">' + coverageHtml + '</div><h3>Reminder Queue</h3><div class="rows">' + remindersHtml + '</div></div>',
      '<div class="card"><h3>Risk Signals</h3><div class="rows">' + riskHtml + '</div><h3>Pulse Risks</h3><div class="rows">' + pulseRiskHtml + '</div><h3>Recognition</h3><div class="rows">' + recognitionHtml + '</div><h3>Recovery Follow-up</h3><div class="rows">' + recoveryHtml + '</div><h3>Support Queue</h3><div class="rows">' + supportHtml + '</div><h3>Top Reliability</h3><div class="rows">' + topHtml + '</div></div>',
      '</section>'
    ].join('');
  }

  function renderSimpleCommandBoard() {
    const upcoming = upcomingSessions().slice(0, 6);
    const coverageRows = upcoming.map(sessionCoverageRow);
    const openSupportCount = state.supportRequests.filter((row) => String(row.status || "open") === "open").length;
    const volunteersCount = state.volunteers.length;
    const myId = myVolunteerId();
    const actorId = state.user ? String(state.user.id) : "preview-user";
    const myVolunteer = myId ? state.volunteers.find((row) => String(row.id) === String(myId)) : null;

    if (myVolunteer) {
      const myUpcoming = upcomingSessionsForVolunteer(myVolunteer.id).slice(0, 4);
      const nextMine = myUpcoming[0] || null;
      const myPending = pendingUpcomingResponses(myVolunteer.id);
      const myHelped = countPositiveAttendance(myVolunteer.id);
      const myHelped30 = countPositiveAttendance(myVolunteer.id, 30);
      const myStreak = showUpStreak(myVolunteer.id);
      const praiseCount = feedbackForVolunteer(myVolunteer.id).filter((row) => Number(row.rating || 0) >= 4).length;
      const milestone = volunteerMilestone(myHelped);
      const checkInNow = myUpcoming.find((session) => {
        const commitment = commitmentFor(myVolunteer.id, session.id);
        return commitment && String(commitment.status || "") === "committed" && !commitment.last_check_in_at && withinCheckInWindow(session.starts_at);
      }) || null;
      const pulsePending = pastSessionsForVolunteer(myVolunteer.id).find((session) => !pulseFor(myVolunteer.id, session.id, actorId)) || null;
      const openShift = upcomingSessions().find((session) => !assignedVolunteerIds(session.id).includes(String(myVolunteer.id))) || null;
      const monthlyGoal = Number(state.monthlyGoal || 2);
      const goalRemaining = Math.max(0, monthlyGoal - myHelped30);
      const paceLine = goalRemaining > 0
        ? (goalRemaining + " more this month to hit your personal goal")
        : "Personal monthly goal achieved";
      const purpose = purposeSummary(state.volunteerPurpose);
      const goalButtons = [
        '<button type="button" class="mini' + (monthlyGoal === 1 ? "" : " ghost") + '" data-action="set-goal" data-goal="1">1/mo</button>',
        '<button type="button" class="mini' + (monthlyGoal === 2 ? "" : " ghost") + '" data-action="set-goal" data-goal="2">2/mo</button>',
        '<button type="button" class="mini' + (monthlyGoal === 4 ? "" : " ghost") + '" data-action="set-goal" data-goal="4">Weekly</button>'
      ].join("");
      const purposeButtons = [
        '<button type="button" class="mini' + (state.volunteerPurpose === "community" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="community">Community</button>',
        '<button type="button" class="mini' + (state.volunteerPurpose === "coaching" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="coaching">Coaching</button>',
        '<button type="button" class="mini' + (state.volunteerPurpose === "skills" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="skills">Skills</button>',
        '<button type="button" class="mini' + (state.volunteerPurpose === "social" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="social">Social</button>'
      ].join("");

      let actionHtml = '<div class="empty">You are up to date. Keep your momentum going.</div>';
      if (checkInNow) {
        actionHtml = [
          '<article class="row">',
          '<div class="row-top"><p class="headline">Check in now</p><span class="warnpill">Now</span></div>',
          '<p class="muted">' + esc(checkInNow.title || "Session") + " • " + esc(formatDateTime(checkInNow.starts_at)) + '</p>',
          '<div class="inline-actions"><button type="button" class="mini" data-action="check-in-session" data-session-id="' + esc(checkInNow.id) + '">I\'m on my way</button></div>',
          '</article>'
        ].join("");
      } else if (myPending > 0 && nextMine) {
        actionHtml = [
          '<article class="row">',
          '<div class="row-top"><p class="headline">Confirm your next session</p><span class="pill">Pending</span></div>',
          '<p class="muted">' + esc(nextMine.title || "Session") + " • " + esc(formatDateTime(nextMine.starts_at)) + '</p>',
          '<div class="inline-actions"><button type="button" class="mini" data-action="set-commitment" data-session-id="' + esc(nextMine.id) + '" data-status="committed">I can make it</button><button type="button" class="mini ghost" data-action="set-commitment" data-session-id="' + esc(nextMine.id) + '" data-status="unavailable">Can\'t make it</button></div>',
          '</article>'
        ].join("");
      } else if (pulsePending) {
        actionHtml = [
          '<article class="row">',
          '<div class="row-top"><p class="headline">Submit your quick pulse</p><span class="pill">1 min</span></div>',
          '<p class="muted">' + esc(pulsePending.title || "Session") + " • " + esc(formatDate(pulsePending.starts_at)) + '</p>',
          '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-pulse-dialog" data-session-id="' + esc(pulsePending.id) + '">Submit pulse</button></div>',
          '</article>'
        ].join("");
      }

      const momentumLine = milestone.remaining > 0
        ? (milestone.remaining + " more session(s) to reach " + milestone.nextLabel)
        : ("You are at " + milestone.currentLabel + " level");
      const membersHelped = impactEstimate(myHelped);
      const shiftHtml = openShift
        ? '<article class="row"><div class="row-top"><p class="headline">' + esc(openShift.title || "Session") + '</p><span class="pill">' + esc(formatDateTime(openShift.starts_at)) + '</span></div><div class="inline-actions"><button type="button" class="mini ghost" data-action="take-open-shift" data-session-id="' + esc(openShift.id) + '">Take this shift</button></div></article>'
        : '<div class="empty">No open shifts right now.</div>';

      el.commandBoard.innerHTML = [
        '<section class="card">',
        '<div class="row-top"><p class="headline">Welcome back, ' + esc(myVolunteer.display_name || "Volunteer") + '</p><span class="score">' + esc(milestone.currentLabel) + '</span></div>',
        '<p class="muted">Purpose: ' + esc(purpose.title) + ". " + esc(purpose.body) + '</p>',
        '<p class="muted">You have supported about ' + membersHelped + ' member visits.' + (praiseCount > 0 ? (" " + praiseCount + " positive note(s) received.") : "") + '</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-support-dialog">Need support</button>' + goalButtons + '</div>',
        '<div class="inline-actions">' + purposeButtons + '</div>',
        '</section>',
        '<section class="grid2"><div class="card"><h3>Your Next Best Action</h3><div class="rows">' + actionHtml + '</div></div><div class="card"><h3>Progress</h3><div class="rows"><article class="row"><div class="row-top"><p class="headline">' + esc(momentumLine) + '</p><span class="okpill">' + myHelped + '/' + milestone.nextTarget + '</span></div><p class="muted">' + esc(paceLine) + '</p></article></div></div></section>',
        '<section class="metric-grid">',
        metricBox("Sessions helped", String(myHelped)),
        metricBox("This month", String(myHelped30)),
        metricBox("Streak", String(myStreak)),
        metricBox("Upcoming", String(myUpcoming.length)),
        '</section>',
        '<section class="card"><h3>Optional Extra Shift</h3><div class="rows">' + shiftHtml + '</div></section>'
      ].join("");
      return;
    }

    const steps = [
      {
        label: "Add volunteers",
        done: volunteersCount > 0,
        text: volunteersCount > 0 ? (volunteersCount + " volunteer(s) added") : (isAdmin() ? "No volunteers yet" : "Waiting for coordinator to add profiles"),
        action: isAdmin() ? '<button type="button" class="mini" data-action="open-volunteer-dialog">Add volunteer</button>' : '<button type="button" class="mini ghost" data-action="open-settings">Settings</button>'
      },
      {
        label: "Create upcoming sessions",
        done: upcoming.length > 0,
        text: upcoming.length > 0 ? (upcoming.length + " upcoming session(s)") : "No upcoming sessions",
        action: isAdmin() ? '<button type="button" class="mini ghost" data-action="open-session-dialog">Add session</button>' : ""
      },
      {
        label: "Claim volunteer profile",
        done: Boolean(myId),
        text: myId ? "Profile linked" : "Needed for volunteer studio actions",
        action: !myId && state.selectedVolunteerId ? '<button type="button" class="mini ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(state.selectedVolunteerId) + '">Claim profile</button>' : ""
      }
    ];

    const stepsHtml = steps.map((step, idx) => [
      '<article class="row">',
      '<div class="row-top"><p class="headline">' + (idx + 1) + ". " + esc(step.label) + '</p>' + (step.done ? '<span class="okpill">Done</span>' : '<span class="pill">Pending</span>') + '</div>',
      '<p class="muted">' + esc(step.text) + '</p>',
      '<div class="inline-actions">' + step.action + '</div>',
      '</article>'
    ].join("")).join("");

    const todayRowsHtml = coverageRows.length
      ? coverageRows.slice(0, 4).map((row) => {
        const badge = row.gap > 0 ? '<span class="warnpill">Need ' + row.gap + '</span>' : '<span class="okpill">Covered</span>';
        const nudges = row.pendingIds.length
          ? '<button type="button" class="mini ghost" data-action="nudge-session" data-session-id="' + esc(row.id) + '" data-stage="Reminder">Nudge pending</button>'
          : "";
        const attendance = isAdmin() && new Date(row.starts_at).getTime() <= Date.now() + 3600000
          ? '<button type="button" class="mini ghost" data-action="open-attendance" data-session-id="' + esc(row.id) + '">Mark attendance</button>'
          : "";
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(row.title) + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(row.starts_at)) + '</p>',
          '<p class="muted">Committed ' + row.committed + "/" + row.required + " • Pending " + row.pendingIds.length + '</p>',
          '<div class="inline-actions">' + nudges + attendance + '</div>',
          '</article>'
        ].join("");
      }).join("")
      : '<div class="empty">No sessions yet. Create one to start coordination.</div>';

    const nextAction = !volunteersCount
      ? "Start by adding your first volunteer profile."
      : !upcoming.length
        ? "Next: create the next chess session so volunteers can commit."
        : openSupportCount > 0
          ? "You have open support requests. Resolve these first to protect volunteer retention."
          : "Next: nudge pending volunteers and keep commitments up to date.";

    el.commandBoard.innerHTML = [
      '<section class="card">',
      '<h3>What To Do Next</h3>',
      '<p class="muted">' + esc(nextAction) + '</p>',
      '<div class="rows">' + stepsHtml + '</div>',
      '</section>',
      '<section class="metric-grid">',
      metricBox("Volunteers", String(volunteersCount)),
      metricBox("Upcoming", String(upcoming.length)),
      metricBox("Open support", String(openSupportCount)),
      metricBox("Preview mode", state.previewMode ? "On" : "Off"),
      '</section>',
      '<section class="card"><h3>Sessions Needing Attention</h3><div class="rows">' + todayRowsHtml + '</div></section>'
    ].join("");
  }

  function renderVolunteerList() {
    const selfFocus = state.simpleView && Boolean(myVolunteerId()) && !isAdmin();
    if (el.searchInput) {
      el.searchInput.placeholder = selfFocus ? "Your panel" : (state.simpleView ? "Find volunteer" : "Search volunteers");
      el.searchInput.style.display = selfFocus ? "none" : "";
    }
    if (state.loading) {
      el.volunteerList.innerHTML = '<div class="empty">Loading volunteers...</div>';
      return;
    }
    if (state.simpleView) {
      renderSimpleVolunteerList();
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
    if (state.simpleView) {
      renderSimpleVolunteerDetail(volunteer);
      return;
    }

    const metric = metricFor(volunteer.id);
    const upcoming = upcomingSessionsForVolunteer(volunteer.id).slice(0, 6);
    const feedbackRows = feedbackForVolunteer(volunteer.id).slice(0, 8);
    const pulseRows = pulsesForVolunteer(volunteer.id);
    const streak = showUpStreak(volunteer.id);
    const pendingCount = pendingUpcomingResponses(volunteer.id);
    const pulseSupport = pulseRows.length ? mean(pulseRows.map((row) => Number(row.support_rating || 0))) : 0;
    const pulseClarity = pulseRows.length ? mean(pulseRows.map((row) => Number(row.clarity_rating || 0))) : 0;
    const pulseStress = pulseRows.length ? mean(pulseRows.map((row) => Number(row.stress_rating || 0))) : 0;
    const myId = myVolunteerId();
    const actorUserId = state.user ? String(state.user.id) : "preview-user";
    const canClaim = (state.previewMode || Boolean(state.user)) && !myId && !volunteer.owner_user_id;
    const canLeaveFeedback = (state.previewMode || Boolean(state.user)) && isApprovedMember() && pastSessionsForVolunteer(volunteer.id).length > 0;
    const canReport = (state.previewMode || Boolean(state.user)) && isApprovedMember() && (!volunteer.owner_user_id || String(volunteer.owner_user_id) !== actorUserId);
    const canEdit = isAdmin() || String(volunteer.owner_user_id || "") === actorUserId;

    const feedbackButton = canLeaveFeedback ? '<button type="button" class="mini" data-action="open-feedback" data-volunteer-id="' + esc(volunteer.id) + '">Leave feedback</button>' : '';
    const reportButton = canReport ? '<button type="button" class="mini ghost" data-action="open-report" data-volunteer-id="' + esc(volunteer.id) + '">Report issue</button>' : '';
    const claimButton = canClaim ? '<button type="button" class="mini ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Claim profile</button>' : '';
    const nudgeButton = isAdmin() ? '<button type="button" class="mini ghost" data-action="nudge-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Copy nudge</button>' : '';
    const editButton = canEdit ? '<button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button>' : '';

    const upcomingHtml = upcoming.length
      ? upcoming.map((session) => {
        const commitment = commitmentFor(volunteer.id, session.id);
        const status = commitment ? String(commitment.status || "") : "";
        const badge = status === "committed" ? '<span class="okpill">Committed</span>' : status === "unavailable" ? '<span class="warnpill">Unavailable</span>' : '<span class="pill">No response</span>';
        const plan = commitment && commitment.plan_leave_at ? "Leave " + formatTime(commitment.plan_leave_at) : "";
        const checkin = commitment && commitment.last_check_in_at ? "Checked in " + formatDateTime(commitment.last_check_in_at) : "";
        const roleLine = [session.role_brief || "", session.arrival_note || "", session.backup_plan || ""].filter(Boolean).join(" • ");
        const line = [plan, checkin].filter(Boolean).join(" • ");
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(session.starts_at)) + '</p>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
          line ? '<p class="muted">' + esc(line) + '</p>' : '',
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

    el.volunteerDetail.innerHTML = [
      '<section class="hero">',
      '<div class="hero-top">',
      '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
      '<div><h2>' + esc(volunteer.display_name || 'Volunteer') + '</h2><p class="muted">' + esc(volunteer.tagline || volunteer.bio || '') + '</p></div>',
      '<div class="inline-actions">' + feedbackButton + reportButton + claimButton + editButton + nudgeButton + '</div>',
      '</div>',
      '<div class="chips"><span class="chip">Reliability ' + Math.round(Number(metric.reliability_score || 0)) + '</span><span class="chip">Attendance ' + Number(metric.attendance_rate_pct || 0) + '%</span><span class="chip">Response ' + Number(metric.response_rate_pct || 0) + '%</span><span class="chip">Rating ' + Number(metric.avg_rating || 0).toFixed(2) + '</span><span class="chip">Streak ' + streak + '</span><span class="chip">Pending ' + pendingCount + '</span><span class="chip">Open support ' + Number(metric.open_support_count || 0) + '</span><span class="chip">Pulse support ' + (pulseSupport ? pulseSupport.toFixed(2) : "0.00") + '</span><span class="chip">Pulse clarity ' + (pulseClarity ? pulseClarity.toFixed(2) : "0.00") + '</span><span class="chip">Pulse stress ' + (pulseStress ? pulseStress.toFixed(2) : "0.00") + '</span></div>',
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Upcoming Commitments</h3><div class="rows">' + upcomingHtml + '</div></div>',
      '<div class="card"><h3>Recent Feedback</h3><div class="reviews">' + feedbackHtml + '</div></div>',
      '</section>'
    ].join('');
  }

  function renderSimpleVolunteerDetail(volunteer) {
    const metric = metricFor(volunteer.id);
    const actorUserId = state.user ? String(state.user.id) : "preview-user";
    const myId = myVolunteerId();
    const isMine = Boolean(myId) && String(myId) === String(volunteer.id);
    const canClaim = (state.previewMode || Boolean(state.user)) && !myId && !volunteer.owner_user_id;
    const canLeaveFeedback = (state.previewMode || Boolean(state.user)) && isApprovedMember() && pastSessionsForVolunteer(volunteer.id).length > 0;
    const canReport = (state.previewMode || Boolean(state.user)) && isApprovedMember() && (!volunteer.owner_user_id || String(volunteer.owner_user_id) !== actorUserId);
    const canEdit = isAdmin() || String(volunteer.owner_user_id || "") === actorUserId;
    const nextSession = upcomingSessionsForVolunteer(volunteer.id)[0] || null;
    const upcomingCount = upcomingSessionsForVolunteer(volunteer.id).length;
    const streak = showUpStreak(volunteer.id);
    const helpedCount = countPositiveAttendance(volunteer.id);
    const helped30 = countPositiveAttendance(volunteer.id, 30);
    const monthlyGoal = Number(state.monthlyGoal || 2);
    const goalRemaining = Math.max(0, monthlyGoal - helped30);
    const praiseRows = feedbackForVolunteer(volunteer.id).filter((row) => Number(row.rating || 0) >= 4).slice(0, 3);
    const milestone = volunteerMilestone(helpedCount);
    const purpose = purposeSummary(state.volunteerPurpose);

    const feedbackButton = canLeaveFeedback ? '<button type="button" class="mini" data-action="open-feedback" data-volunteer-id="' + esc(volunteer.id) + '">Leave feedback</button>' : '';
    const reportButton = canReport ? '<button type="button" class="mini ghost" data-action="open-report" data-volunteer-id="' + esc(volunteer.id) + '">Report issue</button>' : '';
    const claimButton = canClaim ? '<button type="button" class="mini ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Claim profile</button>' : '';
    const editButton = canEdit ? '<button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button>' : '';

    const nextCommitment = nextSession ? commitmentFor(volunteer.id, nextSession.id) : null;
    const nextStatus = nextCommitment ? String(nextCommitment.status || "") : "pending";
    const nextBadge = nextStatus === "committed"
      ? '<span class="okpill">Committed</span>'
      : nextStatus === "unavailable"
        ? '<span class="warnpill">Unavailable</span>'
        : '<span class="pill">Pending</span>';
    const checkInOpen = nextSession && nextStatus === "committed" && withinCheckInWindow(nextSession.starts_at);
    const nextButtons = isMine && nextSession
      ? '<div class="inline-actions"><button type="button" class="mini' + (nextStatus === "committed" ? "" : " ghost") + '" data-action="set-commitment" data-session-id="' + esc(nextSession.id) + '" data-status="committed">I can make it</button><button type="button" class="mini' + (nextStatus === "unavailable" ? "" : " ghost") + '" data-action="set-commitment" data-session-id="' + esc(nextSession.id) + '" data-status="unavailable">Can\'t make it</button>' + (checkInOpen ? '<button type="button" class="mini ghost" data-action="check-in-session" data-session-id="' + esc(nextSession.id) + '">I\'m on my way</button>' : '') + '</div>'
      : "";

    const nextSessionHtml = nextSession
      ? [
        '<article class="row">',
        '<div class="row-top"><p class="headline">' + esc(nextSession.title || "Session") + '</p><span class="pill">' + esc(formatDateTime(nextSession.starts_at)) + '</span></div>',
        '<div class="row-top"><p class="muted">' + esc([nextSession.role_brief || "", nextSession.arrival_note || "", nextSession.backup_plan || ""].filter(Boolean).join(" • ")) + '</p>' + nextBadge + '</div>',
        nextButtons,
        '</article>'
      ].join("")
      : '<div class="empty">No upcoming session assigned.</div>';

    const praiseHtml = praiseRows.length
      ? praiseRows.map((row) => {
        const session = sessionById(row.session_id);
        const note = String(row.note || "").trim() || "Great support at this session.";
        return [
          '<article class="review">',
          '<div class="row-top"><p class="muted">' + esc(session ? session.title : "Session") + '</p><p class="muted">' + stars(row.rating) + '</p></div>',
          '<p>' + esc(note) + '</p>',
          '</article>'
        ].join("");
      }).join("")
      : '<div class="empty">No praise notes yet.</div>';

    if (isMine && !isAdmin()) {
      const membersHelped = impactEstimate(helpedCount);
      el.volunteerDetail.innerHTML = [
        '<section class="card">',
        '<div class="row-top"><p class="headline">Your Impact</p><span class="score">' + esc(milestone.currentLabel) + '</span></div>',
        '<p class="muted">You have supported about ' + membersHelped + ' member visits so far.</p>',
        '<p class="muted">Focus: ' + esc(purpose.title) + '. ' + esc(purpose.body) + '</p>',
        '<section class="metric-grid">' + metricBox("Sessions", String(helpedCount)) + metricBox("This month", String(helped30)) + metricBox("Streak", String(streak)) + metricBox("Rating", Number(metric.avg_rating || 0).toFixed(2)) + '</section>',
        '<p class="muted">' + esc(goalRemaining > 0 ? (goalRemaining + " more this month to hit your goal.") : "Monthly goal achieved. Great consistency.") + '</p>',
        '</section>',
        '<section class="card"><h3>Recent Thanks</h3><div class="reviews">' + praiseHtml + '</div></section>'
      ].join("");
      return;
    }

    el.volunteerDetail.innerHTML = [
      '<section class="card">',
      '<div class="row-top"><p class="headline">' + esc(volunteer.display_name || "Volunteer") + '</p><span class="score">Reliability ' + Math.round(Number(metric.reliability_score || 0)) + '</span></div>',
      '<p class="muted">' + esc(volunteer.tagline || volunteer.bio || "Volunteer profile") + '</p>',
      '<div class="inline-actions">' + feedbackButton + reportButton + claimButton + editButton + '</div>',
      '</section>',
      '<section class="metric-grid">',
      metricBox("Sessions helped", String(helpedCount)),
      metricBox("Streak", String(streak)),
      metricBox("Rating", Number(metric.avg_rating || 0).toFixed(2)),
      metricBox("Upcoming", String(upcomingCount)),
      '</section>',
      '<section class="card"><h3>Next Session</h3><div class="rows">' + nextSessionHtml + '</div></section>',
      '<section class="card"><h3>Recent Praise</h3><div class="reviews">' + praiseHtml + '</div></section>'
    ].join("");
  }

  function renderStudio() {
    if (state.loading) {
      el.studioPanel.innerHTML = '<div class="empty">Loading studio...</div>';
      return;
    }
    if (!state.user && !state.previewMode) {
      el.studioPanel.innerHTML = '<div class="empty">Sign in to open your volunteer studio.</div>';
      return;
    }

    const volunteerId = myVolunteerId();
    if (!volunteerId) {
      const claimHelp = state.selectedVolunteerId
        ? '<div class="inline-actions"><button type="button" class="ghost" data-action="claim-volunteer" data-volunteer-id="' + esc(state.selectedVolunteerId) + '">Claim selected profile</button></div>'
        : '<p class="muted">Ask the coordinator to add your volunteer profile, then claim it here.</p>';
      el.studioPanel.innerHTML = '<div class="empty">No linked volunteer profile yet.' + claimHelp + '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-settings">Settings</button></div></div>';
      return;
    }

    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) {
      el.studioPanel.innerHTML = '<div class="empty">Linked volunteer profile not found.</div>';
      return;
    }
    if (state.simpleView) {
      renderSimpleStudio(volunteerId, volunteer);
      return;
    }

    const metric = metricFor(volunteerId);
    const upcoming = upcomingSessionsForVolunteer(volunteerId).slice(0, 10);
    const openShifts = upcomingSessions()
      .filter((session) => !assignedVolunteerIds(session.id).includes(String(volunteerId)))
      .slice(0, 8);
    const pastAssigned = pastSessionsForVolunteer(volunteerId).slice(0, 12);
    const actorId = state.user ? String(state.user.id) : "preview-user";
    const pendingPulseSessions = pastAssigned.filter((session) => !pulseFor(volunteerId, session.id, actorId)).slice(0, 6);
    const streak = showUpStreak(volunteerId);
    const pendingCount = pendingUpcomingResponses(volunteerId);
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
        '<h3>Action Now</h3>',
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
        '<h3>Action Now</h3>',
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
        '<h3>Action Now</h3>',
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

        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span></div>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
          planLine ? '<p class="muted">' + esc(planLine) + '</p>' : '',
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
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || "Session") + '</p><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span></div>',
          roleLine ? '<p class="muted">' + esc(roleLine) + '</p>' : '',
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

    const mySupportRows = state.supportRequests
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 6);
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

    el.studioPanel.innerHTML = [
      '<section class="hero">',
      '<div class="hero-top">',
      '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
      '<div><h2>My Studio</h2><p class="muted">' + esc(volunteer.display_name || 'Volunteer') + '</p></div>',
      '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button><button type="button" class="mini ghost" data-action="open-support-dialog">Need support</button><button type="button" class="mini ghost" data-action="open-pulse-dialog">Session pulse</button></div>',
      '</div>',
      '<div class="chips"><span class="chip">Reliability ' + Math.round(Number(metric.reliability_score || 0)) + '</span><span class="chip">Attendance ' + Number(metric.attendance_rate_pct || 0) + '%</span><span class="chip">Response ' + Number(metric.response_rate_pct || 0) + '%</span><span class="chip">Rating ' + Number(metric.avg_rating || 0).toFixed(2) + '</span><span class="chip">Streak ' + streak + '</span><span class="chip">Pending ' + pendingCount + '</span><span class="chip">Open support ' + Number(metric.open_support_count || 0) + '</span></div>',
      '</section>',
      actionCardHtml,
      '<section class="card"><h3>Upcoming Sessions</h3><div class="rows">' + rowsHtml + '</div></section>',
      '<section class="grid2"><div class="card"><h3>Open Shifts You Can Take</h3><div class="rows">' + openShiftHtml + '</div></div><div class="card"><h3>Post-Session Pulse Backlog</h3><div class="rows">' + pulseBacklogHtml + '</div></div></section>',
      '<section class="card"><h3>My Support Requests</h3><div class="rows">' + mySupportHtml + '</div></section>'
    ].join('');
  }

  function renderSimpleStudio(volunteerId, volunteer) {
    const metric = metricFor(volunteerId);
    const upcoming = upcomingSessionsForVolunteer(volunteerId).slice(0, 4);
    const checkInNow = upcoming.find((session) => {
      const commitment = commitmentFor(volunteerId, session.id);
      return commitment && String(commitment.status || "") === "committed" && !commitment.last_check_in_at && withinCheckInWindow(session.starts_at);
    }) || null;
    const firstPending = upcoming.find((session) => !commitmentFor(volunteerId, session.id)) || null;
    const actorId = state.user ? String(state.user.id) : "preview-user";
    const pulsePending = pastSessionsForVolunteer(volunteerId).find((session) => !pulseFor(volunteerId, session.id, actorId)) || null;
    const openShift = upcomingSessions().find((session) => !assignedVolunteerIds(session.id).includes(String(volunteerId))) || null;
    const helpedTotal = countPositiveAttendance(volunteerId);
    const helped30 = countPositiveAttendance(volunteerId, 30);
    const streak = showUpStreak(volunteerId);
    const praiseRows = feedbackForVolunteer(volunteerId).filter((row) => Number(row.rating || 0) >= 4).slice(0, 2);
    const praiseCount = feedbackForVolunteer(volunteerId).filter((row) => Number(row.rating || 0) >= 4).length;
    const pending = pendingUpcomingResponses(volunteerId);
    const milestone = volunteerMilestone(helpedTotal);
    const badges = volunteerBadges(metric, streak, helpedTotal, praiseCount).slice(0, 3);
    const monthlyGoal = Number(state.monthlyGoal || 2);
    const goalRemaining = Math.max(0, monthlyGoal - helped30);
    const purpose = purposeSummary(state.volunteerPurpose);
    const membersHelped = impactEstimate(helpedTotal);
    const goalButtons = [
      '<button type="button" class="mini' + (monthlyGoal === 1 ? "" : " ghost") + '" data-action="set-goal" data-goal="1">1/mo</button>',
      '<button type="button" class="mini' + (monthlyGoal === 2 ? "" : " ghost") + '" data-action="set-goal" data-goal="2">2/mo</button>',
      '<button type="button" class="mini' + (monthlyGoal === 4 ? "" : " ghost") + '" data-action="set-goal" data-goal="4">Weekly</button>'
    ].join("");
    const purposeButtons = [
      '<button type="button" class="mini' + (state.volunteerPurpose === "community" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="community">Community</button>',
      '<button type="button" class="mini' + (state.volunteerPurpose === "coaching" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="coaching">Coaching</button>',
      '<button type="button" class="mini' + (state.volunteerPurpose === "skills" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="skills">Skills</button>',
      '<button type="button" class="mini' + (state.volunteerPurpose === "social" ? "" : " ghost") + '" data-action="set-purpose" data-purpose="social">Social</button>'
    ].join("");

    let actionHtml = '<div class="empty">You are up to date. Keep your momentum going.</div>';
    if (checkInNow) {
      actionHtml = [
        '<article class="row">',
        '<div class="row-top"><p class="headline">Check in now</p><span class="warnpill">Now</span></div>',
        '<p class="muted">' + esc(checkInNow.title || "Session") + " • " + esc(formatDateTime(checkInNow.starts_at)) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini" data-action="check-in-session" data-session-id="' + esc(checkInNow.id) + '">I\'m on my way</button></div>',
        '</article>'
      ].join("");
    } else if (firstPending) {
      actionHtml = [
        '<article class="row">',
        '<div class="row-top"><p class="headline">Confirm your next session</p><span class="pill">Pending</span></div>',
        '<p class="muted">' + esc(firstPending.title || "Session") + " • " + esc(formatDateTime(firstPending.starts_at)) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini" data-action="set-commitment" data-session-id="' + esc(firstPending.id) + '" data-status="committed">I can make it</button><button type="button" class="mini ghost" data-action="set-commitment" data-session-id="' + esc(firstPending.id) + '" data-status="unavailable">Can\'t make it</button></div>',
        '</article>'
      ].join("");
    } else if (pulsePending) {
      actionHtml = [
        '<article class="row">',
        '<div class="row-top"><p class="headline">Submit your 1-minute pulse</p><span class="pill">Quick</span></div>',
        '<p class="muted">' + esc(pulsePending.title || "Session") + " • " + esc(formatDate(pulsePending.starts_at)) + '</p>',
        '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-pulse-dialog" data-session-id="' + esc(pulsePending.id) + '">Submit pulse</button></div>',
        '</article>'
      ].join("");
    }

    const sessionsHtml = upcoming.length
      ? upcoming.map((session) => {
        const commitment = commitmentFor(volunteerId, session.id);
        const status = commitment ? String(commitment.status || "") : "pending";
        const badge = status === "committed"
          ? '<span class="okpill">Committed</span>'
          : status === "unavailable"
            ? '<span class="warnpill">Unavailable</span>'
            : '<span class="pill">Pending</span>';
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || "Session") + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(session.starts_at)) + '</p>',
          '</article>'
        ].join("");
      }).join("")
      : '<div class="empty">No upcoming sessions assigned.</div>';

    const shiftHtml = openShift
      ? '<article class="row"><div class="row-top"><p class="headline">' + esc(openShift.title || "Session") + '</p><span class="pill">' + esc(formatDateTime(openShift.starts_at)) + '</span></div><p class="muted">Want to help more this week? This shift is available.</p><div class="inline-actions"><button type="button" class="mini ghost" data-action="take-open-shift" data-session-id="' + esc(openShift.id) + '">Take this shift</button></div></article>'
      : '<div class="empty">No open shifts right now.</div>';

    const praiseHtml = praiseRows.length
      ? praiseRows.map((row) => {
        const session = sessionById(row.session_id);
        const note = String(row.note || "").trim() || "Thank you for showing up and helping.";
        return [
          '<article class="review">',
          '<div class="row-top"><p class="muted">' + esc(session ? session.title : "Session") + '</p><p class="muted">' + stars(row.rating) + '</p></div>',
          '<p>' + esc(note) + '</p>',
          '</article>'
        ].join("");
      }).join("")
      : '<div class="empty">No thank-you notes yet. Ask for quick feedback after your next session.</div>';

    el.studioPanel.innerHTML = [
      '<section class="card">',
      '<div class="row-top"><p class="headline">Your Volunteer Journey</p><span class="score">' + esc(milestone.currentLabel) + '</span></div>',
      '<p class="muted">You have supported about ' + membersHelped + ' member visits. Keep building momentum.</p>',
      '<p class="muted">Focus: ' + esc(purpose.title) + ". " + esc(purpose.body) + '</p>',
      '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-support-dialog">Need support</button><button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button><button type="button" class="mini ghost" data-action="open-pulse-dialog">Session pulse</button></div>',
      '<div class="inline-actions">' + goalButtons + purposeButtons + '</div>',
      '</section>',
      '<section class="metric-grid">',
      metricBox("Sessions helped", String(helpedTotal)),
      metricBox("This month", String(helped30)),
      metricBox("Streak", String(streak)),
      metricBox("Praise notes", String(praiseCount)),
      metricBox("Pending", String(pending)),
      '</section>',
      '<section class="grid2"><div class="card"><h3>Your Next Best Action</h3><div class="rows">' + actionHtml + '</div></div><div class="card"><h3>Upcoming Sessions</h3><div class="rows">' + sessionsHtml + '</div></div></section>',
      '<section class="grid2"><div class="card"><h3>Recognition</h3><div class="rows"><article class="row"><div class="row-top"><p class="headline">' + esc(milestone.currentLabel) + '</p><span class="okpill">' + helpedTotal + '/' + milestone.nextTarget + '</span></div><p class="muted">' + (milestone.remaining > 0 ? (milestone.remaining + " more session(s) to reach " + milestone.nextLabel) : "Top level reached") + '</p><p class="muted">' + (goalRemaining > 0 ? (goalRemaining + " more this month to hit your personal goal") : "Monthly goal achieved") + '</p><p class="muted">' + esc(badges.join(" • ") || "Build momentum by showing up and responding early.") + '</p></article></div><div class="reviews">' + praiseHtml + '</div></div><div class="card"><h3>Optional Extra Shift</h3><div class="rows">' + shiftHtml + '</div></div></section>'
    ].join("");
  }
  async function onActionClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = String(target.getAttribute("data-action") || "");

    if (action === "open-volunteer-dialog") { openVolunteerDialog(); return; }
    if (action === "open-session-dialog") { openSessionDialog(); return; }
    if (action === "open-settings") { openDialog(el.settingsDialog); return; }
    if (action === "open-feedback") { openFeedbackDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-report") { openReportDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "open-edit-volunteer") { openEditVolunteerDialog(target.getAttribute("data-volunteer-id")); return; }
    if (action === "claim-volunteer") { await onClaimVolunteer(target.getAttribute("data-volunteer-id")); return; }
    if (action === "set-commitment") { await onSetCommitment(target.getAttribute("data-session-id"), target.getAttribute("data-status")); return; }
    if (action === "check-in-session") { await onCheckInSession(target.getAttribute("data-session-id")); return; }
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
    if (state.previewMode) {
      setStatus(el.authStatus, "Turn Preview mode off first to use email login.", "warn");
      return;
    }
    if (!state.supabase) {
      setStatus(el.authStatus, "Connect backend first.", "err");
      return;
    }
    const email = String(el.emailInput.value || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus(el.authStatus, "Enter a valid email.", "err");
      return;
    }
    const allowedDomain = normalizeDomain(safeGet(STORAGE.domain) || "");
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
    if (state.previewMode) {
      setBackendStatus("Preview mode is already fully enabled.", "ok");
      return;
    }
    if (!state.user || !state.supabase) {
      setStatus(el.authStatus, "Sign in first.", "err");
      return;
    }
    el.startSetupBtn.disabled = true;
    const label = el.startSetupBtn.textContent;
    el.startSetupBtn.textContent = "Setting up...";
    try {
      const preferred = String(state.user.email || "club admin").split("@")[0];
      const response = await rpc("ops_bootstrap_admin_setup", { p_display_name: preferred }, 20000);
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
      const response = await rpc("ops_create_volunteer", {
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
    el.sessionForm.reset();
    clearStatus(el.sessionStatus);
    const soon = new Date(Date.now() + 86400000);
    soon.setMinutes(0, 0, 0);
    el.sessionStartsInput.value = toDatetimeLocal(soon);
    el.sessionRequiredInput.value = "2";
    el.sessionRoleBriefInput.value = "Welcome attendees, set boards, and support pairings";
    el.sessionArrivalNoteInput.value = "Arrive 20 minutes before start";
    el.sessionBackupPlanInput.value = "If delayed, message coordinator immediately";
    el.sessionAssignAllInput.value = "0";
    openDialog(el.sessionDialog);
  }

  async function onCreateSession(event) {
    event.preventDefault();
    clearStatus(el.sessionStatus);
    const title = String(el.sessionTitleInput.value || "").trim();
    const startsRaw = String(el.sessionStartsInput.value || "").trim();
    const required = Math.max(1, Math.min(20, Number(el.sessionRequiredInput.value || 2)));
    const roleBrief = String(el.sessionRoleBriefInput.value || "").trim();
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
    const startsAt = new Date(startsRaw);
    if (!isFinite(startsAt.getTime())) {
      setStatus(el.sessionStatus, "Invalid start date/time.", "err");
      return;
    }

    el.createSessionBtn.disabled = true;
    const label = el.createSessionBtn.textContent;
    el.createSessionBtn.textContent = "Creating...";
    try {
      const response = await rpc("ops_create_session", {
        p_title: title,
        p_starts_at: startsAt.toISOString(),
        p_required_volunteers: required,
        p_assign_all: assignAll,
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
      await loadAllData();
      renderAll();
      setBackendStatus("Session created.", "ok");
      if (el.sessionDialog.open) el.sessionDialog.close();
    } finally {
      el.createSessionBtn.disabled = false;
      el.createSessionBtn.textContent = label || "Create Session";
    }
  }

  function openFeedbackDialog(volunteerId) {
    if (!state.previewMode && !state.user) {
      setBackendStatus("Sign in first.", "err");
      return;
    }
    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) return;

    clearStatus(el.feedbackStatus);
    el.feedbackForm.reset();
    el.feedbackVolunteerIdInput.value = String(volunteer.id);

    const reviewerId = state.user ? String(state.user.id) : "preview-user";
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
      const response = await rpc("ops_submit_feedback", {
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
    if (!state.previewMode && !state.user) {
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
      const response = await rpc("ops_submit_report", {
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
      const response = await rpc("ops_update_volunteer_profile", {
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

  function openPulseDialog(sessionId) {
    if (!state.previewMode && (!state.user || !state.supabase)) {
      setBackendStatus("Sign in first or switch Preview mode on.", "err");
      return;
    }
    const volunteerId = myVolunteerId();
    if (!volunteerId) {
      setBackendStatus("Claim a volunteer profile first.", "err");
      return;
    }

    clearStatus(el.pulseStatus);
    el.pulseForm.reset();
    const actorUserId = state.user ? String(state.user.id) : "preview-user";
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
    const actorUserId = state.user ? String(state.user.id) : "preview-user";
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
    if (!state.previewMode && (!state.user || !state.supabase)) {
      setStatus(el.pulseStatus, "Sign in first or use Preview mode.", "err");
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
      const response = await rpc("ops_submit_session_pulse", {
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
      setBackendStatus("Pulse submitted.", "ok");
      if (el.pulseDialog.open) el.pulseDialog.close();
    } finally {
      el.submitPulseBtn.disabled = false;
      el.submitPulseBtn.textContent = label || "Submit Pulse";
    }
  }

  function openSupportDialog(sessionId) {
    if (!state.previewMode && (!state.user || !state.supabase)) {
      setBackendStatus("Sign in first or switch Preview mode on.", "err");
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
    if (!state.previewMode && (!state.user || !state.supabase)) {
      setStatus(el.supportStatus, "Sign in first or use Preview mode.", "err");
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
      const response = await rpc("ops_submit_support_request", {
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
    const response = await rpc("ops_resolve_support_request", {
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
      calls.push(rpc("ops_mark_attendance", {
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
    if (!state.previewMode && (!state.user || !state.supabase)) { setBackendStatus("Sign in first.", "err"); return; }
    const response = await rpc("ops_claim_volunteer", { p_volunteer_id: volunteerId }, 25000);
    if (response.error) { setBackendStatus(errorText(response.error, "Claim failed"), "err"); return; }
    if (!state.previewMode) await refreshSession();
    await loadAllData();
    renderAll();
    setBackendStatus("Volunteer profile claimed.", "ok");
  }

  async function onSetCommitment(sessionId, status) {
    if (!state.previewMode && (!state.user || !state.supabase)) { setBackendStatus("Sign in first.", "err"); return; }

    let note = null;
    let planLeaveAt = null;
    const session = sessionById(sessionId);

    if (status === "committed") {
      if (!session) { setBackendStatus("Session not found.", "err"); return; }
      const defaultTime = defaultLeaveTime(session.starts_at);
      const input = window.prompt("What time will you leave for " + (session.title || "this session") + "? Use HH:MM.", defaultTime);
      if (input === null) return;
      const normalized = normalizeClockInput(input);
      if (!normalized) { setBackendStatus("Use HH:MM format for leave time.", "err"); return; }
      planLeaveAt = combineSessionDateAndClock(session.starts_at, normalized);
      note = "Planned leave " + normalized;
    }

    if (status === "unavailable") {
      const reason = window.prompt("Optional reason (helps scheduling):", "");
      if (reason === null) return;
      if (String(reason).trim()) note = String(reason).trim();
    }

    const response = await rpc("ops_set_commitment", {
      p_session_id: sessionId,
      p_status: status,
      p_note: note,
      p_plan_leave_at: planLeaveAt
    }, 25000);

    if (response.error) { setBackendStatus(errorText(response.error, "Commitment update failed"), "err"); return; }
    await loadAllData();
    renderAll();
    setBackendStatus(status === "committed" ? "Committed with plan." : "Marked unavailable.", "ok");
  }

  async function onCheckInSession(sessionId) {
    if (!state.previewMode && (!state.user || !state.supabase)) { setBackendStatus("Sign in first.", "err"); return; }
    const response = await rpc("ops_check_in_session", { p_session_id: sessionId, p_note: "On my way" }, 25000);
    if (response.error) { setBackendStatus(errorText(response.error, "Check-in failed"), "err"); return; }
    await loadAllData();
    renderAll();
    setBackendStatus("Checked in successfully.", "ok");
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
    setBackendStatus("Monthly goal updated to " + goal + " session(s).", "ok");
    renderAll();
  }

  function onSetVolunteerPurpose(purposeRaw) {
    const purpose = String(purposeRaw || "");
    if (!["community", "coaching", "skills", "social"].includes(purpose)) return;
    state.volunteerPurpose = purpose;
    safeSet(STORAGE.volunteerPurpose, purpose);
    setBackendStatus("Volunteer focus updated.", "ok");
    renderAll();
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
    if (state.previewMode) return previewRpc(name, params || {});
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

  function loadPreviewData() {
    const raw = safeGet(STORAGE.previewData);
    let seed = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.volunteers) && Array.isArray(parsed.sessions) && Array.isArray(parsed.assignments) &&
            Array.isArray(parsed.commitments) && Array.isArray(parsed.attendance) && Array.isArray(parsed.feedback) &&
            Array.isArray(parsed.sessionPulses) && Array.isArray(parsed.supportRequests)) {
          seed = parsed;
        }
      } catch (_error) {}
    }
    if (!seed) seed = defaultPreviewSeed();

    state.volunteers = seed.volunteers || [];
    state.sessions = seed.sessions || [];
    state.assignments = seed.assignments || [];
    state.commitments = seed.commitments || [];
    state.attendance = seed.attendance || [];
    state.feedback = seed.feedback || [];
    state.sessionPulses = seed.sessionPulses || [];
    state.supportRequests = seed.supportRequests || [];
    state.metricsRows = computeDerivedMetricsRows();
    state.metricsByVolunteer = {};
    state.metricsRows.forEach((row) => { state.metricsByVolunteer[String(row.volunteer_id)] = row; });

    if (!state.profile) {
      state.profile = {
        user_id: "preview-user",
        email: "preview@local",
        display_name: "Preview Volunteer",
        role: "member",
        status: "approved",
        volunteer_id: seed.profileVolunteerId || null
      };
    } else if (!state.profile.volunteer_id && seed.profileVolunteerId) {
      state.profile.volunteer_id = seed.profileVolunteerId;
    }
    if (state.profile && state.profile.volunteer_id && !state.volunteers.some((row) => String(row.id) === String(state.profile.volunteer_id))) {
      state.profile.volunteer_id = seed.profileVolunteerId && state.volunteers.some((row) => String(row.id) === String(seed.profileVolunteerId))
        ? seed.profileVolunteerId
        : (state.volunteers[0] ? state.volunteers[0].id : null);
    }

    if (!state.selectedVolunteerId || !state.volunteers.some((row) => String(row.id) === String(state.selectedVolunteerId))) {
      state.selectedVolunteerId = seed.selectedVolunteerId && state.volunteers.some((row) => String(row.id) === String(seed.selectedVolunteerId))
        ? String(seed.selectedVolunteerId)
        : (state.volunteers[0] ? String(state.volunteers[0].id) : null);
    }
  }

  function savePreviewData() {
    if (!state.previewMode) return;
    safeSet(STORAGE.previewData, JSON.stringify({
      volunteers: state.volunteers,
      sessions: state.sessions,
      assignments: state.assignments,
      commitments: state.commitments,
      attendance: state.attendance,
      feedback: state.feedback,
      sessionPulses: state.sessionPulses,
      supportRequests: state.supportRequests,
      selectedVolunteerId: state.selectedVolunteerId,
      profileVolunteerId: state.profile ? state.profile.volunteer_id : null
    }));
  }

  function defaultPreviewSeed() {
    const now = Date.now();
    const volunteers = [
      { id: "pv_alex", owner_user_id: "preview-user", display_name: "Alex Johnson", tagline: "Kids opening coach", bio: "Runs warm-ups and opening drills.", active: true, created_at: new Date(now - (60 * 86400000)).toISOString() },
      { id: "pv_maya", owner_user_id: null, display_name: "Maya Patel", tagline: "Beginner board helper", bio: "Supports first-time attendees.", active: true, created_at: new Date(now - (48 * 86400000)).toISOString() },
      { id: "pv_liam", owner_user_id: null, display_name: "Liam Khan", tagline: "Tournament desk lead", bio: "Handles pairings and arrivals.", active: true, created_at: new Date(now - (45 * 86400000)).toISOString() }
    ];

    const sessions = [
      { id: "ps_past_1", title: "Thursday Club Night", starts_at: new Date(now - (7 * 86400000)).toISOString(), required_volunteers: 2, status: "completed", role_brief: "Welcome players + set boards", arrival_note: "Arrive 20 mins early", backup_plan: "If delayed, message coordinator", created_at: new Date(now - (10 * 86400000)).toISOString() },
      { id: "ps_past_2", title: "Saturday Juniors", starts_at: new Date(now - (14 * 86400000)).toISOString(), required_volunteers: 2, status: "completed", role_brief: "Beginner table support", arrival_note: "Arrive 15 mins early", backup_plan: "Fallback: call Alex", created_at: new Date(now - (17 * 86400000)).toISOString() },
      { id: "ps_up_1", title: "Monday Juniors", starts_at: new Date(now + (26 * 3600000)).toISOString(), required_volunteers: 2, status: "scheduled", role_brief: "Warm-up and puzzle facilitation", arrival_note: "Arrive 20 mins early", backup_plan: "If blocked, post in volunteer group", created_at: new Date(now - (1 * 86400000)).toISOString() },
      { id: "ps_up_2", title: "Wednesday Club Night", starts_at: new Date(now + (50 * 3600000)).toISOString(), required_volunteers: 3, status: "scheduled", role_brief: "Pairing support + new attendee onboarding", arrival_note: "Arrive 25 mins early", backup_plan: "Backup lead: Liam", created_at: new Date(now - (1 * 86400000)).toISOString() },
      { id: "ps_up_3", title: "Friday Match Prep", starts_at: new Date(now + (4 * 3600000)).toISOString(), required_volunteers: 2, status: "scheduled", role_brief: "Prep clocks + coaching stations", arrival_note: "Arrive 30 mins early", backup_plan: "Escalate to coordinator if short staffed", created_at: new Date(now - (1 * 86400000)).toISOString() }
    ];

    const assignments = [];
    sessions.forEach((session) => {
      volunteers.forEach((volunteer) => {
        assignments.push({ session_id: session.id, volunteer_id: volunteer.id });
      });
    });

    const commitments = [
      { session_id: "ps_up_1", volunteer_id: "pv_alex", status: "committed", note: "Planned leave 18:20", plan_leave_at: new Date(now + (23.5 * 3600000)).toISOString(), last_check_in_at: null, updated_at: new Date(now - 3600000).toISOString() },
      { session_id: "ps_up_1", volunteer_id: "pv_maya", status: "unavailable", note: "Family conflict", plan_leave_at: null, last_check_in_at: null, updated_at: new Date(now - 5400000).toISOString() },
      { session_id: "ps_up_3", volunteer_id: "pv_alex", status: "committed", note: "Planned leave 18:00", plan_leave_at: new Date(now + (3 * 3600000)).toISOString(), last_check_in_at: null, updated_at: new Date(now - 3000000).toISOString() }
    ];

    const attendance = [
      { session_id: "ps_past_1", volunteer_id: "pv_alex", outcome: "showed_up", note: "", marked_at: new Date(now - (7 * 86400000) + 3600000).toISOString() },
      { session_id: "ps_past_1", volunteer_id: "pv_maya", outcome: "late", note: "Arrived 10 mins late", marked_at: new Date(now - (7 * 86400000) + 3700000).toISOString() },
      { session_id: "ps_past_1", volunteer_id: "pv_liam", outcome: "showed_up", note: "", marked_at: new Date(now - (7 * 86400000) + 3800000).toISOString() },
      { session_id: "ps_past_2", volunteer_id: "pv_alex", outcome: "showed_up", note: "", marked_at: new Date(now - (14 * 86400000) + 3600000).toISOString() },
      { session_id: "ps_past_2", volunteer_id: "pv_maya", outcome: "excused", note: "Shared conflict in advance", marked_at: new Date(now - (14 * 86400000) + 3800000).toISOString() },
      { session_id: "ps_past_2", volunteer_id: "pv_liam", outcome: "showed_up", note: "", marked_at: new Date(now - (14 * 86400000) + 3900000).toISOString() }
    ];

    const feedback = [
      { id: "pf_1", session_id: "ps_past_1", volunteer_id: "pv_alex", reviewer_user_id: "preview-r1", rating: 5, feedback_type: "coaching", note: "Very supportive and clear.", created_at: new Date(now - (6.8 * 86400000)).toISOString() },
      { id: "pf_2", session_id: "ps_past_1", volunteer_id: "pv_liam", reviewer_user_id: "preview-r2", rating: 4, feedback_type: "organisation", note: "Good check-in and pairing support.", created_at: new Date(now - (6.7 * 86400000)).toISOString() },
      { id: "pf_3", session_id: "ps_past_2", volunteer_id: "pv_maya", reviewer_user_id: "preview-r3", rating: 4, feedback_type: "communication", note: "Warm and patient with junior players.", created_at: new Date(now - (13.7 * 86400000)).toISOString() }
    ];

    const sessionPulses = [
      { id: "pp_1", session_id: "ps_past_1", volunteer_id: "pv_alex", clarity_rating: 5, support_rating: 4, stress_rating: 2, note: "Great session flow.", created_by_user_id: "preview-user", created_at: new Date(now - (6.6 * 86400000)).toISOString() },
      { id: "pp_2", session_id: "ps_past_2", volunteer_id: "pv_maya", clarity_rating: 4, support_rating: 4, stress_rating: 3, note: "Would like role reminders 24h before start.", created_by_user_id: "preview-user", created_at: new Date(now - (13.5 * 86400000)).toISOString() }
    ];

    const supportRequests = [
      { id: "sr_1", volunteer_id: "pv_maya", session_id: "ps_up_1", request_type: "role_clarity", urgency: "normal", details: "Can I receive table assignment the day before?", status: "open", resolution_note: "", created_by_user_id: "preview-user", resolved_by_user_id: null, created_at: new Date(now - (5 * 3600000)).toISOString(), resolved_at: null },
      { id: "sr_2", volunteer_id: "pv_alex", session_id: null, request_type: "wellbeing", urgency: "normal", details: "Would like one lighter week next month.", status: "resolved", resolution_note: "Adjusted rota for next two sessions.", created_by_user_id: "preview-user", resolved_by_user_id: "preview-user", created_at: new Date(now - (10 * 86400000)).toISOString(), resolved_at: new Date(now - (9 * 86400000)).toISOString() }
    ];

    return {
      volunteers,
      sessions,
      assignments,
      commitments,
      attendance,
      feedback,
      sessionPulses,
      supportRequests,
      selectedVolunteerId: "pv_alex",
      profileVolunteerId: "pv_alex"
    };
  }

  function previewActorUserId() {
    return state.user ? String(state.user.id) : "preview-user";
  }

  function buildPreviewId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
  }

  function previewUpsertCommitment(row) {
    const index = state.commitments.findIndex((entry) =>
      String(entry.session_id) === String(row.session_id) &&
      String(entry.volunteer_id) === String(row.volunteer_id)
    );
    if (index >= 0) state.commitments[index] = { ...state.commitments[index], ...row };
    else state.commitments.push(row);
  }

  function previewUpsertAttendance(row) {
    const index = state.attendance.findIndex((entry) =>
      String(entry.session_id) === String(row.session_id) &&
      String(entry.volunteer_id) === String(row.volunteer_id)
    );
    if (index >= 0) state.attendance[index] = { ...state.attendance[index], ...row };
    else state.attendance.push(row);
  }

  function previewRpc(name, params) {
    try {
      const actorUserId = previewActorUserId();
      const nowIso = new Date().toISOString();

      if (name === "ops_bootstrap_admin_setup") {
        return { data: { user_id: actorUserId, role: "admin", status: "approved", volunteer_id: myVolunteerId() }, error: null };
      }

      if (name === "ops_create_volunteer") {
        const display = String(params.p_display_name || "").trim();
        if (!display) return { data: null, error: new Error("Display name is required") };
        const id = buildPreviewId("pv");
        state.volunteers.push({
          id,
          owner_user_id: null,
          display_name: display,
          tagline: String(params.p_tagline || ""),
          bio: String(params.p_bio || ""),
          active: true,
          created_at: nowIso
        });
        state.sessions
          .filter((session) => String(session.status || "scheduled") !== "cancelled")
          .forEach((session) => state.assignments.push({ session_id: session.id, volunteer_id: id }));
        savePreviewData();
        return { data: id, error: null };
      }

      if (name === "ops_update_volunteer_profile") {
        const volunteer = state.volunteers.find((row) => String(row.id) === String(params.p_volunteer_id));
        if (!volunteer) return { data: null, error: new Error("Volunteer not found") };
        volunteer.display_name = String(params.p_display_name || volunteer.display_name || "").trim() || volunteer.display_name;
        volunteer.tagline = params.p_tagline == null ? volunteer.tagline : String(params.p_tagline);
        volunteer.bio = params.p_bio == null ? volunteer.bio : String(params.p_bio);
        savePreviewData();
        return { data: true, error: null };
      }

      if (name === "ops_create_session") {
        const title = String(params.p_title || "").trim();
        const startsAt = new Date(params.p_starts_at);
        const roleBrief = String(params.p_role_brief || "").trim();
        if (!title) return { data: null, error: new Error("Session title is required") };
        if (!isFinite(startsAt.getTime())) return { data: null, error: new Error("Invalid session start") };
        if (!roleBrief) return { data: null, error: new Error("Role clarity is required") };
        const id = buildPreviewId("ps");
        state.sessions.push({
          id,
          title,
          starts_at: startsAt.toISOString(),
          required_volunteers: Math.max(1, Math.min(20, Number(params.p_required_volunteers || 2))),
          status: "scheduled",
          role_brief: roleBrief,
          arrival_note: String(params.p_arrival_note || ""),
          backup_plan: String(params.p_backup_plan || ""),
          created_at: nowIso
        });
        if (params.p_assign_all !== false) {
          state.volunteers.forEach((volunteer) => {
            state.assignments.push({ session_id: id, volunteer_id: volunteer.id });
          });
        }
        savePreviewData();
        return { data: id, error: null };
      }

      if (name === "ops_claim_volunteer") {
        const volunteer = state.volunteers.find((row) => String(row.id) === String(params.p_volunteer_id));
        if (!volunteer) return { data: null, error: new Error("Volunteer not found") };
        if (volunteer.owner_user_id && String(volunteer.owner_user_id) !== actorUserId) {
          return { data: null, error: new Error("Volunteer profile already claimed") };
        }
        volunteer.owner_user_id = actorUserId;
        if (!state.profile) {
          state.profile = {
            user_id: actorUserId,
            email: "preview@local",
            display_name: "Preview Volunteer",
            role: "member",
            status: "approved",
            volunteer_id: volunteer.id
          };
        } else {
          state.profile.volunteer_id = volunteer.id;
        }
        savePreviewData();
        return { data: true, error: null };
      }

      if (name === "ops_set_commitment") {
        const sessionId = String(params.p_session_id || "");
        const session = sessionById(sessionId);
        if (!session) return { data: null, error: new Error("Session not found") };
        const volunteerId = myVolunteerId() || state.selectedVolunteerId || (state.volunteers[0] ? String(state.volunteers[0].id) : null);
        if (!volunteerId) return { data: null, error: new Error("No volunteer profile selected") };
        const status = String(params.p_status || "");
        if (status !== "committed" && status !== "unavailable") return { data: null, error: new Error("Invalid commitment status") };
        if (status === "committed" && !params.p_plan_leave_at) return { data: null, error: new Error("Leave-time plan is required when committing") };
        if (!state.assignments.some((row) => String(row.session_id) === sessionId && String(row.volunteer_id) === String(volunteerId))) {
          state.assignments.push({ session_id: sessionId, volunteer_id: volunteerId });
        }
        previewUpsertCommitment({
          session_id: sessionId,
          volunteer_id: volunteerId,
          status,
          note: String(params.p_note || ""),
          plan_leave_at: status === "committed" ? params.p_plan_leave_at : null,
          last_check_in_at: status === "unavailable" ? null : (commitmentFor(volunteerId, sessionId) || {}).last_check_in_at || null,
          updated_at: nowIso
        });
        savePreviewData();
        return { data: true, error: null };
      }

      if (name === "ops_check_in_session") {
        const sessionId = String(params.p_session_id || "");
        const session = sessionById(sessionId);
        if (!session) return { data: null, error: new Error("Session not found") };
        const volunteerId = myVolunteerId() || state.selectedVolunteerId || (state.volunteers[0] ? String(state.volunteers[0].id) : null);
        if (!volunteerId) return { data: null, error: new Error("No volunteer profile selected") };
        if (!state.assignments.some((row) => String(row.session_id) === sessionId && String(row.volunteer_id) === String(volunteerId))) {
          state.assignments.push({ session_id: sessionId, volunteer_id: volunteerId });
        }
        const previous = commitmentFor(volunteerId, sessionId);
        previewUpsertCommitment({
          session_id: sessionId,
          volunteer_id: volunteerId,
          status: "committed",
          note: String(params.p_note || (previous ? previous.note : "") || ""),
          plan_leave_at: previous ? previous.plan_leave_at : null,
          last_check_in_at: nowIso,
          updated_at: nowIso
        });
        savePreviewData();
        return { data: true, error: null };
      }

      if (name === "ops_submit_feedback") {
        const sessionId = String(params.p_session_id || "");
        const volunteerId = String(params.p_volunteer_id || "");
        const rating = Number(params.p_rating || 0);
        if (!sessionById(sessionId)) return { data: null, error: new Error("Session not found") };
        if (!state.volunteers.some((row) => String(row.id) === volunteerId)) return { data: null, error: new Error("Volunteer not found") };
        if (rating < 1 || rating > 5) return { data: null, error: new Error("Rating must be between 1 and 5") };
        if (state.feedback.some((row) =>
          String(row.session_id) === sessionId &&
          String(row.volunteer_id) === volunteerId &&
          String(row.reviewer_user_id) === actorUserId
        )) return { data: null, error: new Error("You already submitted feedback for this session") };

        const id = buildPreviewId("pf");
        state.feedback.unshift({
          id,
          session_id: sessionId,
          volunteer_id: volunteerId,
          reviewer_user_id: actorUserId,
          rating,
          feedback_type: String(params.p_feedback_type || "general"),
          note: String(params.p_note || ""),
          created_at: nowIso
        });
        savePreviewData();
        return { data: id, error: null };
      }

      if (name === "ops_submit_session_pulse") {
        const sessionId = String(params.p_session_id || "");
        const volunteerId = myVolunteerId() || state.selectedVolunteerId || (state.volunteers[0] ? String(state.volunteers[0].id) : null);
        const clarity = Number(params.p_clarity_rating || 0);
        const support = Number(params.p_support_rating || 0);
        const stress = Number(params.p_stress_rating || 0);
        if (!sessionById(sessionId)) return { data: null, error: new Error("Session not found") };
        if (!volunteerId) return { data: null, error: new Error("No volunteer profile selected") };
        if (![clarity, support, stress].every((v) => v >= 1 && v <= 5)) return { data: null, error: new Error("Pulse ratings must be 1-5") };

        const existing = state.sessionPulses.find((row) => String(row.session_id) === sessionId && String(row.volunteer_id) === String(volunteerId) && String(row.created_by_user_id) === actorUserId);
        if (existing) {
          existing.clarity_rating = clarity;
          existing.support_rating = support;
          existing.stress_rating = stress;
          existing.note = String(params.p_note || "");
          existing.created_at = nowIso;
          savePreviewData();
          return { data: existing.id, error: null };
        }

        const id = buildPreviewId("pp");
        state.sessionPulses.unshift({
          id,
          session_id: sessionId,
          volunteer_id: volunteerId,
          clarity_rating: clarity,
          support_rating: support,
          stress_rating: stress,
          note: String(params.p_note || ""),
          created_by_user_id: actorUserId,
          created_at: nowIso
        });
        savePreviewData();
        return { data: id, error: null };
      }

      if (name === "ops_submit_support_request") {
        const volunteerId = myVolunteerId() || state.selectedVolunteerId || (state.volunteers[0] ? String(state.volunteers[0].id) : null);
        const requestType = String(params.p_request_type || "").trim();
        const urgency = String(params.p_urgency || "normal").trim();
        const details = String(params.p_details || "").trim();
        const sessionId = params.p_session_id ? String(params.p_session_id) : null;
        if (!volunteerId) return { data: null, error: new Error("No volunteer profile selected") };
        if (!requestType) return { data: null, error: new Error("Request type is required") };
        if (!details) return { data: null, error: new Error("Please add request details") };
        if (sessionId && !sessionById(sessionId)) return { data: null, error: new Error("Session not found") };

        const id = buildPreviewId("sr");
        state.supportRequests.unshift({
          id,
          volunteer_id: volunteerId,
          session_id: sessionId,
          request_type: requestType,
          urgency: ["normal", "high", "urgent"].includes(urgency) ? urgency : "normal",
          details,
          status: "open",
          resolution_note: "",
          created_by_user_id: actorUserId,
          resolved_by_user_id: null,
          created_at: nowIso,
          resolved_at: null
        });
        savePreviewData();
        return { data: id, error: null };
      }

      if (name === "ops_resolve_support_request") {
        const requestId = String(params.p_request_id || "");
        const status = String(params.p_status || "resolved").trim();
        const request = state.supportRequests.find((row) => String(row.id) === requestId);
        if (!request) return { data: null, error: new Error("Support request not found") };
        if (!["resolved", "dismissed", "open"].includes(status)) return { data: null, error: new Error("Invalid support status") };
        request.status = status;
        request.resolution_note = String(params.p_resolution_note || "");
        request.resolved_by_user_id = status === "open" ? null : actorUserId;
        request.resolved_at = status === "open" ? null : nowIso;
        savePreviewData();
        return { data: true, error: null };
      }

      if (name === "ops_submit_report") {
        const volunteerId = String(params.p_volunteer_id || "");
        if (!state.volunteers.some((row) => String(row.id) === volunteerId)) return { data: null, error: new Error("Volunteer not found") };
        return { data: buildPreviewId("pr"), error: null };
      }

      if (name === "ops_mark_attendance") {
        const sessionId = String(params.p_session_id || "");
        const volunteerId = String(params.p_volunteer_id || "");
        const outcome = String(params.p_outcome || "");
        if (!sessionById(sessionId)) return { data: null, error: new Error("Session not found") };
        if (!state.volunteers.some((row) => String(row.id) === volunteerId)) return { data: null, error: new Error("Volunteer not found") };
        if (!["showed_up", "late", "no_show", "excused"].includes(outcome)) return { data: null, error: new Error("Invalid attendance outcome") };
        previewUpsertAttendance({
          session_id: sessionId,
          volunteer_id: volunteerId,
          outcome,
          note: String(params.p_note || ""),
          marked_at: nowIso
        });
        const session = sessionById(sessionId);
        if (session && String(session.status || "scheduled") === "scheduled" && new Date(session.starts_at).getTime() <= Date.now()) {
          session.status = "completed";
        }
        savePreviewData();
        return { data: true, error: null };
      }

      return { data: null, error: new Error("Unsupported preview action: " + name) };
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
      .filter((session) => new Date(session.starts_at).getTime() <= now)
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
      pendingIds
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
    if (state.previewMode) return Boolean(state.profile && state.profile.role === "admin");
    return Boolean(state.profile && state.profile.role === "admin" && state.profile.status === "approved");
  }

  function isApprovedMember() {
    if (state.previewMode) return true;
    return Boolean(state.profile && state.profile.status === "approved");
  }

  function myVolunteerId() {
    if (state.previewMode) {
      if (state.profile && state.profile.volunteer_id && state.volunteers.some((row) => String(row.id) === String(state.profile.volunteer_id))) {
        return String(state.profile.volunteer_id);
      }
      if (state.selectedVolunteerId && state.volunteers.some((row) => String(row.id) === String(state.selectedVolunteerId))) return String(state.selectedVolunteerId);
      return state.volunteers[0] ? String(state.volunteers[0].id) : null;
    }
    return state.profile && state.profile.volunteer_id ? String(state.profile.volunteer_id) : null;
  }

  function metricBox(label, value) {
    return '<article class="metric"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div></article>';
  }

  function openDialog(node) {
    if (!node || typeof node.showModal !== "function") return;
    if (!node.open) node.showModal();
  }

  function setBackendStatus(text, type) {
    setStatus(el.backendStatus, text, type);
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

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_error) {}
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_error) { return null; }
  }

  function looksLikeMissingSetup(message) {
    const text = String(message || "").toLowerCase();
    if (!/ops_/.test(text) && !/relation .* does not exist|schema cache|undefined function|function .* does not exist|no function matches/.test(text)) return false;
    return /does not exist|schema cache|undefined function|not found|no function matches/.test(text);
  }

  function isAuthLockError(message) {
    const text = String(message || "");
    return /lock:mk_volunteer_ops_auth_v3/i.test(text) ||
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
