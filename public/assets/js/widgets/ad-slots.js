async function fetchJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function renderSlot(el, ad) {
  el.innerHTML = `
    <article class="rounded-xl border border-slate-200 bg-white p-4 card-lift">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Sponsored</p>
      <h4 class="mt-2 font-semibold text-midnight">${ad.company_name}</h4>
      <p class="mt-2 text-sm text-slate-600">${ad.objective}</p>
      <a href="./pages/adverts.html" class="mt-3 inline-block text-services text-sm font-semibold">Promote your brand</a>
    </article>
  `;
}

export async function initAdSlots() {
  const slots = document.querySelectorAll('[data-ad-slot]');
  if (slots.length === 0) {
    return;
  }

  for (const slot of slots) {
    const placement = slot.getAttribute('data-ad-slot');
    if (!placement) continue;

    try {
      const data = await fetchJson(`/api/ads/list?placement=${encodeURIComponent(placement)}`);
      if (!data.adverts || data.adverts.length === 0) {
        slot.innerHTML = `
          <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Sponsored Slot</p>
            <p class="mt-2 text-sm text-slate-700 font-semibold">Place your ad here</p>
            <a href="./pages/adverts.html" class="mt-2 inline-block text-services text-sm">Submit an advert request</a>
          </div>
        `;
        continue;
      }

      renderSlot(slot, data.adverts[0]);
    } catch (error) {
      slot.innerHTML = '<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Sponsored placement unavailable.</div>';
    }
  }
}
