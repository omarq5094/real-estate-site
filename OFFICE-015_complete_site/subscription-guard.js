(function () {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  let blocked = false;

  function showBlockedPage(message) {
    if (blocked) return;
    blocked = true;

    const render = function () {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
      document.title = 'انتهى اشتراك المكتب';
      document.body.innerHTML = '';
      document.body.style.margin = '0';
      document.body.style.fontFamily = 'Tahoma, Arial, sans-serif';
      document.body.style.background = '#071827';
      document.body.style.color = '#f8fafc';

      const page = document.createElement('main');
      page.style.minHeight = '100vh';
      page.style.display = 'grid';
      page.style.placeItems = 'center';
      page.style.padding = '24px';

      const card = document.createElement('section');
      card.style.maxWidth = '620px';
      card.style.width = '100%';
      card.style.padding = '34px 26px';
      card.style.borderRadius = '24px';
      card.style.background = 'rgba(15, 42, 57, .94)';
      card.style.border = '1px solid rgba(148, 163, 184, .24)';
      card.style.boxShadow = '0 20px 50px rgba(0, 0, 0, .28)';
      card.style.textAlign = 'center';

      const title = document.createElement('h1');
      title.textContent = 'انتهى اشتراك المكتب';
      title.style.margin = '0 0 12px';
      title.style.fontSize = 'clamp(25px, 5vw, 34px)';

      const description = document.createElement('p');
      description.textContent = message || 'يرجى التواصل مع مقدم الخدمة لتجديد الاشتراك.';
      description.style.margin = '0';
      description.style.color = '#cbd5e1';
      description.style.fontSize = '17px';
      description.style.lineHeight = '1.9';

      card.appendChild(title);
      card.appendChild(description);
      page.appendChild(card);
      document.body.appendChild(page);
    };

    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  function inspectSubscriptionPayload(payload) {
    if (payload && payload.subscription_blocked === true) {
      showBlockedPage(payload.message || payload.error);
    }
  }

  window.fetch = async function (...args) {
    const response = await nativeFetch(...args);

    response.clone().json()
      .then(inspectSubscriptionPayload)
      .catch(function () {});

    return response;
  };

  async function preflightSubscription() {
    const config = (typeof CONFIG !== 'undefined' && CONFIG) || window.CONFIG;
    if (!config || !config.API_URL) return;

    try {
      const url = new URL(config.API_URL);
      url.searchParams.set('action', 'getSubscriptionStatus');
      url.searchParams.set('_subscription_check', String(Date.now()));
      const response = await nativeFetch(url.toString(), { cache: 'no-store' });
      inspectSubscriptionPayload(await response.json());
    } catch (_) {
      // Temporary connection failures remain handled by the normal page logic.
    }
  }

  window.showSubscriptionBlockedPage = showBlockedPage;
  preflightSubscription();
})();
