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
  document.getElementById("usersManagementContent").classList.remove("hidden");
  document.getElementById("refreshUsersBtn").addEventListener("click", loadUsers);

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

async function apiPost(payload) {
  const res = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
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
    const staffUsers = allUsers.filter((user) => ["admin", "manager", "employee"].includes(normalize(user.role)));

    status.textContent = staffUsers.length ? `تم تحميل ${staffUsers.length} حساب إداري.` : "لا يوجد موظفون أو مدراء حاليًا.";
    renderUsers(staffUsers);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderUsers(users) {
  const tbody = document.querySelector("#usersTable tbody");

  if (!users.length) {
    tbody.innerHTML = "";
    return;
  }

  tbody.innerHTML = users.map((user) => {
    const role = normalize(user.role);
    const status = normalize(user.status || "active");
    const disabled = isProtectedUser(user) ? "disabled" : "";

    return `
      <tr>
        <td><strong>${escapeHtml(user.name || "-")}</strong></td>
        <td>${escapeHtml(user.phone || "-")}</td>
        <td>${escapeHtml(user.email || "-")}</td>
        <td>
          <select class="role-select" data-role-select="${escapeAttr(user.user_id)}" ${disabled}>
            ${roleOptions(role)}
          </select>
        </td>
        <td><span class="user-status-pill ${statusClass(status)}">${translateStatus(status)}</span></td>
        <td><a class="secondary-btn" href="user-properties.html?user_id=${encodeURIComponent(user.user_id)}">عرض العقارات</a></td>
        <td>
          <div class="actions user-actions">
            <button class="primary-btn" type="button" onclick="saveUserRole('${escapeAttr(user.user_id)}')" ${disabled}>حفظ</button>
            ${status === "blocked"
              ? `<button class="secondary-btn" type="button" onclick="changeUserStatus('${escapeAttr(user.user_id)}', 'activateUser')" ${disabled}>تفعيل</button>`
              : `<button class="danger-btn" type="button" onclick="changeUserStatus('${escapeAttr(user.user_id)}', 'blockUser')" ${disabled}>حظر</button>`}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function roleOptions(selectedRole) {
  const roles = isAdminRole(currentUser && currentUser.role)
    ? ["customer", "employee", "manager", "admin"]
    : ["customer", "employee", "manager"];

  return roles.map((role) => `
    <option value="${role}" ${role === selectedRole ? "selected" : ""}>${translateRole(role)}</option>
  `).join("");
}

async function saveUserRole(userId) {
  const select = document.querySelector(`[data-role-select="${cssEscape(userId)}"]`);
  if (!select) return;

  const user = allUsers.find((item) => String(item.user_id) === String(userId));
  const newRole = select.value;

  if (!user) return;
  if (normalize(user.role) === newRole) {
    setStatus("لم يتغير شيء.", "success");
    return;
  }

  if (!confirm(`تأكيد تغيير رتبة ${user.name || "المستخدم"} إلى ${translateRole(newRole)}؟`)) return;

  setStatus("جاري حفظ الرتبة...");

  try {
    const result = await apiPost({
      action: "changeUserRole",
      token: getToken(),
      target_user_id: userId,
      new_role: newRole,
      note: "Role changed from users-management page"
    });

    if (!result.ok) throw new Error(result.error || "تعذر تغيير الرتبة");

    setStatus(result.message || "تم تغيير الرتبة.", "success");
    await loadUsers();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function changeUserStatus(userId, action) {
  const user = allUsers.find((item) => String(item.user_id) === String(userId));
  if (!user) return;

  const label = action === "blockUser" ? "حظر" : "تفعيل";
  if (!confirm(`تأكيد ${label} حساب ${user.name || "المستخدم"}؟`)) return;

  setStatus("جاري تنفيذ العملية...");

  try {
    const result = await apiPost({
      action,
      token: getToken(),
      target_user_id: userId
    });

    if (!result.ok) throw new Error(result.error || "تعذر تنفيذ العملية");

    setStatus(result.message || "تم تنفيذ العملية.", "success");
    await loadUsers();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function isProtectedUser(user) {
  const myId = currentUser && currentUser.user_id;
  const targetRole = normalize(user.role);

  if (String(user.user_id) === String(myId)) return true;
  if (targetRole === "admin" && !isAdminRole(currentUser && currentUser.role)) return true;

  return false;
}

function setStatus(message, type = "") {
  const status = document.getElementById("usersStatus");
  status.className = "status-box";
  if (type) status.classList.add(type);
  status.textContent = message;
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

function isAdminRole(role) {
  return normalize(role) === "admin";
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

function escapeAttr(value) {
  return String(value ?? "").replaceAll("'", "&#039;").replaceAll('"', "&quot;");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
