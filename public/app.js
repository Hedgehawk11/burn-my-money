const loginForm = document.getElementById("loginForm");
const betForm = document.getElementById("betForm");
const changePasswordForm = document.getElementById("changePasswordForm");
const logoutBtn = document.getElementById("logoutBtn");
const authCard = document.getElementById("authCard");
const appSections = document.getElementById("appSections");
const teamPanel = document.getElementById("teamPanel");
const superPanel = document.getElementById("superPanel");
const accountStats = document.getElementById("accountStats");
const betTableWrap = document.getElementById("betTableWrap");
const debtSummaryWrap = document.getElementById("debtSummaryWrap");
const debtTableWrap = document.getElementById("debtTableWrap");
const toast = document.getElementById("toast");
const themeBtn = document.getElementById("themeBtn");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === "dark" ? "Light" : "Dark";
  localStorage.setItem("burnmoney-theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("burnmoney-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

initTheme();

const createUserForm = document.getElementById("createUserForm");
const deleteUserForm = document.getElementById("deleteUserForm");
const adjustBalanceForm = document.getElementById("adjustBalanceForm");
const resolveMatchForm = document.getElementById("resolveMatchForm");
const refreshStateBtn = document.getElementById("refreshStateBtn");
const adminState = document.getElementById("adminState");

const createTeamForm = document.getElementById("createTeamForm");
const refreshTeamsBtn = document.getElementById("refreshTeamsBtn");
const teamsWrap = document.getElementById("teamsWrap");
const changeAdminForm = document.getElementById("changeAdminForm");
const changeAdminTeam = document.getElementById("changeAdminTeam");
const changeAdminMember = document.getElementById("changeAdminMember");

let token = localStorage.getItem("burnmoney-token") || "";
let currentUser = null;
let superTeams = [];

const usernameInput = document.getElementById("username");
const teamField = document.getElementById("teamField");
const loginTeam = document.getElementById("loginTeam");
let teamLoadTimer = null;

async function loadTeamsForUsername() {
  const username = usernameInput.value.trim();
  if (username.length < 3) {
    teamField.hidden = true;
    loginTeam.innerHTML = "";
    return;
  }

  try {
    const data = await request(`/auth/teams?username=${encodeURIComponent(username)}`);
    const teams = data.teams || [];
    loginTeam.innerHTML = "";

    if (teams.length <= 1) {
      teamField.hidden = true;
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a team";
    placeholder.selected = true;
    loginTeam.appendChild(placeholder);

    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      loginTeam.appendChild(option);
    });

    teamField.hidden = false;
  } catch (error) {
    teamField.hidden = true;
    loginTeam.innerHTML = "";
  }
}

usernameInput.addEventListener("input", () => {
  clearTimeout(teamLoadTimer);
  teamLoadTimer = setTimeout(loadTeamsForUsername, 300);
});

const matchIdInput = document.getElementById("matchId");
const resolveMatchIdInput = document.getElementById("resolveMatchId");
const setActiveMatchForm = document.getElementById("setActiveMatchForm");
const resettleMatchForm = document.getElementById("resettleMatchForm");
const resettleMatchId = document.getElementById("resettleMatchId");

function populateResolveMatches(state) {
  const options = new Set();
  if (state.activeMatchId) {
    options.add(state.activeMatchId);
  }
  (state.unsettledMatches || []).forEach((id) => options.add(id));

  resolveMatchIdInput.innerHTML = "";
  if (!options.size) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active match";
    resolveMatchIdInput.appendChild(option);
    return;
  }

  options.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    resolveMatchIdInput.appendChild(option);
  });
}

function populateResettleMatches(state) {
  const matches = state.settledMatches || [];
  resettleMatchId.innerHTML = "";
  if (!matches.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No resolved matches";
    resettleMatchId.appendChild(option);
    return;
  }

  matches.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    resettleMatchId.appendChild(option);
  });
}

function clearSession() {
  token = "";
  currentUser = null;
  localStorage.removeItem("burnmoney-token");
  setLoggedInView(false);
}

function requireSession() {
  if (!token || !currentUser) {
    notify("Please log in first", "error");
    setLoggedInView(false);
    return false;
  }
  return true;
}

function requireRole(role) {
  if (!requireSession()) {
    return false;
  }
  if (currentUser.role !== role) {
    notify("You do not have permission for this action", "error");
    return false;
  }
  return true;
}

function notify(message, type = "ok") {
  toast.textContent = message;
  toast.className = "show " + type;
  setTimeout(() => {
    toast.className = "";
  }, 2200);
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { ...options, headers });
  let body = null;

  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      notify("Session expired. Please log in again.", "error");
    }
    const message = body && body.error ? body.error : "Request failed";
    throw new Error(message);
  }

  return body;
}

function roleLabel(role) {
  if (role === "superuser") return "Superuser";
  if (role === "admin") return "Team Admin";
  return "Gambler";
}

function renderAccountStats(info) {
  const teamLabel = info.team ? info.team : "No team";
  accountStats.innerHTML = `
    <div class="stat">
      <span class="stat-label">User</span>
      <span class="stat-value">${info.user.username}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Team</span>
      <span class="stat-value">${teamLabel}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Balance</span>
      <span class="stat-value">${info.user.balance}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Pool Balance</span>
      <span class="stat-value">${info.poolBalance}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Role</span>
      <span class="stat-value">${roleLabel(info.user.role)}</span>
    </div>
  `;
}

function renderBets(bets) {
  if (!bets.length) {
    betTableWrap.innerHTML = "<p style='padding:0.8rem'>No bets yet.</p>";
    return;
  }

  const rows = bets
    .map(
      (bet) => `
      <tr>
        <td>${bet.matchId}</td>
        <td>${bet.alliance}</td>
        <td>${bet.amount}</td>
        <td>${bet.settled ? "yes" : "no"}</td>
        <td>${new Date(bet.createdAt).toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  betTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Match</th>
          <th>Alliance</th>
          <th>Amount</th>
          <th>Settled</th>
          <th>Placed At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAdminState(state) {
  const rows = state.members
    .map((user) => `<tr><td>${user.username}</td><td>${user.balance}</td></tr>`)
    .join("");

  adminState.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="padding:0.75rem; margin:0; border-top:1px solid var(--row-border);">Pool Balance: <strong>${state.poolBalance}</strong></p>
  `;
}

function renderTeams(state) {
  const teams = state.teams || [];
  if (!teams.length) {
    teamsWrap.innerHTML = "<p style='padding:0.8rem'>No teams yet.</p>";
    return;
  }

  superTeams = teams;
  changeAdminTeam.innerHTML = '<option value="">Select team</option>';
  teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    changeAdminTeam.appendChild(option);
  });

  const rows = teams
    .map(
      (team) => `
      <tr>
        <td>${team.name}</td>
        <td>${team.admin || "—"}</td>
        <td>${team.memberCount}</td>
        <td>${team.poolBalance}</td>
        <td>
          <button class="ghost danger" data-delete-team="${team.id}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");

  teamsWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Team</th>
          <th>Admin</th>
          <th>Members</th>
          <th>Pool</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  teamsWrap.querySelectorAll("[data-delete-team]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteTeam;
      const name = teams.find((team) => team.id === id).name;
      if (!confirm(`Delete team "${name}" and all of its members and bets?`)) {
        return;
      }
      try {
        await request(`/super/teams/${id}`, { method: "DELETE" });
        notify("Team deleted", "ok");
        await refreshSuperTeams();
      } catch (error) {
        notify(error.message, "error");
      }
    });
  });
}

function renderDebtReport(summary, debts) {
  if (!summary.length) {
    debtSummaryWrap.innerHTML = "<p style='padding:0.8rem'>No user totals available.</p>";
  } else {
    const summaryRows = summary
      .map(
        (row) => `
        <tr>
          <td>${row.user}</td>
          <td>${row.owes}</td>
          <td>${row.owedTo}</td>
          <td>${row.net}</td>
        </tr>
      `
      )
      .join("");

    debtSummaryWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Total Owes</th>
            <th>Total Owed To</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
    `;
  }

  if (!debts.length) {
    debtTableWrap.innerHTML = "<p style='padding:0.8rem'>No outstanding debts found.</p>";
    return;
  }

  const rows = debts
    .map(
      (debt) => `
      <tr>
        <td>${debt.from}</td>
        <td>${debt.to}</td>
        <td>${debt.amount}</td>
      </tr>
    `
    )
    .join("");

  debtTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>From (owes)</th>
          <th>To (is owed)</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function refreshMainData() {
  const me = await request("/api/me");
  const myBets = await request("/api/my-bets");
  renderAccountStats(me);
  renderBets(myBets.bets || []);
  currentUser.role = me.user.role;
  currentUser.team = me.team;
  matchIdInput.value = me.activeMatchId || "";
}

async function refreshTeamState() {
  if (!currentUser || currentUser.role !== "admin") {
    return;
  }
  const state = await request("/team/state");
  renderAdminState(state);
  populateResolveMatches(state);
  populateResettleMatches(state);
}

async function refreshTeamDebts() {
  if (!currentUser || currentUser.role !== "admin") {
    return;
  }
  const report = await request("/team/debts");
  renderDebtReport(report.summary || [], report.debts || []);
}

async function refreshSuperTeams() {
  if (!currentUser || currentUser.role !== "superuser") {
    return;
  }
  const state = await request("/super/teams");
  renderTeams(state);
}

function setLoggedInView(isLoggedIn) {
  authCard.hidden = isLoggedIn;
  appSections.hidden = !isLoggedIn;
  logoutBtn.hidden = !isLoggedIn;

  const appControls = appSections.querySelectorAll("input, select, button");
  appControls.forEach((control) => {
    control.disabled = !isLoggedIn;
  });

  const teamControls = teamPanel.querySelectorAll("input, select, button");
  teamControls.forEach((control) => {
    control.disabled = !isLoggedIn;
  });

  const superControls = superPanel.querySelectorAll("input, select, button");
  superControls.forEach((control) => {
    control.disabled = !isLoggedIn;
  });

  if (!isLoggedIn) {
    teamPanel.hidden = true;
    superPanel.hidden = true;
    currentUser = null;
  } else if (currentUser) {
    teamPanel.hidden = currentUser.role !== "admin";
    superPanel.hidden = currentUser.role !== "superuser";
    if (currentUser.role === "admin") {
      teamControls.forEach((control) => {
        control.disabled = false;
      });
    }
    if (currentUser.role === "superuser") {
      superControls.forEach((control) => {
        control.disabled = false;
      });
    }
  }
}

async function loginFromSavedToken() {
  if (!token) {
    return;
  }

  try {
    const me = await request("/api/me");
    currentUser = {
      username: me.user.username,
      role: me.user.role,
      team: me.team,
    };
    setLoggedInView(true);
    await refreshMainData();
    await refreshTeamState();
    await refreshTeamDebts();
    await refreshSuperTeams();
  } catch (error) {
    token = "";
    localStorage.removeItem("burnmoney-token");
    setLoggedInView(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = document.getElementById("password").value;

  if (!teamField.hidden && !loginTeam.value) {
    notify("Select your team", "error");
    return;
  }

  const body = { username, password };
  if (!teamField.hidden && loginTeam.value) {
    body.teamId = loginTeam.value;
  }

  try {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    token = data.token;
    localStorage.setItem("burnmoney-token", token);
    currentUser = data.user;

    setLoggedInView(true);

    await refreshMainData();
    await refreshTeamState();
    await refreshTeamDebts();
    await refreshSuperTeams();
    notify("Logged in", "ok");
    loginForm.reset();
    teamField.hidden = true;
    loginTeam.innerHTML = "";
  } catch (error) {
    notify(error.message, "error");
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  notify("Logged out", "ok");
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireSession()) {
    return;
  }

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (newPassword !== confirmNewPassword) {
    notify("New passwords do not match", "error");
    return;
  }

  try {
    await request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    notify("Password updated", "ok");
    changePasswordForm.reset();
  } catch (error) {
    notify(error.message, "error");
  }
});

betForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireSession()) {
    return;
  }

  const matchId = document.getElementById("matchId").value.trim();
  const alliance = document.getElementById("alliance").value;
  const amount = Number.parseInt(document.getElementById("amount").value, 10);

  try {
    await request("/api/bets", {
      method: "POST",
      body: JSON.stringify({ matchId, alliance, amount }),
    });
    await refreshMainData();
    notify("Bet placed", "ok");
    betForm.reset();
  } catch (error) {
    notify(error.message, "error");
  }
});

createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newMemberPassword").value;
  const initialBalanceRaw = document.getElementById("initialBalance").value;
  const initialBalance = initialBalanceRaw ? Number.parseInt(initialBalanceRaw, 10) : 0;

  try {
    await request("/team/users", {
      method: "POST",
      body: JSON.stringify({ username, password, initialBalance }),
    });
    notify("Member created", "ok");
    createUserForm.reset();
    await refreshTeamState();
  } catch (error) {
    notify(error.message, "error");
  }
});

deleteUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const username = document.getElementById("deleteUsername").value.trim();

  try {
    await request(`/team/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    notify("Member deleted", "ok");
    deleteUserForm.reset();
    await refreshTeamState();
  } catch (error) {
    notify(error.message, "error");
  }
});

adjustBalanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const username = document.getElementById("adjustUsername").value.trim();
  const mode = document.getElementById("balanceMode").value;
  const amount = Number.parseInt(document.getElementById("adjustAmount").value, 10);

  try {
    await request(`/team/users/${encodeURIComponent(username)}/balance`, {
      method: "PATCH",
      body: JSON.stringify({ mode, amount }),
    });
    notify("Balance updated", "ok");
    adjustBalanceForm.reset();
    await refreshTeamState();
  } catch (error) {
    notify(error.message, "error");
  }
});

resolveMatchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const matchId = resolveMatchIdInput.value.trim();
  if (!matchId) {
    notify("Set an active match first", "error");
    return;
  }

  const winningAlliance = document.getElementById("winningAlliance").value;

  try {
    const result = await request("/team/matches/resolve", {
      method: "POST",
      body: JSON.stringify({ matchId, winningAlliance }),
    });

    notify(`Resolved ${result.matchId}`, "ok");
    await refreshMainData();
    await refreshTeamState();
    await refreshTeamDebts();
  } catch (error) {
    notify(error.message, "error");
  }
});

setActiveMatchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const matchId = document.getElementById("activeMatchId").value.trim();
  if (!matchId) {
    notify("Enter a match id", "error");
    return;
  }

  try {
    await request("/team/active-match", {
      method: "PATCH",
      body: JSON.stringify({ matchId }),
    });
    notify(`Active match set to ${matchId}`, "ok");
    setActiveMatchForm.reset();
    await refreshMainData();
    await refreshTeamState();
  } catch (error) {
    notify(error.message, "error");
  }
});

resettleMatchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("admin")) {
    return;
  }

  const matchId = resettleMatchId.value.trim();
  if (!matchId) {
    notify("No resolved match selected", "error");
    return;
  }

  const winningAlliance = document.getElementById("resettleAlliance").value;

  if (!confirm(`Resettle ${matchId} with ${winningAlliance}? This reverses the previous result.`)) {
    return;
  }

  try {
    const result = await request("/team/matches/resettle", {
      method: "POST",
      body: JSON.stringify({ matchId, winningAlliance }),
    });
    notify(`Resettled ${result.matchId}`, "ok");
    await refreshMainData();
    await refreshTeamState();
    await refreshTeamDebts();
  } catch (error) {
    notify(error.message, "error");
  }
});

refreshStateBtn.addEventListener("click", async () => {
  if (!requireRole("admin")) {
    return;
  }

  try {
    await refreshTeamState();
    await refreshTeamDebts();
    notify("State refreshed", "ok");
  } catch (error) {
    notify(error.message, "error");
  }
});

createTeamForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("superuser")) {
    return;
  }

  const name = document.getElementById("teamName").value.trim();
  const adminUsername = document.getElementById("teamAdminUsername").value.trim();
  const adminPassword = document.getElementById("teamAdminPassword").value;
  const initialBalanceRaw = document.getElementById("teamAdminBalance").value;
  const initialBalance = initialBalanceRaw ? Number.parseInt(initialBalanceRaw, 10) : 0;

  try {
    await request("/super/teams", {
      method: "POST",
      body: JSON.stringify({ name, adminUsername, adminPassword, initialBalance }),
    });
    notify("Team created", "ok");
    createTeamForm.reset();
    await refreshSuperTeams();
  } catch (error) {
    notify(error.message, "error");
  }
});

refreshTeamsBtn.addEventListener("click", async () => {
  if (!requireRole("superuser")) {
    return;
  }

  try {
    await refreshSuperTeams();
    notify("Teams refreshed", "ok");
  } catch (error) {
    notify(error.message, "error");
  }
});

changeAdminTeam.addEventListener("change", () => {
  changeAdminMember.innerHTML = '<option value="">Select member</option>';
  const team = superTeams.find((t) => t.id === changeAdminTeam.value);
  if (!team) {
    return;
  }

  (team.members || [])
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach((member) => {
      const option = document.createElement("option");
      option.value = member.username;
      option.textContent = `${member.username}${member.role === "admin" ? " (admin)" : ""}`;
      changeAdminMember.appendChild(option);
    });
});

changeAdminForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireRole("superuser")) {
    return;
  }

  const teamId = changeAdminTeam.value;
  const username = changeAdminMember.value;

  if (!teamId || !username) {
    notify("Select a team and a member", "error");
    return;
  }

  try {
    await request(`/super/teams/${teamId}/admin`, {
      method: "PUT",
      body: JSON.stringify({ username }),
    });
    notify(`Admin changed to ${username}`, "ok");
    changeAdminForm.reset();
    await refreshSuperTeams();
  } catch (error) {
    notify(error.message, "error");
  }
});

setLoggedInView(false);
loginFromSavedToken();