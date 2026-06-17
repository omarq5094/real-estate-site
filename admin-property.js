const api = CONFIG.API_URL;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.getElementById("staffGuardStatus").classList.add("hidden");
  document.getElementById("adminPropertyStatus").classList.remove("hidden");

  loadAdminPropertyDetails();
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

async function loadAdminPropertyDetails() {
  const params = new URLSearchParams(location.search);
  const propertyId = params.get("id");
  const status = document.getElementById("adminPropertyStatus");
  const box = document.getElementById("adminPropertyDetails");

  status.className = "status-box";
  box.classList.add("hidden");
  box.innerHTML = "";

  if (!propertyId) {
    status.classList.add("error");
    status.textContent = "رقم العقار غير موجود في الرابط.";
    return;
  }

  try {
    status.textContent = "جاري تحميل بيانات العقار...";

    const result = await apiGet("getAllPropertiesForAdmin", {
      token: getToken()
    });

    if (!result.ok) throw new Error(result.error || "تعذر تحميل العقارات");

    const rows = result.data || [];
    const property = rows.find((item) => {
      const id = item.property_id || item.id;
      return String(id) === String(propertyId);
    });

    if (!property) throw new Error("العقار غير موجود أو لم يعد متاحًا في النظام.");

    document.title = property.title || "تفاصيل العقار للموظف";
    box.innerHTML = renderAdminProperty(property);
    box.classList.remove("hidden");
    status.classList.add("hidden");
    loadPropertyPerformance(propertyId);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderAdminProperty(p) {
  const propertyId = p.property_id || p.id || "";
  const images = Array.isArray(p.images) ? p.images : [];
  const currentStatus = String(p.status || "").toLowerCase();
  const showReviewActions = currentStatus === "pending" || currentStatus === "needs_update";

  const gallery = images.length
    ? images.slice(0, 8).map((img, index) => `
        <a href="${escapeHtml(img.image_url)}" target="_blank">
          <img src="${escapeHtml(resolveImageUrl(img))}" alt="صورة ${index + 1}" onerror="this.src='https://placehold.co/900x600?text=No+Image'" />
        </a>
      `).join("")
    : `<img src="https://placehold.co/900x600?text=No+Image" alt="لا توجد صورة" />`;

  const map = p.latitude && p.longitude
    ? `<div class="map-box">
        <iframe loading="lazy" src="https://maps.google.com/maps?q=${encodeURIComponent(p.latitude + "," + p.longitude)}&z=15&output=embed"></iframe>
      </div>`
    : "";

  return `
    <div class="review-page-layout">
      <div class="review-main">
        <div class="gallery review-gallery">${gallery}</div>

        <h2>${escapeHtml(p.title || "عقار بدون عنوان")}</h2>
        <p class="meta">رقم العقار: ${escapeHtml(propertyId)} • الحالة: ${escapeHtml(p.status || "-")}</p>

        <div class="details-grid">
          ${detailItem("السعر", `${formatPrice(p.price)} ريال`)}
          ${detailItem("عرض السعر للعملاء", translateShowPrice(p.show_price))}
          ${detailItem("المدينة", p.city || "-")}
          ${detailItem("الحي", p.district || "-")}
          ${detailItem("النوع", translateType(p.type))}
          ${detailItem("الغرض", translatePurpose(p.purpose))}
          ${detailItem("المساحة", `${p.area || "-"} م²`)}
          ${detailItem("الغرف", p.bedrooms || "-")}
          ${detailItem("دورات المياه", p.bathrooms || "-")}
          ${detailItem("Latitude", p.latitude || "-")}
          ${detailItem("Longitude", p.longitude || "-")}
          ${detailItem("تاريخ الإضافة", p.created_at || "-")}
          ${detailItem("آخر تحديث", p.updated_at || "-")}
        </div>

        <div class="modal-description">
          <h3>الوصف</h3>
          <p>${escapeHtml(p.description || "لا يوجد وصف.")}</p>
        </div>

        <div class="actions">
          ${p.map_url ? `<a class="secondary-btn" href="${escapeHtml(p.map_url)}" target="_blank">فتح Google Maps</a>` : ""}
        </div>

        ${map}

        <section class="property-performance-panel is-collapsed" id="propertyPerformancePanel">
          <button class="performance-toggle" type="button" aria-expanded="false" aria-controls="propertyPerformanceContent" onclick="togglePropertyPerformance()">
            <span class="performance-toggle-title">أداء الإعلان</span>
            <span class="performance-toggle-hint">اضغط لعرض مؤشرات التفاعل</span>
            <span class="performance-toggle-icon" aria-hidden="true"></span>
          </button>
          <div class="performance-collapsible-content" id="propertyPerformanceContent" hidden>
            <div class="performance-loading">جاري تحميل أداء الإعلان...</div>
          </div>
        </section>
      </div>

      <aside class="review-side">
        <h3>بيانات المالك</h3>
        <div class="owner-card">
          <strong>${escapeHtml(p.owner_name || "-")}</strong>
          <span>${escapeHtml(p.owner_phone || "-")}</span>
          ${p.owner_phone ? `<a class="secondary-btn" href="tel:${escapeHtml(p.owner_phone)}">اتصال</a>` : ""}
        </div>

        <h3>قرار الموظف</h3>
        <div class="side-actions">
          ${showReviewActions ? `
            <button class="primary-btn" type="button" onclick="approveProperty('${escapeAttr(propertyId)}')">قبول ونشر</button>
            <button class="danger-btn" type="button" onclick="rejectProperty('${escapeAttr(propertyId)}')">رفض</button>
            <button class="warning-btn" type="button" onclick="needsUpdate('${escapeAttr(propertyId)}')">طلب تعديل</button>
          ` : `<a class="secondary-btn" href="all-properties.html">إدارة الحالة من صفحة كل العقارات</a>`}
        </div>

        <h3>ملاحظات المراجعة</h3>
        <div class="review-note-box">${escapeHtml(p.review_note || "لا توجد ملاحظات حتى الآن.")}</div>
      </aside>
    </div>
  `;
}


async function loadPropertyPerformance(propertyId) {
  const content = document.getElementById("propertyPerformanceContent");
  if (!content) return;

  try {
    const result = await apiGet("getPropertyInteractionStats", {
      token: getToken(),
      property_id: propertyId
    });

    if (!result.ok) throw new Error(result.error || "تعذر تحميل أداء الإعلان");
    content.innerHTML = renderPropertyPerformance(result.data || {});
  } catch (error) {
    content.innerHTML = `<div class="performance-error">${escapeHtml(error.message)}</div>`;
  }
}

function togglePropertyPerformance() {
  const panel = document.getElementById("propertyPerformancePanel");
  const content = document.getElementById("propertyPerformanceContent");
  const button = panel ? panel.querySelector(".performance-toggle") : null;
  if (!panel || !content || !button) return;

  const willOpen = content.hidden;
  content.hidden = !willOpen;
  panel.classList.toggle("is-collapsed", !willOpen);
  panel.classList.toggle("is-expanded", willOpen);
  button.setAttribute("aria-expanded", String(willOpen));
}

function renderPropertyPerformance(stats) {
  const counts = stats.counts || {};
  return `
    <div class="performance-details-intro">
      <span class="admin-section-kicker">Advertisement Performance</span>
      <p>مؤشرات التفاعل المرتبطة بهذا العقار فقط.</p>
    </div>
    <div class="performance-grid">
      ${performanceMetric("فتح التفاصيل", counts.view_details || 0, "مشاهدة")}
      ${performanceMetric("نقرات WhatsApp", counts.whatsapp_click || 0, "تواصل مباشر")}
      ${performanceMetric("نقرات الاتصال", counts.call_click || 0, "اتصال")}
      ${performanceMetric("طلبات الاستفسار", counts.lead_inquiry || 0, "Lead")}
      ${performanceMetric("طلبات المعاينة", counts.lead_viewing || 0, "Viewing")}
      ${performanceMetric("آخر 7 أيام", stats.interactions_last_7_days || 0, "تفاعل")}
      ${performanceMetric("منذ النشر", stats.interactions_since_published || 0, "تفاعل")}
    </div>
    <div class="performance-footer">
      <span>آخر تفاعل</span>
      <strong>${escapeHtml(formatInteractionDate(stats.last_interaction_at))}</strong>
    </div>
  `;
}

function performanceMetric(label, value, helper) {
  return `
    <article class="performance-metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${Number(value || 0).toLocaleString("en-US")}</strong>
      <small>${escapeHtml(helper)}</small>
    </article>
  `;
}

function formatInteractionDate(value) {
  if (!value) return "لا يوجد تفاعل حتى الآن";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ar-SA");
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <strong>${escapeHtml(label)}</strong>
      ${escapeHtml(value)}
    </div>
  `;
}

async function approveProperty(propertyId) {
  const note = prompt("ملاحظة القبول:", "تمت الموافقة");
  await reviewAction("approveProperty", propertyId, note || "تمت الموافقة");
}

async function rejectProperty(propertyId) {
  const note = prompt("سبب الرفض:", "معلومات غير مكتملة");
  if (note === null) return;
  await reviewAction("rejectProperty", propertyId, note);
}

async function needsUpdate(propertyId) {
  const note = prompt("ما التعديل المطلوب من العميل؟", "يرجى تحديث الصور أو البيانات");
  if (note === null) return;
  await reviewAction("changePropertyStatus", propertyId, note, "needs_update");
}

async function reviewAction(action, propertyId, note, statusValue) {
  const status = document.getElementById("adminPropertyStatus");
  status.className = "status-box";
  status.textContent = "جاري تنفيذ العملية...";
  status.classList.remove("hidden");

  try {
    const payload = {
      action,
      token: getToken(),
      property_id: propertyId,
      note
    };

    if (statusValue) payload.status = statusValue;

    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "فشلت العملية");

    status.classList.add("success");
    status.textContent = result.message || "تم تنفيذ العملية.";
    setTimeout(() => {
      location.href = "admin.html";
    }, 900);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function formatPrice(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US");
}

function translateShowPrice(value) {
  return String(value || "").toLowerCase() === "yes" ? "نعم، وافق العميل على عرض السعر" : "لا، السعر عند التواصل";
}

function translateType(type) {
  const map = { villa: "فيلا", apartment: "شقة", land: "أرض", building: "عمارة", shop: "محل" };
  return map[type] || type || "-";
}

function translatePurpose(purpose) {
  const map = { sale: "بيع", rent: "إيجار" };
  return map[purpose] || purpose || "-";
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
  return String(value ?? "").replaceAll("'", "\\'");
}


function resolveImageUrl(imgOrUrl) {
  if (!imgOrUrl) return "https://placehold.co/800x500?text=No+Image";

  if (typeof imgOrUrl === "object") {
    if (imgOrUrl.drive_file_id) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(imgOrUrl.drive_file_id)}&sz=w1200`;
    }

    if (imgOrUrl.image_url) {
      return normalizeDriveImageUrl(imgOrUrl.image_url);
    }

    return "https://placehold.co/800x500?text=No+Image";
  }

  return normalizeDriveImageUrl(String(imgOrUrl));
}

function normalizeDriveImageUrl(url) {
  if (!url) return "https://placehold.co/800x500?text=No+Image";

  const text = String(url);

  const idMatch = text.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(idMatch[1])}&sz=w1200`;
  }

  const fileMatch = text.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
  }

  return text;
}
