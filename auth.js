const AUTH_STORAGE_KEY = "realEstateAuth";

function saveAuth(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session || {}));
}

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function getAuthToken() {
  return getAuth().token || "";
}

function getAuthUser() {
  return getAuth().user || null;
}

function isLoggedIn() {
  return Boolean(getAuthToken());
}

function isStaffRole(role) {
  return ["employee", "manager", "admin"].includes(String(role || "").toLowerCase());
}

function requireLogin() {
  if (!isLoggedIn()) {
    location.href = "login.html";
    return false;
  }
  return true;
}

async function authApiPost(payload) {
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  return res.json();
}

async function authApiGet(action, params = {}) {
  if (params && params.token) return authApiPost(Object.assign({ action: action }, params));
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString());
  return res.json();
}

async function logoutUser() {
  const token = getAuthToken();

  try {
    if (token) {
      await authApiPost({ action: "logoutUser", token });
    }
  } catch (_) {}

  localStorage.removeItem(AUTH_STORAGE_KEY);
  location.href = "login.html";
}

function navHasHref(node, href) {
  const nav = node.closest(".nav") || node.parentElement;
  return Boolean(nav && Array.from(nav.querySelectorAll("a[href]")).some((link) => link.getAttribute("href") === href));
}

function navHasLogout(node) {
  const nav = node.closest(".nav") || node.parentElement;
  return Boolean(nav && Array.from(nav.querySelectorAll("button[onclick]")).some((button) => String(button.getAttribute("onclick") || "").includes("logoutUser")));
}

function navLink(node, href, label, omitted = false) {
  return omitted || navHasHref(node, href) ? "" : `<a href="${href}">${label}</a>`;
}

function navLogout(node) {
  return navHasLogout(node) ? "" : '<button class="theme-toggle" type="button" onclick="logoutUser()">خروج</button>';
}

function renderAuthNav() {
  const user = getAuthUser();
  const nodes = document.querySelectorAll("[data-auth-nav]");

  nodes.forEach((node) => {
    node.innerHTML = "";

    if (!user) {
      node.innerHTML = `
        ${navLink(node, "login.html", "دخول")}
        ${navLink(node, "register.html", "تسجيل")}
      `;
      return;
    }

    const omitHome = node.hasAttribute("data-auth-nav-omit-home");
    const omitMyProperties = node.hasAttribute("data-auth-nav-omit-my-properties");

    if (isStaffRole(user.role)) {
      node.innerHTML = `
        ${navLink(node, "index.html", "الرئيسية", omitHome)}
        ${navLink(node, "my-properties.html", "عقاراتي", omitMyProperties)}
        ${navLink(node, "admin.html", "لوحة الموظف")}
        ${navLogout(node)}
      `;
      return;
    }

    node.innerHTML = `
      ${navLink(node, "my-properties.html", "عقاراتي", omitMyProperties)}
      ${navLogout(node)}
    `;
  });
}

async function requireStaffPage() {
  if (!requireLogin()) return false;

  const statusNode = document.querySelector("[data-staff-guard-status]");

  try {
    const result = await authApiGet("getCurrentUser", {
      token: getAuthToken()
    });

    if (!result.ok) {
      throw new Error(result.error || "تعذر التحقق من الصلاحية");
    }

    const user = result.user;

    saveAuth({
      token: getAuthToken(),
      user
    });

    if (!isStaffRole(user.role)) {
      if (statusNode) {
        statusNode.className = "status-box error";
        statusNode.textContent = "ليس لديك صلاحية دخول لوحة الموظفين.";
      }

      setTimeout(() => {
        location.href = "my-properties.html";
      }, 900);

      return false;
    }

    return true;
  } catch (error) {
    if (statusNode) {
      statusNode.className = "status-box error";
      statusNode.textContent = error.message;
    }

    setTimeout(() => {
      location.href = "login.html";
    }, 900);

    return false;
  }
}

document.addEventListener("DOMContentLoaded", renderAuthNav);


function requireAuthenticatedPage() {
  if (!isLoggedIn()) {
    const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.href = `login.html?next=${next}`;
    return false;
  }

  return true;
}
