(function () {
  "use strict";

  const IMAGE_SELECTOR = [
    ".property-card img",
    ".gallery img",
    ".review-gallery img",
    ".edit-images img",
    ".admin-card-image-wrap img",
    ".admin-image-strip img",
    ".selected-images-grid img",
    ".selected-images-preview img",
    ".property-details img"
  ].join(", ");

  const GROUP_SELECTOR = [
    ".review-gallery",
    ".gallery",
    ".admin-image-strip",
    ".selected-images-grid",
    ".selected-images-preview",
    ".edit-images",
    ".admin-card-image-wrap",
    ".property-card",
    ".property-details"
  ].join(", ");

  let currentImages = [];
  let currentIndex = 0;
  let lightbox = null;
  let lightboxImage = null;
  let counter = null;
  let previousButton = null;
  let nextButton = null;

  function isPlaceholderImage(image) {
    const src = String(image.currentSrc || image.src || "");
    return !src || src.includes("placehold.co") || src.includes("No+Image") || src.startsWith("data:image/svg+xml");
  }

  function getLargeImageUrl(src) {
    const url = String(src || "");
    if (!url) return "";

    if (/drive\.google\.com\/thumbnail/i.test(url)) {
      const idMatch = url.match(/[?&]id=([^&]+)/i);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(decodeURIComponent(idMatch[1]))}&sz=w4000`;
      }

      if (/[?&]sz=/i.test(url)) return url.replace(/([?&]sz=)[^&]+/i, "$1w4000");
      return `${url}${url.includes("?") ? "&" : "?"}sz=w4000`;
    }

    return url;
  }

  function getGroupRoot(image) {
    return image.closest(GROUP_SELECTOR) || image.parentElement || document;
  }

  function toSlide(image) {
    return {
      src: image.currentSrc || image.src || "",
      alt: image.alt || "صورة العقار بالحجم الكبير"
    };
  }

  function getImagesForSelectedImage(selectedImage) {
    const encodedGallery = selectedImage.dataset.zoomGallery;
    if (encodedGallery) {
      try {
        const parsed = JSON.parse(decodeURIComponent(encodedGallery));
        const slides = Array.isArray(parsed)
          ? parsed.filter(Boolean).map((src, index) => ({
              src: String(src),
              alt: `${selectedImage.alt || "صورة العقار"} ${index + 1}`
            }))
          : [];
        if (slides.length) return slides;
      } catch (_) {}
    }

    const root = getGroupRoot(selectedImage);
    const images = Array.from(root.querySelectorAll(IMAGE_SELECTOR))
      .filter((image) => !isPlaceholderImage(image));

    return (images.length ? images : [selectedImage]).map(toSlide);
  }

  function createZoomIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
        <path d="M9 9h6v6H9z" />
      </svg>`;
  }

  function enhanceImage(image) {
    if (!image || image.dataset.zoomReady === "yes" || isPlaceholderImage(image)) return;

    image.dataset.zoomReady = "yes";
    image.classList.add("image-zoomable");

    const clickableTarget = image.parentElement && image.parentElement.tagName === "A"
      ? image.parentElement
      : image;

    if (clickableTarget.parentElement && clickableTarget.parentElement.classList.contains("image-zoom-shell")) return;

    const shell = document.createElement("span");
    shell.className = "image-zoom-shell";

    clickableTarget.parentNode.insertBefore(shell, clickableTarget);
    shell.appendChild(clickableTarget);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-zoom-button";
    button.setAttribute("aria-label", "تكبير الصورة");
    button.setAttribute("title", "تكبير الصورة");
    button.innerHTML = createZoomIcon();
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openLightbox(image);
    });
    shell.appendChild(button);
  }

  function enhanceImages(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (root && root.matches && root.matches(IMAGE_SELECTOR)) enhanceImage(root);
    scope.querySelectorAll(IMAGE_SELECTOR).forEach(enhanceImage);
  }

  function buildLightbox() {
    if (lightbox) return;

    lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "عرض الصورة بالحجم الكبير");
    lightbox.innerHTML = `
      <div class="image-lightbox-backdrop" data-lightbox-close></div>
      <div class="image-lightbox-panel">
        <button class="image-lightbox-close" type="button" data-lightbox-close aria-label="إغلاق العرض" title="إغلاق">×</button>
        <button class="image-lightbox-nav image-lightbox-prev" type="button" aria-label="الصورة السابقة" title="الصورة السابقة">‹</button>
        <img class="image-lightbox-image" alt="صورة العقار بالحجم الكبير" />
        <button class="image-lightbox-nav image-lightbox-next" type="button" aria-label="الصورة التالية" title="الصورة التالية">›</button>
        <div class="image-lightbox-counter" aria-live="polite"></div>
      </div>`;

    document.body.appendChild(lightbox);
    lightboxImage = lightbox.querySelector(".image-lightbox-image");
    counter = lightbox.querySelector(".image-lightbox-counter");
    previousButton = lightbox.querySelector(".image-lightbox-prev");
    nextButton = lightbox.querySelector(".image-lightbox-next");

    lightbox.querySelectorAll("[data-lightbox-close]").forEach((button) => {
      button.addEventListener("click", closeLightbox);
    });
    previousButton.addEventListener("click", function () { moveLightbox(-1); });
    nextButton.addEventListener("click", function () { moveLightbox(1); });
  }

  function openLightbox(selectedImage) {
    buildLightbox();
    currentImages = getImagesForSelectedImage(selectedImage);
    const selectedSrc = selectedImage.currentSrc || selectedImage.src || "";
    const selectedIndex = currentImages.findIndex((item) => item.src === selectedSrc);
    currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    renderLightbox();
    lightbox.classList.add("is-open");
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".image-lightbox-close").focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
  }

  function moveLightbox(step) {
    if (currentImages.length <= 1) return;
    currentIndex = (currentIndex + step + currentImages.length) % currentImages.length;
    renderLightbox();
  }

  function renderLightbox() {
    const selected = currentImages[currentIndex];
    if (!selected || !lightboxImage) return;

    lightboxImage.src = getLargeImageUrl(selected.src);
    lightboxImage.alt = selected.alt || "صورة العقار بالحجم الكبير";

    const multiple = currentImages.length > 1;
    previousButton.hidden = !multiple;
    nextButton.hidden = !multiple;
    counter.hidden = !multiple;
    counter.textContent = multiple ? `${currentIndex + 1} / ${currentImages.length}` : "";
  }

  document.addEventListener("keydown", function (event) {
    if (!lightbox || !lightbox.classList.contains("is-open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") moveLightbox(1);
    if (event.key === "ArrowRight") moveLightbox(-1);
  });

  document.addEventListener("DOMContentLoaded", function () {
    enhanceImages(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) enhanceImages(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
