const api = CONFIG.API_URL;
let currentUser = null;
let targetUserId = "";

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  currentUser = getAuthUser();
  if (!isManagerRole(currentUser && currentUser.role)) {
    showGuardError("هذه الصفحة خاصة بالمدير أو Admin فقط.");
    return;
  }

  targetUserId = new URLSearchParams(location.search).get("user_id") || "";
  if (!targetUserId) {
    showGuardError("رقم العضو غير موجود في الرابط.");
    return;
  }

  document.getElementById("staffGuardStatus").classList.add("hidden");
  document.getElementById("userPropertiesContent").classList.remove("hidden");
  document.getElementById("refreshUserPropertiesBtn").addEventListener("click", loadUserProperties);

  loadUserProperties();
});

async function apiGet(action, params = {}) {
  if (params && params.token) {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, params)) });
    return response.json();
  }
  const url = new URL(api);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url.toString());
  return res.json();
}

async function loadUserProperties() {
  const status = document.getElementById("userPropertiesStatus");
  const grid = document.getElementById("userPropertiesGrid");
  status.className = "status-box";
  status.textContent = "جاري تحميل العقارات...";
  grid.innerHTML = "";

  try {
    const result = await apiGet("getUserProperties", { token: getAuthToken(), target_user_id: targetUserId });
    if (!result.ok) throw new Error(result.error || "تعذر تحميل عقارات العضو");

    const target = result.target_user || {};
    const items = result.data || [];
    document.getElementById("targetUserName").textContent = `${target.name || "عضو"} — ${translateRole(target.role)}`;
    document.getElementById("targetUserMeta").textContent = `${target.phone || "-"} • ${target.email || "-"}`;

    status.textContent = items.length ? `تم تحميل ${items.length} عقار.` : "لا توجد عقارات لهذا العضو.";
    grid.innerHTML = items.map(renderPropertyCard).join("");
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderPropertyCard(p) {
  const id = p.property_id || "";
  const image = getCoverImage(p.images);
  const st = String(p.status || "").toLowerCase();
  return `
    <article class="property-card">
      <img src="${escapeHtml(image)}" onerror="this.src='https://placehold.co/800x500?text=No+Image'" />
      <div class="card-body">
        <div class="property-card-badges">
          <span class="status-pill ${getStatusClass(st)}">${translateStatus(st)}</span>
          ${String(p.is_featured || "").toLowerCase() === "yes" ? `<span class="status-pill ok">مثبت بالأعلى</span>` : ""}
        </div>
        <h3>${escapeHtml(p.title || "عقار بدون عنوان")}</h3>
        <div class="meta">${escapeHtml(p.city || "")} - ${escapeHtml(p.district || "")}</div>
        <div class="price">${formatPrice(p.price)} ريال</div>
        ${renderShowPriceBadge(p.show_price)}
        <div class="meta">${translateType(p.type)} • ${translatePurpose(p.purpose)} • ${p.area || "-"} م²</div>
        <div class="actions">
          <a class="secondary-btn" href="admin-property.html?id=${encodeURIComponent(id)}">عرض التفاصيل</a>
        </div>
      </div>
    </article>`;
}

function renderShowPriceBadge(value) {
  const show = String(value || "").toLowerCase() === "yes";
  return `<div class="price-visibility-badge ${show ? "visible" : "hidden-price"}">${show ? "العميل وافق على عرض السعر" : "العميل لا يريد عرض السعر"}</div>`;
}

function getCoverImage(images) {
  if (!Array.isArray(images) || !images.length) return "https://placehold.co/800x500?text=No+Image";
  const cover = images.find((img) => String(img.is_cover || "").toLowerCase() === "yes");
  return resolveImageUrl(cover || images[0]);
}

function resolveImageUrl(imgOrUrl) {
  if (!imgOrUrl) return "https://placehold.co/800x500?text=No+Image";
  if (typeof imgOrUrl === "object") {
    if (imgOrUrl.drive_file_id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(imgOrUrl.drive_file_id)}&sz=w1200`;
    if (imgOrUrl.image_url) return normalizeDriveImageUrl(imgOrUrl.image_url);
    return "https://placehold.co/800x500?text=No+Image";
  }
  return normalizeDriveImageUrl(String(imgOrUrl));
}

function normalizeDriveImageUrl(url) {
  const text = String(url || "");
  const idMatch = text.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(idMatch[1])}&sz=w1200`;
  const fileMatch = text.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
  return text || "https://placehold.co/800x500?text=No+Image";
}

function translateRole(role) {
  const map = { admin: "Admin", manager: "مدير", employee: "موظف", customer: "زبون" };
  return map[String(role || "").toLowerCase()] || role || "-";
}
function translateType(type) { return ({ villa: "فيلا", apartment: "شقة", land: "أرض", building: "عمارة", shop: "محل" })[type] || type || "-"; }
function translatePurpose(purpose) { return ({ sale: "بيع", rent: "إيجار" })[purpose] || purpose || "-"; }
function translateStatus(status) { return ({ pending: "تحت المراجعة", active: "منشور", needs_update: "يحتاج تعديل", rejected: "مرفوض", hidden: "مخفي", sold: "مباع", rented: "مؤجر", archived: "مؤرشف", deleted_by_owner: "محذوف من المالك" })[status] || status || "-"; }
function getStatusClass(status) { const s = String(status || "").toLowerCase(); if (s === "active") return "ok"; if (s === "pending") return "wait"; if (s === "needs_update") return "warn"; if (["rejected", "deleted_by_owner"].includes(s)) return "bad"; return ""; }
function formatPrice(value) { return Number(value || 0).toLocaleString("en-US"); }
function isManagerRole(role) { return ["manager", "admin"].includes(String(role || "").toLowerCase()); }
function showGuardError(message) { const status = document.getElementById("staffGuardStatus"); status.className = "status-box error"; status.textContent = message; setTimeout(() => { location.href = "admin.html"; }, 1200); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
