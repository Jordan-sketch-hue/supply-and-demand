import { authRequest, ensureUser } from './auth-client.js';

const state = {
  adverts: {
    page: 1,
    totalPages: 1,
    filters: { q: '', status: '', placement: '', from: '', to: '' }
  },
  docs: {
    page: 1,
    totalPages: 1,
    filters: { q: '', status: '', from: '', to: '' }
  },
  audit: {
    page: 1,
    totalPages: 1,
    filters: { q: '', action: '', entityType: '', from: '', to: '' }
  }
};

function rowHtml(item) {
  return `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-3 text-xs text-slate-500">${item.case_type}</td>
      <td class="py-2 pr-3">${item.summary || '-'}</td>
      <td class="py-2 pr-3">${item.severity}</td>
      <td class="py-2 pr-3">${item.status}</td>
      <td class="py-2 text-xs text-slate-500">${item.reference_id || '-'}</td>
    </tr>
  `;
}

function advertRowHtml(item) {
  return `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-3"><input data-advert-checkbox="${item.id}" type="checkbox" /></td>
      <td class="py-2 pr-3">
        <div class="font-medium">${item.company_name}</div>
        <div class="text-xs text-slate-500">${item.contact_email || ''}</div>
      </td>
      <td class="py-2 pr-3">${item.ad_category || '-'}</td>
      <td class="py-2 pr-3 text-xs text-slate-500">${item.placement}</td>
      <td class="py-2 pr-3">${item.status}</td>
      <td class="py-2 pr-3">${item.budget_usd ?? '-'}</td>
      <td class="py-2">
        <div class="flex flex-wrap gap-2">
          <button data-advert-action="approved" data-advert-id="${item.id}" class="text-xs rounded-full border px-2 py-1">Approve</button>
          <button data-advert-action="rejected" data-advert-id="${item.id}" class="text-xs rounded-full border px-2 py-1">Reject</button>
          <button data-advert-action="live" data-advert-id="${item.id}" class="text-xs rounded-full border px-2 py-1">Go Live</button>
        </div>
      </td>
    </tr>
  `;
}

function verificationRowHtml(item) {
  const safeUrl = item.file_url || '#';
  return `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-3"><input data-doc-checkbox="${item.id}" type="checkbox" /></td>
      <td class="py-2 pr-3">
        <div class="font-medium">${item.business_name || '-'}</div>
        <div class="text-xs text-slate-500">${item.supplier_email || ''}</div>
      </td>
      <td class="py-2 pr-3">${item.doc_type}</td>
      <td class="py-2 pr-3">${item.review_status}</td>
      <td class="py-2 pr-3"><a class="text-services text-xs" target="_blank" rel="noopener noreferrer" href="${safeUrl}">Open file</a></td>
      <td class="py-2">
        <div class="flex flex-wrap gap-2">
          <button data-doc-action="approved" data-doc-id="${item.id}" class="text-xs rounded-full border px-2 py-1">Approve</button>
          <button data-doc-action="rejected" data-doc-id="${item.id}" class="text-xs rounded-full border px-2 py-1">Reject</button>
        </div>
      </td>
    </tr>
  `;
}

function auditRowHtml(item) {
  const details = item.details ? JSON.stringify(item.details) : '{}';
  return `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-3 text-xs text-slate-500">${new Date(item.created_at).toLocaleString()}</td>
      <td class="py-2 pr-3">${item.actor_email || '-'}</td>
      <td class="py-2 pr-3">${item.action}</td>
      <td class="py-2 pr-3">${item.entity_type}</td>
      <td class="py-2 pr-3 text-xs text-slate-500">${item.entity_id || '-'}</td>
      <td class="py-2 text-xs text-slate-600">${details}</td>
    </tr>
  `;
}

function parseForm(form) {
  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = String(value || '').trim();
  }
  return payload;
}

function selectedIds(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter(el => el.checked)
    .map(el => String(el.getAttribute('data-advert-checkbox') || el.getAttribute('data-doc-checkbox') || '').trim())
    .filter(Boolean);
}

export async function initAdminConsole() {
  const status = document.getElementById('admin-status');
  const tableBody = document.getElementById('trust-case-rows');
  const shell = document.getElementById('admin-shell');
  const advertsRows = document.getElementById('adverts-rows');
  const verificationRows = document.getElementById('verification-rows');
  const auditRows = document.getElementById('audit-rows');
  const advertFilterForm = document.querySelector('[data-advert-filter-form]');
  const docFilterForm = document.querySelector('[data-doc-filter-form]');
  const auditFilterForm = document.querySelector('[data-audit-filter-form]');

  const advertsMeta = document.getElementById('adverts-page-meta');
  const docsMeta = document.getElementById('docs-page-meta');
  const auditMeta = document.getElementById('audit-page-meta');

  const advertsPrev = document.getElementById('adverts-prev');
  const advertsNext = document.getElementById('adverts-next');
  const docsPrev = document.getElementById('docs-prev');
  const docsNext = document.getElementById('docs-next');
  const auditPrev = document.getElementById('audit-prev');
  const auditNext = document.getElementById('audit-next');

  const advertsSelectAll = document.getElementById('adverts-select-all');
  const docsSelectAll = document.getElementById('docs-select-all');

  if (!status || !tableBody || !shell || !advertsRows || !verificationRows || !auditRows) {
    return;
  }

  const loadAdverts = async () => {
    const params = new URLSearchParams();
    Object.entries(state.adverts.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', String(state.adverts.page));
    params.set('pageSize', '15');

    const response = await authRequest(`/api/admin/adverts?${params.toString()}`);
    advertsRows.innerHTML = response.adverts.map(advertRowHtml).join('') || '<tr><td colspan="7" class="py-4 text-slate-500">No advert submissions found.</td></tr>';
    state.adverts.totalPages = response.pagination.totalPages;
    if (advertsMeta) {
      advertsMeta.textContent = `Page ${response.pagination.page} of ${response.pagination.totalPages} (${response.pagination.total} total)`;
    }
  };

  const loadVerificationDocs = async () => {
    const params = new URLSearchParams();
    Object.entries(state.docs.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', String(state.docs.page));
    params.set('pageSize', '15');

    const response = await authRequest(`/api/admin/verification-docs?${params.toString()}`);
    verificationRows.innerHTML = response.documents.map(verificationRowHtml).join('') || '<tr><td colspan="6" class="py-4 text-slate-500">No verification docs found.</td></tr>';
    state.docs.totalPages = response.pagination.totalPages;
    if (docsMeta) {
      docsMeta.textContent = `Page ${response.pagination.page} of ${response.pagination.totalPages} (${response.pagination.total} total)`;
    }
  };

  const loadAuditLogs = async () => {
    const params = new URLSearchParams();
    Object.entries(state.audit.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', String(state.audit.page));
    params.set('pageSize', '20');

    const response = await authRequest(`/api/admin/audit-logs?${params.toString()}`);
    auditRows.innerHTML = response.logs.map(auditRowHtml).join('') || '<tr><td colspan="6" class="py-4 text-slate-500">No audit entries found.</td></tr>';
    state.audit.totalPages = response.pagination.totalPages;
    if (auditMeta) {
      auditMeta.textContent = `Page ${response.pagination.page} of ${response.pagination.totalPages} (${response.pagination.total} total)`;
    }
  };

  const refreshAll = async () => {
    const queue = await authRequest('/api/admin/trust-queue');
    tableBody.innerHTML = queue.cases.map(rowHtml).join('') || '<tr><td colspan="5" class="py-4 text-slate-500">No active cases.</td></tr>';
    await Promise.all([loadAdverts(), loadVerificationDocs(), loadAuditLogs()]);
    status.textContent = `Loaded ${queue.cases.length} trust cases with advert, verification, and audit queues.`;
  };

  try {
    const session = await ensureUser();
    if (session.user.role !== 'admin') {
      status.textContent = 'Admin role required. Redirecting to login...';
      setTimeout(() => {
        window.location.href = './login.html?next=admin-console';
      }, 700);
      return;
    }
    shell.classList.remove('hidden');
    await refreshAll();
  } catch (error) {
    status.textContent = `${error.message}. Redirecting to login...`;
    setTimeout(() => {
      window.location.href = './login.html?next=admin-console';
    }, 700);
    return;
  }

  if (advertFilterForm) {
    advertFilterForm.addEventListener('submit', async event => {
      event.preventDefault();
      state.adverts.filters = parseForm(advertFilterForm);
      state.adverts.page = 1;
      await loadAdverts();
    });
  }

  if (docFilterForm) {
    docFilterForm.addEventListener('submit', async event => {
      event.preventDefault();
      state.docs.filters = parseForm(docFilterForm);
      state.docs.page = 1;
      await loadVerificationDocs();
    });
  }

  if (auditFilterForm) {
    auditFilterForm.addEventListener('submit', async event => {
      event.preventDefault();
      state.audit.filters = parseForm(auditFilterForm);
      state.audit.page = 1;
      await loadAuditLogs();
    });
  }

  advertsPrev?.addEventListener('click', async () => {
    state.adverts.page = Math.max(1, state.adverts.page - 1);
    await loadAdverts();
  });

  advertsNext?.addEventListener('click', async () => {
    state.adverts.page = Math.min(state.adverts.totalPages, state.adverts.page + 1);
    await loadAdverts();
  });

  docsPrev?.addEventListener('click', async () => {
    state.docs.page = Math.max(1, state.docs.page - 1);
    await loadVerificationDocs();
  });

  docsNext?.addEventListener('click', async () => {
    state.docs.page = Math.min(state.docs.totalPages, state.docs.page + 1);
    await loadVerificationDocs();
  });

  auditPrev?.addEventListener('click', async () => {
    state.audit.page = Math.max(1, state.audit.page - 1);
    await loadAuditLogs();
  });

  auditNext?.addEventListener('click', async () => {
    state.audit.page = Math.min(state.audit.totalPages, state.audit.page + 1);
    await loadAuditLogs();
  });

  advertsSelectAll?.addEventListener('change', () => {
    const checked = advertsSelectAll.checked;
    document.querySelectorAll('[data-advert-checkbox]').forEach(el => {
      el.checked = checked;
    });
  });

  docsSelectAll?.addEventListener('change', () => {
    const checked = docsSelectAll.checked;
    document.querySelectorAll('[data-doc-checkbox]').forEach(el => {
      el.checked = checked;
    });
  });

  advertsRows.addEventListener('click', async event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const advertId = target.getAttribute('data-advert-id');
    const action = target.getAttribute('data-advert-action');
    if (!advertId || !action) return;

    try {
      const result = await authRequest('/api/admin/review-advert', {
        method: 'POST',
        body: { advertId, status: action }
      });
      status.textContent = `Advert ${result.advert.id} updated to ${result.advert.status}.`;
      await Promise.all([loadAdverts(), loadAuditLogs()]);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  verificationRows.addEventListener('click', async event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const documentId = target.getAttribute('data-doc-id');
    const reviewStatus = target.getAttribute('data-doc-action');
    if (!documentId || !reviewStatus) return;

    try {
      const result = await authRequest('/api/admin/review-verification', {
        method: 'POST',
        body: { documentId, reviewStatus, reviewerNotes: '' }
      });
      status.textContent = `Document ${result.document.id} updated to ${result.document.review_status}.`;
      await Promise.all([loadVerificationDocs(), loadAuditLogs()]);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.querySelectorAll('[data-advert-bulk]').forEach(button => {
    button.addEventListener('click', async () => {
      const selected = selectedIds('[data-advert-checkbox]');
      if (selected.length === 0) {
        status.textContent = 'Select one or more adverts first.';
        return;
      }

      const action = button.getAttribute('data-advert-bulk');
      if (!action) return;

      try {
        const result = await authRequest('/api/admin/review-advert', {
          method: 'POST',
          body: { advertIds: selected, status: action }
        });
        status.textContent = `Updated ${result.updatedCount} adverts to ${action}.`;
        await Promise.all([loadAdverts(), loadAuditLogs()]);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  });

  document.querySelectorAll('[data-doc-bulk]').forEach(button => {
    button.addEventListener('click', async () => {
      const selected = selectedIds('[data-doc-checkbox]');
      if (selected.length === 0) {
        status.textContent = 'Select one or more documents first.';
        return;
      }

      const action = button.getAttribute('data-doc-bulk');
      if (!action) return;

      try {
        const result = await authRequest('/api/admin/review-verification', {
          method: 'POST',
          body: { documentIds: selected, reviewStatus: action, reviewerNotes: '' }
        });
        status.textContent = `Updated ${result.updatedCount} verification docs to ${action}.`;
        await Promise.all([loadVerificationDocs(), loadAuditLogs()]);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  });
}
