async function api(path, options = {}) {
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

function populatePlacementOptions(select, placements) {
  select.innerHTML = placements
    .map(p => `<option value="${p.key}">${p.label} (${p.page})</option>`)
    .join('');
}

export async function initAdvertsPage() {
  const form = document.querySelector('[data-ad-submit-form]');
  const placementSelect = document.querySelector('select[name="placement"]');
  const status = document.getElementById('ad-submit-status');
  const placementsTarget = document.getElementById('placements-grid');

  if (!form || !placementSelect) {
    return;
  }

  try {
    const data = await api('/api/ads/placements');
    populatePlacementOptions(placementSelect, data.placements || []);
    if (placementsTarget) {
      placementsTarget.innerHTML = (data.placements || [])
        .map(item => `<li class="bg-slate-50 rounded-xl p-3"><strong>${item.label}</strong><br/><span class="text-slate-500">${item.page} - ${item.priority} priority</span></li>`)
        .join('');
    }
  } catch (error) {
    if (status) status.textContent = 'Could not load ad placement inventory.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      companyName: String(formData.get('companyName') || ''),
      contactName: String(formData.get('contactName') || ''),
      contactEmail: String(formData.get('contactEmail') || ''),
      contactPhone: String(formData.get('contactPhone') || ''),
      adCategory: String(formData.get('adCategory') || ''),
      targetCity: String(formData.get('targetCity') || ''),
      budgetUsd: Number(formData.get('budgetUsd') || 0),
      sourceChannel: String(formData.get('sourceChannel') || ''),
      objective: String(formData.get('objective') || ''),
      creativeSummary: String(formData.get('creativeSummary') || ''),
      placement: String(formData.get('placement') || ''),
      website: String(formData.get('website') || '')
    };

    try {
      if (status) status.textContent = 'Submitting advert request...';
      const csrfCookie = localStorage.getItem('sd_csrf') || 'local-preview';
      const result = await api('/api/ads/submit', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfCookie,
          'x-csrf-cookie': csrfCookie
        },
        body: JSON.stringify(payload)
      });

      if (status) {
        status.textContent = `Advert request submitted (${result.submission?.status || result.status || 'pending'}).`;
      }
      form.reset();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  });
}
