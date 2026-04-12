(() => {
  "use strict";

  const STORAGE = {
    url: "mk_ops_url",
    key: "mk_ops_key",
    domain: "mk_ops_domain",
    previewMode: "mk_ops_preview_mode",
    previewData: "mk_ops_preview_data_v1"
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
    metricsRows: [],
    metricsByVolunteer: {},
    selectedVolunteerId: null,
    attendanceSessionId: null,
    loading: false,
    previewMode: true,
    syncInFlight: false,
    syncRequested: false
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
      "emailInput", "sendLinkBtn", "signOutBtn", "startSetupBtn", "addVolunteerBtn", "addSessionBtn", "demoModeBtn", "openSettingsBtn",
      "authStatus", "backendStatus", "commandBoard", "searchInput", "volunteerList", "volunteerDetail", "studioPanel",
      "settingsDialog", "supaUrlInput", "supaKeyInput", "allowedDomainInput", "connectBtn",
      "volunteerDialog", "volunteerForm", "volunteerNameInput", "volunteerTaglineInput", "volunteerBioInput", "volunteerStatus", "createVolunteerBtn",
      "sessionDialog", "sessionForm", "sessionTitleInput", "sessionStartsInput", "sessionRequiredInput", "sessionStatus", "createSessionBtn",
      "feedbackDialog", "feedbackForm", "feedbackVolunteerIdInput", "feedbackSessionSelect", "feedbackRatingInput", "feedbackTypeSelect", "feedbackNoteInput", "feedbackStatus", "submitFeedbackBtn",
      "reportDialog", "reportForm", "reportVolunteerIdInput", "reportSessionSelect", "reportReasonSelect", "reportDetailsInput", "reportStatus", "submitReportBtn",
      "attendanceDialog", "attendanceTitle", "attendanceRows", "attendanceForm", "attendanceStatus", "saveAttendanceBtn",
      "editVolunteerDialog", "editVolunteerForm", "editVolunteerIdInput", "editVolunteerNameInput", "editVolunteerTaglineInput", "editVolunteerBioInput", "editVolunteerStatus", "saveVolunteerProfileBtn"
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
    el.demoModeBtn.addEventListener("click", onTogglePreviewMode);
    el.openSettingsBtn.addEventListener("click", () => openDialog(el.settingsDialog));
    el.connectBtn.addEventListener("click", onConnectClick);
    el.searchInput.addEventListener("input", renderVolunteerList);

    el.commandBoard.addEventListener("click", onActionClick);
    el.volunteerDetail.addEventListener("click", onActionClick);
    el.studioPanel.addEventListener("click", onActionClick);
    el.volunteerList.addEventListener("click", onVolunteerListClick);

    el.volunteerForm.addEventListener("submit", onCreateVolunteer);
    el.sessionForm.addEventListener("submit", onCreateSession);
    el.feedbackForm.addEventListener("submit", onSubmitFeedback);
    el.reportForm.addEventListener("submit", onSubmitReport);
    el.attendanceForm.addEventListener("submit", onSubmitAttendance);
    el.editVolunteerForm.addEventListener("submit", onSaveVolunteerProfile);

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

    el.supaUrlInput.value = savedUrl || DEFAULT_SUPABASE.url;
    el.supaKeyInput.value = savedKey || DEFAULT_SUPABASE.anonKey;
    el.allowedDomainInput.value = savedDomain || "";
    state.previewMode = savedPreview === null ? true : savedPreview === "1";

    if (!savedUrl) safeSet(STORAGE.url, DEFAULT_SUPABASE.url);
    if (!savedKey) safeSet(STORAGE.key, DEFAULT_SUPABASE.anonKey);
    if (savedPreview === null) safeSet(STORAGE.previewMode, "1");
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
      if (!/lock:mk_volunteer_ops_auth_v3/i.test(text)) setBackendStatus(text, "err");
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
      setBackendStatus(errorText(error, "Sync failed"), "err");
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
        display_name: "Preview Admin",
        role: "admin",
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
      if (/lock:mk_volunteer_ops_auth_v3/i.test(text)) {
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
      if (/lock:mk_volunteer_ops_auth_v3/i.test(message)) {
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
        metricsResponse
      ] = await Promise.all([
        state.supabase.from("ops_volunteers")
          .select("id,owner_user_id,display_name,tagline,bio,active,created_at")
          .eq("active", true)
          .order("display_name", { ascending: true }),
        state.supabase.from("ops_sessions")
          .select("id,title,starts_at,required_volunteers,status,created_at")
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
        state.supabase.from("ops_volunteer_metrics")
          .select("volunteer_id,avg_rating,feedback_count,assigned_upcoming,responded_upcoming,committed_upcoming,response_rate_pct,attendance_rate_pct,no_show_90d,reliability_score,at_risk")
      ]);

      const errors = [
        volunteersResponse.error,
        sessionsResponse.error,
        assignmentsResponse.error,
        commitmentsResponse.error,
        attendanceResponse.error,
        feedbackResponse.error,
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
      state.metricsRows = metricsResponse.error ? [] : (metricsResponse.data || []);
      if (!state.metricsRows.length) {
        state.metricsRows = computeDerivedMetricsRows();
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
      if (/lock:mk_volunteer_ops_auth_v3/i.test(text)) {
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
    if (el.demoModeBtn) el.demoModeBtn.textContent = state.previewMode ? "Preview: On" : "Preview: Off";

    el.sendLinkBtn.style.display = state.previewMode ? "none" : (signedIn ? "none" : "");
    el.signOutBtn.style.display = state.previewMode ? "none" : (signedIn ? "" : "none");
    el.emailInput.disabled = state.previewMode || signedIn;
    el.startSetupBtn.style.display = (!state.previewMode && signedIn && !admin) ? "" : "none";
    el.addVolunteerBtn.style.display = admin ? "" : "none";
    el.addSessionBtn.style.display = admin ? "" : "none";

    if (state.previewMode) {
      el.emailInput.value = "Preview mode enabled";
      setStatus(el.authStatus, "Preview mode active. No login required while testing features.", "ok");
      return;
    }

    if (signedIn) el.emailInput.value = state.user.email || "";
    else if (el.emailInput.value === "Preview mode enabled") el.emailInput.value = "";

    if (!signedIn) {
      setStatus(el.authStatus, "Sign in to manage volunteer operations.", "");
      return;
    }
    if (admin) {
      setStatus(el.authStatus, "Admin signed in: " + (state.user.email || ""), "ok");
      return;
    }

    const role = state.profile ? String(state.profile.role || "member") : "member";
    const status = state.profile ? String(state.profile.status || "pending") : "pending";
    setStatus(el.authStatus, "Signed in: " + (state.user.email || "") + " (" + role + ", " + status + ")", status === "approved" ? "" : "warn");
  }
  function renderCommandBoard() {
    if (state.loading) {
      el.commandBoard.innerHTML = '<div class="empty">Loading command center...</div>';
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

    if (!state.volunteers.length) {
      const actions = isAdmin()
        ? '<div class="inline-actions"><button type="button" data-action="open-volunteer-dialog">Add volunteer</button><button type="button" class="ghost" data-action="open-session-dialog">Add session</button></div>'
        : '<div class="inline-actions"><button type="button" class="ghost" data-action="open-settings">Settings</button></div>';
      el.commandBoard.innerHTML = [
        '<section class="metric-grid">',
        metricBox("Upcoming sessions", String(upcoming.length)),
        metricBox("Coverage", String(coveragePct) + "%"),
        metricBox("Response", String(responsePct) + "%"),
        metricBox("Avg rating", avgSatisfaction ? avgSatisfaction.toFixed(2) : "0.00"),
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
        '<div class="row-top"><p class="headline">' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="warnpill">Rep ' + Math.round(Number(row.metric.reliability_score || 0)) + '</span></div>',
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
        '<div class="row-top"><p class="headline">' + (index + 1) + '. ' + esc(row.volunteer.display_name || 'Volunteer') + '</p><span class="okpill">Rep ' + Math.round(Number(row.metric.reliability_score || 0)) + '</span></div>',
        '<p class="muted">' + stars(row.metric.avg_rating) + ' • attendance ' + Number(row.metric.attendance_rate_pct || 0) + '%</p>',
        '</article>'
      ].join('')).join('')
      : '<div class="empty">No data yet.</div>';

    el.commandBoard.innerHTML = [
      '<section class="metric-grid">',
      metricBox("Upcoming sessions", String(upcoming.length)),
      metricBox("Coverage", String(coveragePct) + "%"),
      metricBox("Response", String(responsePct) + "%"),
      metricBox("Avg rating", avgSatisfaction ? avgSatisfaction.toFixed(2) : "0.00"),
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Coverage</h3><div class="rows">' + coverageHtml + '</div><h3>Reminder Queue</h3><div class="rows">' + remindersHtml + '</div></div>',
      '<div class="card"><h3>Risk Signals</h3><div class="rows">' + riskHtml + '</div><h3>Recognition</h3><div class="rows">' + recognitionHtml + '</div><h3>Recovery Follow-up</h3><div class="rows">' + recoveryHtml + '</div><h3>Top Reliability</h3><div class="rows">' + topHtml + '</div></div>',
      '</section>'
    ].join('');
  }

  function renderVolunteerList() {
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
        '<span class="score">Rep ' + Math.round(Number(metric.reliability_score || 0)) + '</span>',
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
    const feedbackRows = feedbackForVolunteer(volunteer.id).slice(0, 8);
    const streak = showUpStreak(volunteer.id);
    const pendingCount = pendingUpcomingResponses(volunteer.id);
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
        const line = [plan, checkin].filter(Boolean).join(" • ");
        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p>' + badge + '</div>',
          '<p class="muted">' + esc(formatDateTime(session.starts_at)) + '</p>',
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
      '<div class="chips"><span class="chip">Rep ' + Math.round(Number(metric.reliability_score || 0)) + '</span><span class="chip">Attendance ' + Number(metric.attendance_rate_pct || 0) + '%</span><span class="chip">Response ' + Number(metric.response_rate_pct || 0) + '%</span><span class="chip">Rating ' + Number(metric.avg_rating || 0).toFixed(2) + '</span><span class="chip">Streak ' + streak + '</span><span class="chip">Pending ' + pendingCount + '</span></div>',
      '</section>',
      '<section class="grid2">',
      '<div class="card"><h3>Upcoming Commitments</h3><div class="rows">' + upcomingHtml + '</div></div>',
      '<div class="card"><h3>Recent Feedback</h3><div class="reviews">' + feedbackHtml + '</div></div>',
      '</section>'
    ].join('');
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
        : '';
      el.studioPanel.innerHTML = '<div class="empty">No linked volunteer profile yet.' + claimHelp + '</div>';
      return;
    }

    const volunteer = state.volunteers.find((row) => String(row.id) === String(volunteerId));
    if (!volunteer) {
      el.studioPanel.innerHTML = '<div class="empty">Linked volunteer profile not found.</div>';
      return;
    }

    const metric = metricFor(volunteerId);
    const upcoming = upcomingSessionsForVolunteer(volunteerId).slice(0, 10);
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
        const planLine = [plan, checkin].filter(Boolean).join(" • ");

        return [
          '<article class="row">',
          '<div class="row-top"><p class="headline">' + esc(session.title || 'Session') + '</p><span class="pill">' + esc(formatDateTime(session.starts_at)) + '</span></div>',
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

    el.studioPanel.innerHTML = [
      '<section class="hero">',
      '<div class="hero-top">',
      '<div class="av">' + esc(initials(volunteer.display_name || 'V')) + '</div>',
      '<div><h2>My Studio</h2><p class="muted">' + esc(volunteer.display_name || 'Volunteer') + '</p></div>',
      '<div class="inline-actions"><button type="button" class="mini ghost" data-action="open-edit-volunteer" data-volunteer-id="' + esc(volunteer.id) + '">Edit profile</button></div>',
      '</div>',
      '<div class="chips"><span class="chip">Rep ' + Math.round(Number(metric.reliability_score || 0)) + '</span><span class="chip">Attendance ' + Number(metric.attendance_rate_pct || 0) + '%</span><span class="chip">Response ' + Number(metric.response_rate_pct || 0) + '%</span><span class="chip">Rating ' + Number(metric.avg_rating || 0).toFixed(2) + '</span><span class="chip">Streak ' + streak + '</span><span class="chip">Pending ' + pendingCount + '</span></div>',
      '</section>',
      actionCardHtml,
      '<section class="card"><h3>Upcoming Sessions</h3><div class="rows">' + rowsHtml + '</div></section>'
    ].join('');
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
  }

  function onVolunteerListClick(event) {
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
    openDialog(el.sessionDialog);
  }

  async function onCreateSession(event) {
    event.preventDefault();
    clearStatus(el.sessionStatus);
    const title = String(el.sessionTitleInput.value || "").trim();
    const startsRaw = String(el.sessionStartsInput.value || "").trim();
    const required = Math.max(1, Math.min(20, Number(el.sessionRequiredInput.value || 2)));
    if (title.length < 3) {
      setStatus(el.sessionStatus, "Title must be at least 3 characters.", "err");
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
        p_assign_all: true
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
            Array.isArray(parsed.commitments) && Array.isArray(parsed.attendance) && Array.isArray(parsed.feedback)) {
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
    state.metricsRows = computeDerivedMetricsRows();
    state.metricsByVolunteer = {};
    state.metricsRows.forEach((row) => { state.metricsByVolunteer[String(row.volunteer_id)] = row; });

    if (!state.profile) {
      state.profile = {
        user_id: "preview-user",
        email: "preview@local",
        display_name: "Preview Admin",
        role: "admin",
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
      { id: "ps_past_1", title: "Thursday Club Night", starts_at: new Date(now - (7 * 86400000)).toISOString(), required_volunteers: 2, status: "completed", created_at: new Date(now - (10 * 86400000)).toISOString() },
      { id: "ps_past_2", title: "Saturday Juniors", starts_at: new Date(now - (14 * 86400000)).toISOString(), required_volunteers: 2, status: "completed", created_at: new Date(now - (17 * 86400000)).toISOString() },
      { id: "ps_up_1", title: "Monday Juniors", starts_at: new Date(now + (26 * 3600000)).toISOString(), required_volunteers: 2, status: "scheduled", created_at: new Date(now - (1 * 86400000)).toISOString() },
      { id: "ps_up_2", title: "Wednesday Club Night", starts_at: new Date(now + (50 * 3600000)).toISOString(), required_volunteers: 3, status: "scheduled", created_at: new Date(now - (1 * 86400000)).toISOString() },
      { id: "ps_up_3", title: "Friday Match Prep", starts_at: new Date(now + (4 * 3600000)).toISOString(), required_volunteers: 2, status: "scheduled", created_at: new Date(now - (1 * 86400000)).toISOString() }
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
      { session_id: "ps_past_2", volunteer_id: "pv_maya", outcome: "no_show", note: "", marked_at: new Date(now - (14 * 86400000) + 3800000).toISOString() },
      { session_id: "ps_past_2", volunteer_id: "pv_liam", outcome: "showed_up", note: "", marked_at: new Date(now - (14 * 86400000) + 3900000).toISOString() }
    ];

    const feedback = [
      { id: "pf_1", session_id: "ps_past_1", volunteer_id: "pv_alex", reviewer_user_id: "preview-r1", rating: 5, feedback_type: "coaching", note: "Very supportive and clear.", created_at: new Date(now - (6.8 * 86400000)).toISOString() },
      { id: "pf_2", session_id: "ps_past_1", volunteer_id: "pv_liam", reviewer_user_id: "preview-r2", rating: 4, feedback_type: "organisation", note: "Good check-in and pairing support.", created_at: new Date(now - (6.7 * 86400000)).toISOString() },
      { id: "pf_3", session_id: "ps_past_2", volunteer_id: "pv_maya", reviewer_user_id: "preview-r3", rating: 2, feedback_type: "communication", note: "Could not find volunteer at session start.", created_at: new Date(now - (13.7 * 86400000)).toISOString() }
    ];

    return {
      volunteers,
      sessions,
      assignments,
      commitments,
      attendance,
      feedback,
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
        if (!title) return { data: null, error: new Error("Session title is required") };
        if (!isFinite(startsAt.getTime())) return { data: null, error: new Error("Invalid session start") };
        const id = buildPreviewId("ps");
        state.sessions.push({
          id,
          title,
          starts_at: startsAt.toISOString(),
          required_volunteers: Math.max(1, Math.min(20, Number(params.p_required_volunteers || 2))),
          status: "scheduled",
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
            display_name: "Preview Admin",
            role: "admin",
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

      const cutoff90 = now - (90 * 86400000);
      const noShow90 = attendanceRows.filter((row) => {
        if (String(row.outcome || "") !== "no_show") return false;
        const session = sessionById(row.session_id);
        const at = session ? new Date(session.starts_at).getTime() : new Date(row.marked_at).getTime();
        return isFinite(at) && at >= cutoff90;
      }).length;

      const ratingScore = avgRating ? (avgRating / 5) * 100 : 70;
      const reliability = Math.max(0, Math.min(100, Math.round(
        (attendanceRate * 0.45) +
        (responseRate * 0.30) +
        (ratingScore * 0.25) -
        Math.min(noShow90 * 8, 24)
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
        reliability_score: reliability,
        at_risk: responseRate < 70 || attendanceRate < 80 || (feedbackCount >= 3 && avgRating < 3.8) || noShow90 >= 2
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

  function feedbackForVolunteer(volunteerId) {
    return state.feedback
      .filter((row) => String(row.volunteer_id) === String(volunteerId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
      reliability_score: 0,
      at_risk: false
    };
  }

  function sessionById(sessionId) {
    return state.sessions.find((row) => String(row.id) === String(sessionId)) || null;
  }

  function isAdmin() {
    if (state.previewMode) return true;
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
