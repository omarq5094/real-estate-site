const api = CONFIG.API_URL;
let allUsers = [];
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  currentUser = getAuthUser();
  if (!isManagerRole(currentUser && currentUser.role)) {
    showGuardError("هذه الصفحة خاصة بالمدير أو Admin فقط.");
    return;
  }

  document.getElementById("staffGuardStatus").classList.add("hidden");
  document.getElementById("allUsersContent").classList.remove("hidden");

  document.getElementById("refreshUsersBtn").addEventListener("click", loadUsers);
  document.getElementById("userSearchInput").addEventListener("input", renderFilteredUsers);
  document.getElementById("roleFilter").addEventListener("change", renderFilteredUsers);
  document.getElementById("statusFilter").addEventListener("change", renderFilteredUsers);

  loadUsers();
});

function getToken() {
  return getAuthToken();
}

async function apiGet(action, params = {}) {
  if (params && params.token) {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, params)) });
    return response.json();
  }
  const url = new URL(api);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString());
  return res.json();
}

async function loadUsers() {
  const status = document.getElementById("usersStatus");
  const tbody = document.querySelector("#usersTable tbody");

  status.className = "status-box";
  status.textContent = "جاري تحميل المستخدمين...";
  tbody.innerHTML = "";

  try {
    const result = await apiGet("getUsers", { token: getToken() });
    if (!result.ok) throw new Error(result.error || "تعذر تحميل المستخدمين");

    allUsers = result.data || [];
    status.textContent = allUsers.length ? `تم تحميل ${allUsers.length} عضو.` : "لا يوجد أعضاء حاليًا.";
    renderFilteredUsers();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderFilteredUsers() {
  const search = normalize(document.getElementById("userSearchInput").value);
  const role = normalize(document.getElementById("roleFilter").value);
  const status = normalize(document.getElementById("statusFilter").value);

  const filtered = allUsers.filter((user) => {
    const text = normalize(`${user.name || ""} ${user.phone || ""} ${user.email || ""}`);
    const userRole = normalize(user.role);
    const userStatus = normalize(user.status || "active");

    return (!search || text.includes(search))
      && (!role || userRole === role)
      && (!status || userStatus === status);
  });

  renderUsers(filtered);
}

function renderUsers(users) {
  const tbody = document.querySelector("#usersTable tbody");

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6">لا توجد نتائج مطابقة.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((user) => `
    <tr>
      <td><strong>${escapeHtml(user.name || "-")}</strong></td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td>${escapeHtml(user.email || "-")}</td>
      <td>${translateRole(user.role)}</td>
      <td><span class="user-status-pill ${statusClass(user.status)}">${translateStatus(user.status || "active")}</span></td>
      <td><a class="secondary-btn" href="user-properties.html?user_id=${encodeURIComponent(user.user_id)}">عرض العقارات</a></td>
    </tr>
  `).join("");
}

function showGuardError(message) {
  const status = document.getElementById("staffGuardStatus");
  status.className = "status-box error";
  status.textContent = message;

  setTimeout(() => {
    location.href = "admin.html";
  }, 1000);
}

function translateRole(role) {
  const map = {
    admin: "Admin",
    manager: "مدير",
    employee: "موظف",
    customer: "زبون"
  };
  return map[normalize(role)] || role || "-";
}

function translateStatus(status) {
  const map = {
    active: "نشط",
    blocked: "محظور",
    pending: "معلق"
  };
  return map[normalize(status)] || status || "-";
}

function statusClass(status) {
  const value = normalize(status);
  if (value === "active") return "ok";
  if (value === "blocked") return "bad";
  if (value === "pending") return "wait";
  return "";
}

function isManagerRole(role) {
  return ["manager", "admin"].includes(normalize(role));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
