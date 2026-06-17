let SITE_SETTINGS = null;

async function loadSiteSettings() {
  const defaults = {
    contact_phone: "0533172872",
    whatsapp_message: "السلام عليكم، أرغب بالاستفسار عن عقار",
    office_name: "مكتب العقار",
    platform_title: "منصة العقارات",
    platform_subtitle: "اعرض، ابحث، أو أضف عقارك للمراجعة.",
    office_address: "",
    max_images_per_property: 10,
    allow_customer_register: "yes",
    maintenance_mode: "off",
    homepage_title: "واجهة عقارية حديثة لمكتبك",
    homepage_subtitle: "تجربة عرض سريعة، فلترة واضحة، ونظام مراجعة قبل النشر لضمان جودة الإعلانات.",
    footer_text: ""
  };

  SITE_SETTINGS = {
    ...defaults,
    ...(typeof SITE_CONFIG !== "undefined" ? SITE_CONFIG : {})
  };

  applySiteSettings(SITE_SETTINGS);
  return SITE_SETTINGS;
}

function applySiteSettings(settings) {
  if (!settings) return;

  if (settings.max_images_per_property) {
    CONFIG.MAX_IMAGES_PER_PROPERTY = Number(settings.max_images_per_property || CONFIG.MAX_IMAGES_PER_PROPERTY || 10);
  }


  const platformTitleNode = document.querySelector("[data-platform-title]");
  if (platformTitleNode && settings.platform_title) {
    platformTitleNode.textContent = settings.platform_title;
    document.title = settings.platform_title;
  }

  const platformSubtitleNode = document.querySelector("[data-platform-subtitle]");
  if (platformSubtitleNode && settings.platform_subtitle) {
    platformSubtitleNode.textContent = settings.platform_subtitle;
  }

  const titleNode = document.querySelector("[data-homepage-title]");
  if (titleNode && settings.homepage_title) {
    titleNode.textContent = settings.homepage_title;
  }

  const subtitleNode = document.querySelector("[data-homepage-subtitle]");
  if (subtitleNode && settings.homepage_subtitle) {
    subtitleNode.textContent = settings.homepage_subtitle;
  }

  document.querySelectorAll("[data-office-name]").forEach((node) => {
    node.textContent = settings.office_name || "";
  });

  document.querySelectorAll("[data-office-address]").forEach((node) => {
    node.textContent = settings.office_address || "";
  });

  const footerText = String(settings.footer_text || "").trim();
  document.querySelectorAll("[data-footer-text]").forEach((node) => {
    node.textContent = footerText;
    const footer = node.closest(".footer");
    if (footer) footer.classList.toggle("hidden", !footerText);
  });

  if (settings.maintenance_mode === "on") {
    showMaintenanceBanner();
  }

  if (settings.allow_customer_register === "no") {
    document.querySelectorAll("[data-register-link]").forEach((node) => {
      node.classList.add("hidden");
    });
  }
}

function showMaintenanceBanner() {
  if (document.getElementById("maintenanceBanner")) return;

  const banner = document.createElement("div");
  banner.id = "maintenanceBanner";
  banner.className = "maintenance-banner";
  banner.textContent = "الموقع في وضع الصيانة مؤقتًا. قد تكون بعض الخدمات غير متاحة.";

  document.body.prepend(banner);
}

function getContactSettingsFromSiteSettings() {
  const data = SITE_SETTINGS || {};
  /* OFFICE_GENERATOR_SEPARATE_PHONES */
  const phone = data.contact_phone || CONFIG.CONTACT_PHONE || "";
  const whatsappPhone = normalizeSaudiPhone(data.whatsapp_phone || data.normalized_phone || CONFIG.WHATSAPP_PHONE || phone);
  const callPhone = normalizeSaudiPhone(phone);
  const message = data.whatsapp_message || CONFIG.WHATSAPP_MESSAGE || "السلام عليكم، أرغب بالاستفسار عن عقار";

  return {
    phone,
    whatsappPhone,
    message,
    whatsappUrl: whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}` : "",
    callUrl: callPhone ? `tel:+${callPhone}` : ""
  };
}

function normalizeSaudiPhone(phone) {
  let value = String(phone || "").replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");

  if (!value) return "";

  if (value.startsWith("00")) value = value.substring(2);
  if (value.startsWith("0")) value = "966" + value.substring(1);
  if (value.startsWith("5") && value.length === 9) value = "966" + value;

  return /^9665\d{8}$/.test(value) ? value : "";
}
