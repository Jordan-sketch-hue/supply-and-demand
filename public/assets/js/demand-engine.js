const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
}

function inferService(query) {
  const lower = query.toLowerCase();
  if (lower.includes('plumb')) return 'Plumber';
  if (lower.includes('mechanic') || lower.includes('car')) return 'Mechanic';
  if (lower.includes('design')) return 'Designer';
  if (lower.includes('cater')) return 'Catering';
  return 'General Request';
}

function inferUrgency(query) {
  const lower = query.toLowerCase();
  return lower.includes('urgent') || lower.includes('now') || lower.includes('asap') ? 'Urgent' : 'Standard';
}

function supplierCard(item) {
  const score = Number(item.trust_score || 4.5).toFixed(2);
  const distance = Number(item.distance_km || 1.5).toFixed(1);
  const eta = Number(item.available_minutes || 60);
  const badge = item.verified_badge ? 'Verified + Insured' : 'Standard';

  return `
    <article class="bg-white rounded-2xl p-5 card-lift border border-slate-100">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-xl font-semibold">${item.business_name}</h2>
        <span class="text-xs font-semibold ${item.verified_badge ? 'bg-blue-50 text-services' : 'bg-slate-100 text-slate-700'} px-2 py-1 rounded-full">${badge}</span>
      </div>
      <p class="text-sm text-slate-600 mt-2">${item.service_title}</p>
      <div class="mt-4 flex flex-wrap gap-2 text-xs">
        <span class="bg-slate-100 px-2 py-1 rounded-full">${score} trust score</span>
        <span class="bg-slate-100 px-2 py-1 rounded-full">${distance} km away</span>
        <span class="bg-slate-100 px-2 py-1 rounded-full">Available in ${eta} min</span>
      </div>
      <div class="mt-5 flex gap-3">
        <button class="grad-btn text-white rounded-full px-4 py-2 text-sm">Book Instantly</button>
        <button class="rounded-full px-4 py-2 text-sm border border-slate-300">Request Quote</button>
      </div>
    </article>
  `;
}

async function loadTrends() {
  const target = document.getElementById('trend-list');
  if (!target) {
    return;
  }

  try {
    const data = await apiFetch('/trending-demands');
    target.innerHTML = data.trends
      .map(item => `<li class="bg-slate-50 p-2 rounded-lg">${item.query_text} - ${item.city} (${item.demand_count})</li>`)
      .join('');
  } catch (error) {
    target.innerHTML = '<li class="text-slate-500">Trend feed unavailable right now.</li>';
  }
}

function saveRecentSearch(query) {
  const key = 'sd_recent_searches';
  const current = JSON.parse(localStorage.getItem(key) || '[]');
  const next = [query, ...current.filter(item => item !== query)].slice(0, 5);
  localStorage.setItem(key, JSON.stringify(next));

  const list = document.getElementById('recent-searches');
  if (list) {
    list.innerHTML = next.map(item => `<button class="text-left underline decoration-services" data-recent-search="${item}">${item}</button>`).join('');
  }
}

function attachRecentSearchClick(input, onSearch) {
  const list = document.getElementById('recent-searches');
  if (!list) {
    return;
  }

  list.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const value = target.getAttribute('data-recent-search');
    if (!value) return;
    input.value = value;
    onSearch(value);
  });
}

export function initDemandSearchPage() {
  const form = document.querySelector('[data-demand-search-form]');
  const input = document.querySelector('input[name="demand"]');
  const resultList = document.getElementById('result-list');

  if (!form || !input || !resultList) {
    return;
  }

  const renderFromQuery = async rawQuery => {
    const query = rawQuery.trim();
    if (!query) return;

    document.getElementById('parse-service').textContent = inferService(query);
    document.getElementById('parse-urgency').textContent = inferUrgency(query);
    saveRecentSearch(query);

    resultList.innerHTML = '<article class="bg-white rounded-2xl p-5 border border-slate-100">Loading matches...</article>';
    try {
      const response = await apiFetch(`/demand-search?q=${encodeURIComponent(query)}`);
      resultList.innerHTML = response.results.length
        ? response.results.map(supplierCard).join('')
        : '<article class="bg-white rounded-2xl p-5 border border-slate-100">No suppliers found yet in this category. Try a broader search.</article>';
    } catch (error) {
      resultList.innerHTML = `<article class="bg-white rounded-2xl p-5 border border-red-200 text-red-700">${error.message}</article>`;
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    renderFromQuery(input.value);
  });

  attachRecentSearchClick(input, renderFromQuery);
  loadTrends();

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    input.value = q;
    renderFromQuery(q);
  }
}

export function initPostRequestPage() {
  const form = document.querySelector('[data-demand-request-form]');
  if (!form) {
    return;
  }

  const status = document.getElementById('request-status');
  form.addEventListener('submit', async event => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      rawQuery: String(formData.get('rawQuery') || '').trim(),
      category: String(formData.get('category') || '').trim(),
      urgency: String(formData.get('urgency') || '').trim(),
      country: String(formData.get('country') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      neighborhood: String(formData.get('neighborhood') || '').trim(),
      details: String(formData.get('details') || '').trim()
    };

    if (!payload.rawQuery) {
      if (status) status.textContent = 'Please enter what you need.';
      return;
    }

    if (status) status.textContent = 'Submitting request...';
    try {
      const csrf = localStorage.getItem('sd_csrf') || 'local-preview';
      const response = await apiFetch('/demand-request', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrf,
          'x-csrf-cookie': csrf
        },
        body: JSON.stringify(payload)
      });
      if (status) {
        status.textContent = `Demand request posted. Ticket: ${response.id}`;
      }
      form.reset();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  });
}
