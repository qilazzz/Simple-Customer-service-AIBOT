requireAuth();

const PAGE_SIZE = 10;

const metricTotal = document.getElementById('metric-total');
const metricPendingComplaints = document.getElementById('metric-pending-complaints');
const metricInProgressComplaints = document.getElementById('metric-in-progress-complaints');
const metricResolvedComplaints = document.getElementById('metric-resolved-complaints');

const adminApp = document.getElementById('admin-app');
const adminSidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const mainContentTitle = document.querySelector('.main-content-title');
const mainContentSubtitle = document.querySelector('.main-content-subtitle');

const tabButtons = document.querySelectorAll('.sidebar-nav-item[data-tab]');
const tabPanels = document.querySelectorAll('.tab-panel');

const TAB_HEADINGS = {
  complaints: {
    title: 'Complaints Dashboard',
    subtitle: 'Review, filter, and manage customer complaint tickets',
  },
  overview: {
    title: 'Analytics / Summary',
    subtitle: 'Activity metrics, recent complaints, and chatbot analytics',
  },
  'live-chat': {
    title: 'Live Chat',
    subtitle: 'Respond to customer live support conversations in real time',
  },
};

const SIDEBAR_STATE_KEY = 'admin_sidebar_collapsed';

const complaintsCountEl = document.getElementById('complaints-count-label');
const complaintsTableBody = document.getElementById('complaints-table-body');
const complaintsSearch = document.getElementById('search');
const stateFilter = document.getElementById('stateFilter');
const outletFilter = document.getElementById('outletFilter');
const complaintsStatusFilter = document.getElementById('status-filter');
const complaintsPaginationEl = document.getElementById('complaints-pagination');
const complaintsPagePrev = document.getElementById('complaints-page-prev');
const complaintsPageNext = document.getElementById('complaints-page-next');
const complaintsPageNumbers = document.getElementById('complaints-page-numbers');

const overviewTotalComplaints = document.getElementById('overview-total-complaints');
const overviewPendingComplaints = document.getElementById('overview-pending-complaints');
const overviewInProgressComplaints = document.getElementById('overview-in-progress-complaints');
const overviewResolvedComplaints = document.getElementById('overview-resolved-complaints');
const overviewBreakdown = document.getElementById('overview-breakdown');
const overviewRecent = document.getElementById('overview-recent');
const menuAnalyticsTotal = document.getElementById('menu-analytics-total');
const menuAnalyticsBreakdown = document.getElementById('menu-analytics-breakdown');
const menuAnalyticsChart = document.getElementById('menu-analytics-chart');
const clickDetailsModal = document.getElementById('click-details-modal');
const clickDetailsTitle = document.getElementById('click-details-title');
const clickDetailsLoading = document.getElementById('click-details-loading');
const clickDetailsError = document.getElementById('click-details-error');
const clickDetailsTableWrap = document.getElementById('click-details-table-wrap');
const clickDetailsBody = document.getElementById('click-details-body');
const clickDetailsEmpty = document.getElementById('click-details-empty');

const categoryMenuBtn = document.getElementById('category-menu-btn');
const categoryMenuPanel = document.getElementById('category-menu-panel');
const categoryMenuBackdrop = document.getElementById('category-menu-backdrop');
const categoryMenuClose = document.getElementById('category-menu-close');
const categoryMenuList = document.getElementById('category-menu-list');
const categoryFilterLabel = document.getElementById('category-filter-label');
const complaintsRefreshBtn = document.getElementById('complaints-refresh-btn');

let allComplaints = [];
let allOutlets = [];
let menuClickStats = null;
let complaintsPage = 1;
let activeTab = 'complaints';
let selectedCategory = '';
let categoryLabels = {};

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('apply-filters').addEventListener('click', () => {
  complaintsPage = 1;
  loadComplaints();
});

complaintsSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    complaintsPage = 1;
    loadComplaints();
  }
});
complaintsStatusFilter.addEventListener('change', () => { complaintsPage = 1; loadComplaints(); });
stateFilter.addEventListener('change', () => {
  populateOutletFilter();
  outletFilter.value = '';
  complaintsPage = 1;
});

complaintsPagePrev.addEventListener('click', () => goComplaintsPage(complaintsPage - 1));
complaintsPageNext.addEventListener('click', () => goComplaintsPage(complaintsPage + 1));

tabButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

sidebarToggle?.addEventListener('click', toggleSidebar);

function setSidebarCollapsed(collapsed) {
  adminSidebar?.classList.toggle('is-collapsed', collapsed);
  adminSidebar?.classList.toggle('is-expanded', !collapsed);
  adminApp?.classList.toggle('sidebar-collapsed', collapsed);

  const toggleIcon = sidebarToggle?.querySelector('.sidebar-toggle-icon');
  if (toggleIcon) {
    toggleIcon.textContent = collapsed ? '>' : '<';
  }

  sidebarToggle?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  sidebarToggle?.setAttribute(
    'aria-label',
    collapsed ? 'Expand sidebar' : 'Collapse sidebar',
  );

  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore storage failures.
  }
}

function toggleSidebar() {
  const collapsed = !adminSidebar?.classList.contains('is-collapsed');
  setSidebarCollapsed(collapsed);
}

function initSidebarState() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
  } catch {
    collapsed = false;
  }
  setSidebarCollapsed(collapsed);
}

function updateMainContentHeading(tabId) {
  const heading = TAB_HEADINGS[tabId] || TAB_HEADINGS.complaints;
  if (mainContentTitle) mainContentTitle.textContent = heading.title;
  if (mainContentSubtitle) mainContentSubtitle.textContent = heading.subtitle;
}

clickDetailsModal?.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-modal]')) {
    closeClickDetailsModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !clickDetailsModal?.classList.contains('hidden')) {
    closeClickDetailsModal();
  }
  if (event.key === 'Escape' && categoryMenuPanel && !categoryMenuPanel.classList.contains('hidden')) {
    closeCategoryMenu();
  }
});

function updateCategoryFilterLabel() {
  if (!categoryFilterLabel) return;
  if (!selectedCategory) {
    categoryFilterLabel.textContent = 'Category: All';
    return;
  }
  const label = categoryLabels[selectedCategory] || selectedCategory;
  categoryFilterLabel.textContent = `Category: ${label}`;
}

function renderCategoryMenuItems() {
  if (!categoryMenuList) return;

  const categoryItems = Object.entries(categoryLabels)
    .map(
      ([key, label]) => `
        <li>
          <button
            type="button"
            class="category-menu-item${selectedCategory === key ? ' is-active' : ''}"
            data-category="${escapeHtml(key)}"
          >
            ${escapeHtml(label)}
          </button>
        </li>
      `,
    )
    .join('');

  categoryMenuList.innerHTML = `
    <li>
      <button
        type="button"
        class="category-menu-item${selectedCategory ? '' : ' is-active'}"
        data-category=""
      >
        Clear Filter / Show All
      </button>
    </li>
    ${categoryItems}
  `;

  categoryMenuList.querySelectorAll('.category-menu-item').forEach((button) => {
    button.addEventListener('click', () => {
      selectCategoryFilter(button.dataset.category || '');
    });
  });
}

function openCategoryMenu() {
  if (!categoryMenuPanel || !categoryMenuBackdrop || !categoryMenuBtn) return;
  categoryMenuPanel.classList.remove('hidden');
  categoryMenuBackdrop.classList.remove('hidden');
  categoryMenuBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('category-menu-open');
}

function closeCategoryMenu() {
  if (!categoryMenuPanel || !categoryMenuBackdrop || !categoryMenuBtn) return;
  categoryMenuPanel.classList.add('hidden');
  categoryMenuBackdrop.classList.add('hidden');
  categoryMenuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('category-menu-open');
}

function toggleCategoryMenu() {
  if (categoryMenuPanel?.classList.contains('hidden')) {
    openCategoryMenu();
  } else {
    closeCategoryMenu();
  }
}

function selectCategoryFilter(category) {
  selectedCategory = category || '';
  updateCategoryFilterLabel();
  renderCategoryMenuItems();
  closeCategoryMenu();
  complaintsPage = 1;
  loadComplaints();
}

categoryMenuBtn?.addEventListener('click', toggleCategoryMenu);
categoryMenuClose?.addEventListener('click', closeCategoryMenu);
categoryMenuBackdrop?.addEventListener('click', closeCategoryMenu);

async function loadCategoryOptions() {
  try {
    const res = await adminFetch('/api/admin/meta');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    categoryLabels = data.category_labels || {};
    renderCategoryMenuItems();
    updateCategoryFilterLabel();
  } catch (err) {
    categoryLabels = {
      wrong_order: 'Wrong Order',
      late_delivery: 'Late Delivery',
      food_quality: 'Food Quality',
      service: 'Service',
      other: 'Other',
    };
    renderCategoryMenuItems();
    updateCategoryFilterLabel();
    console.error('Category options error:', err.message);
  }
}

function switchTab(tabId) {
  closeCategoryMenu();
  activeTab = tabId;
  updateMainContentHeading(tabId);

  tabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tabId);
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === `tab-${tabId}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  if (tabId === 'overview') {
    renderOverview();
    loadMenuClickAnalytics();
  }

  if (tabId === 'live-chat') {
    window.AdminLiveChat?.activate();
  } else {
    window.AdminLiveChat?.deactivate();
  }
}

function getTicketId(complaint) {
  const id = Number(complaint.ticket_id ?? complaint.id);
  return Number.isFinite(id) ? id : complaint.id;
}

function formatTicketRef(complaint) {
  const ticketId = getTicketId(complaint);
  const cmp = `CMP-${String(ticketId).padStart(3, '0')}`;
  const orderId = complaint.order_id?.trim();
  return orderId ? `#${cmp} / ${orderId}` : `#${cmp}`;
}

function formatSourceLabel(source) {
  return source === 'chatbot' ? 'App / Chat' : 'Web Form';
}

function formatOutletLabel(outletName) {
  return outletName?.trim() || '—';
}

function updateHeaderMetrics() {
  const pendingComplaints = allComplaints.filter((item) => item.status === 'pending').length;
  const inProgressComplaints = allComplaints.filter((item) => item.status === 'in_progress').length;
  const resolvedComplaints = allComplaints.filter((item) => item.status === 'resolved').length;

  metricTotal.textContent = allComplaints.length;
  metricPendingComplaints.textContent = pendingComplaints;
  metricInProgressComplaints.textContent = inProgressComplaints;
  if (metricResolvedComplaints) {
    metricResolvedComplaints.textContent = resolvedComplaints;
  }
}

function renderPagination({
  totalItems,
  currentPage,
  paginationEl,
  pageNumbersEl,
  pagePrev,
  pageNext,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (totalItems <= PAGE_SIZE) {
    paginationEl.classList.add('hidden');
    return totalPages;
  }

  paginationEl.classList.remove('hidden');
  pagePrev.disabled = currentPage <= 1;
  pageNext.disabled = currentPage >= totalPages;

  pageNumbersEl.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const activeClass = page === currentPage ? ' is-active' : '';
    return `<button type="button" class="page-number${activeClass}" data-page="${page}">${page}</button>`;
  }).join('');

  pageNumbersEl.querySelectorAll('.page-number').forEach((button) => {
    button.addEventListener('click', () => onPageChange(Number(button.dataset.page)));
  });

  return totalPages;
}

function renderComplaintsTable() {
  const start = (complaintsPage - 1) * PAGE_SIZE;
  const pageItems = allComplaints.slice(start, start + PAGE_SIZE);

  if (!pageItems.length) {
    complaintsTableBody.innerHTML = '<tr><td colspan="9">No complaints found.</td></tr>';
    complaintsCountEl.textContent = 'Showing 0 of 0 complaints';
    complaintsPaginationEl.classList.add('hidden');
    return;
  }

  complaintsTableBody.innerHTML = pageItems
    .map((complaint) => {
      const ticketId = getTicketId(complaint);
      const statusClass = complaint.status === 'in_progress' ? 'in_progress' : complaint.status;
      return `
        <tr>
          <td><span class="ticket-order-ref">${escapeHtml(formatTicketRef(complaint))}</span></td>
          <td>${escapeHtml(complaint.customer_name)}</td>
          <td><span class="outlet-label">${escapeHtml(formatOutletLabel(complaint.outlet_name))}</span></td>
          <td>${escapeHtml(complaint.category_label)}</td>
          <td>${escapeHtml(formatSourceLabel(complaint.source))}</td>
          <td><span class="tag ${complaint.priority}">${escapeHtml(complaint.priority)}</span></td>
          <td><span class="tag ${statusClass}">${escapeHtml(complaint.status_label)}</span></td>
          <td>${formatDate(complaint.created_at)}</td>
          <td><a class="btn-link" href="/admin/ticket.html?id=${encodeURIComponent(ticketId)}">View</a></td>
        </tr>
      `;
    })
    .join('');

  const end = Math.min(complaintsPage * PAGE_SIZE, allComplaints.length);
  complaintsCountEl.textContent = `Showing ${start + 1}–${end} of ${allComplaints.length} complaint${allComplaints.length === 1 ? '' : 's'}`;

  renderPagination({
    totalItems: allComplaints.length,
    currentPage: complaintsPage,
    paginationEl: complaintsPaginationEl,
    pageNumbersEl: complaintsPageNumbers,
    pagePrev: complaintsPagePrev,
    pageNext: complaintsPageNext,
    onPageChange: goComplaintsPage,
  });
}

function goComplaintsPage(page) {
  const totalPages = Math.max(1, Math.ceil(allComplaints.length / PAGE_SIZE));
  complaintsPage = Math.min(Math.max(1, page), totalPages);
  renderComplaintsTable();
  complaintsPaginationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderOverview() {
  const pendingComplaints = allComplaints.filter((item) => item.status === 'pending').length;
  const inProgressComplaints = allComplaints.filter((item) => item.status === 'in_progress').length;
  const resolvedComplaints = allComplaints.filter((item) => item.status === 'resolved').length;

  overviewTotalComplaints.textContent = allComplaints.length;
  overviewPendingComplaints.textContent = pendingComplaints;
  overviewInProgressComplaints.textContent = inProgressComplaints;
  overviewResolvedComplaints.textContent = resolvedComplaints;

  overviewBreakdown.innerHTML = `
    <p><strong>Complaints</strong> — Pending: ${pendingComplaints}, In Progress: ${inProgressComplaints}, Resolved: ${resolvedComplaints}</p>
    <p><strong>Open workload:</strong> ${pendingComplaints + inProgressComplaints} complaint(s) awaiting resolution.</p>
  `;

  const recent = allComplaints
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(
      (item, index) => `
        <li class="overview-recent-item">
          <div class="overview-recent-content">
            <span class="row-number">${index + 1}.</span>
            <span class="overview-recent-customer">${escapeHtml(item.customer_name)}</span>
            <span class="overview-recent-sep">·</span>
            <span class="overview-recent-category">${escapeHtml(item.category_label)}</span>
          </div>
          <time class="overview-recent-date" datetime="${escapeHtml(item.created_at)}">${formatDate(item.created_at)}</time>
        </li>
      `,
    );

  overviewRecent.innerHTML = recent.length
    ? recent.join('')
    : '<li>No recent complaints yet.</li>';
}

async function loadMenuClickAnalytics() {
  menuAnalyticsTotal.textContent = 'Loading...';
  menuAnalyticsBreakdown.innerHTML = '<p class="menu-analytics-empty">Loading click data...</p>';
  menuAnalyticsChart.innerHTML = '<p class="menu-analytics-empty">Loading chart...</p>';

  try {
    const res = await adminFetch('/api/admin/analytics/button-clicks');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    menuClickStats = data;
    renderMenuClickAnalytics();
  } catch (err) {
    menuClickStats = null;
    menuAnalyticsTotal.textContent = 'Could not load analytics';
    menuAnalyticsBreakdown.innerHTML = `<p class="menu-analytics-error">${escapeHtml(err.message)}</p>`;
    menuAnalyticsChart.innerHTML = '';
  }
}

function formatClickDetailTimestamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function bindMenuAnalyticsClicks() {
  menuAnalyticsBreakdown.querySelectorAll('.menu-click-row[data-button-name]').forEach((row) => {
    row.addEventListener('click', () => openClickDetailsModal(row.dataset.buttonName));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClickDetailsModal(row.dataset.buttonName);
      }
    });
  });

  menuAnalyticsChart.querySelectorAll('.menu-bar-col[data-button-name]').forEach((col) => {
    col.addEventListener('click', () => openClickDetailsModal(col.dataset.buttonName));
    col.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClickDetailsModal(col.dataset.buttonName);
      }
    });
  });
}

function closeClickDetailsModal() {
  clickDetailsModal?.classList.add('hidden');
  document.body.classList.remove('admin-modal-open');
}

async function openClickDetailsModal(buttonName) {
  if (!buttonName || !clickDetailsModal) return;

  clickDetailsTitle.textContent = `Customers Who Clicked: ${buttonName}`;
  clickDetailsModal.classList.remove('hidden');
  document.body.classList.add('admin-modal-open');

  clickDetailsLoading.classList.remove('hidden');
  clickDetailsError.classList.add('hidden');
  clickDetailsTableWrap.classList.add('hidden');
  clickDetailsEmpty.classList.add('hidden');
  clickDetailsBody.innerHTML = '';

  try {
    const res = await adminFetch(
      `/api/admin/analytics/click-details?button_name=${encodeURIComponent(buttonName)}`,
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    clickDetailsLoading.classList.add('hidden');

    if (!data.clicks?.length) {
      clickDetailsEmpty.classList.remove('hidden');
      return;
    }

    clickDetailsTableWrap.classList.remove('hidden');
    clickDetailsBody.innerHTML = data.clicks
      .map(
        (click, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(click.customer_name)}</td>
            <td>${escapeHtml(click.contact_info)}</td>
            <td>${escapeHtml(formatClickDetailTimestamp(click.created_at))}</td>
          </tr>
        `,
      )
      .join('');
  } catch (err) {
    clickDetailsLoading.classList.add('hidden');
    clickDetailsError.textContent = err.message || 'Could not load click details.';
    clickDetailsError.classList.remove('hidden');
  }
}

function renderMenuClickAnalytics() {
  if (!menuClickStats) return;

  const { total_clicks: totalClicks, buttons = [] } = menuClickStats;
  menuAnalyticsTotal.textContent = `${totalClicks} total menu click${totalClicks === 1 ? '' : 's'}`;

  if (!totalClicks) {
    menuAnalyticsBreakdown.innerHTML = '<p class="menu-analytics-empty">No menu clicks recorded yet. Clicks appear when users tap quick-reply buttons in the chatbot.</p>';
    menuAnalyticsChart.innerHTML = '<p class="menu-analytics-empty">No data to chart yet.</p>';
    return;
  }

  menuAnalyticsBreakdown.innerHTML = buttons
    .map((item) => {
      const pct = item.percentage ?? 0;
      return `
        <div
          class="menu-click-row menu-analytics-clickable"
          data-button-name="${escapeHtml(item.button_name)}"
          role="button"
          tabindex="0"
          aria-label="View customers who clicked ${escapeHtml(item.button_name)}"
        >
          <div class="menu-click-row-head">
            <span class="menu-click-label">${escapeHtml(item.emoji)} ${escapeHtml(item.button_name)}</span>
            <span class="menu-click-stat">${item.count} click${item.count === 1 ? '' : 's'} (${pct}%)</span>
          </div>
          <div class="menu-click-progress" aria-hidden="true">
            <div class="menu-click-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const maxCount = Math.max(...buttons.map((item) => item.count), 1);

  menuAnalyticsChart.innerHTML = `
    <div class="menu-bar-chart">
      ${buttons
        .map((item) => {
          const heightPct = Math.round((item.count / maxCount) * 100);
          return `
            <div
              class="menu-bar-col menu-analytics-clickable"
              data-button-name="${escapeHtml(item.button_name)}"
              role="button"
              tabindex="0"
              aria-label="View customers who clicked ${escapeHtml(item.button_name)}"
            >
              <div class="menu-bar-value">${item.count}</div>
              <div class="menu-bar-track">
                <div class="menu-bar-fill" style="height: ${heightPct}%"></div>
              </div>
              <div class="menu-bar-emoji">${escapeHtml(item.emoji)}</div>
              <div class="menu-bar-label">${escapeHtml(item.button_name)}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  bindMenuAnalyticsClicks();
}

async function loadFilterOptions() {
  try {
    const [statesRes, outletsRes] = await Promise.all([
      fetch('/api/outlets/states'),
      fetch('/api/outlets'),
    ]);

    const statesData = await statesRes.json();
    const outletsData = await outletsRes.json();

    if (!statesData.success) throw new Error(statesData.message || 'Could not load states.');
    if (!outletsData.success) throw new Error(outletsData.message || 'Could not load outlets.');

    stateFilter.innerHTML =
      '<option value="">All States</option>' +
      (statesData.states || [])
        .map((state) => `<option value="${escapeHtml(state)}">${escapeHtml(state)}</option>`)
        .join('');

    allOutlets = outletsData.outlets || [];
    populateOutletFilter();
  } catch (err) {
    stateFilter.innerHTML = '<option value="">All States</option>';
    outletFilter.innerHTML = '<option value="">All Outlets</option>';
    console.error('Filter options error:', err.message);
  }
}

function populateOutletFilter() {
  const selectedState = stateFilter.value;
  const previousOutlet = outletFilter.value;

  const filteredOutlets = selectedState
    ? allOutlets.filter((outlet) => outlet.state === selectedState)
    : allOutlets;

  outletFilter.innerHTML =
    '<option value="">All Outlets</option>' +
    filteredOutlets
      .map(
        (outlet) =>
          `<option value="${escapeHtml(outlet.outlet_name)}">${escapeHtml(outlet.outlet_name)}</option>`,
      )
      .join('');

  if (filteredOutlets.some((outlet) => outlet.outlet_name === previousOutlet)) {
    outletFilter.value = previousOutlet;
  }
}

async function loadComplaints() {
  const params = new URLSearchParams();
  if (complaintsSearch.value.trim()) params.set('search', complaintsSearch.value.trim());
  if (stateFilter.value) params.set('state', stateFilter.value);
  if (outletFilter.value) params.set('outlet', outletFilter.value);
  if (complaintsStatusFilter.value) params.set('status', complaintsStatusFilter.value);
  if (selectedCategory) params.set('category', selectedCategory);

  complaintsTableBody.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
  complaintsPaginationEl.classList.add('hidden');

  try {
    const res = await adminFetch(`/api/admin/complaints?${params}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    allComplaints = (data.complaints || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((complaint) => ({
        ...complaint,
        ticket_id: getTicketId(complaint),
      }));

    if (complaintsPage > Math.max(1, Math.ceil(allComplaints.length / PAGE_SIZE))) {
      complaintsPage = 1;
    }

    updateHeaderMetrics();
    renderComplaintsTable();
    if (activeTab === 'overview') renderOverview();
  } catch (err) {
    allComplaints = [];
    complaintsPage = 1;
    complaintsCountEl.textContent = 'Could not load complaints';
    complaintsTableBody.innerHTML = `<tr><td colspan="9">${escapeHtml(err.message)}</td></tr>`;
    complaintsPaginationEl.classList.add('hidden');
    updateHeaderMetrics();
  }
}

async function fetchComplaints() {
  if (complaintsRefreshBtn) {
    complaintsRefreshBtn.disabled = true;
    complaintsRefreshBtn.classList.add('is-refreshing');
  }

  try {
    await loadComplaints();
  } finally {
    if (complaintsRefreshBtn) {
      complaintsRefreshBtn.disabled = false;
      complaintsRefreshBtn.classList.remove('is-refreshing');
    }
  }
}

complaintsRefreshBtn?.addEventListener('click', fetchComplaints);

function exportToExcelWithDateRange() {
  const startDate = document.getElementById('export-start-date')?.value || '';
  const endDate = document.getElementById('export-end-date')?.value || '';
  const token = localStorage.getItem('admin_token');

  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }

  if (startDate && endDate && startDate > endDate) {
    window.alert('The "From" date cannot be after the "To" date.');
    return;
  }

  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  params.set('token', token);

  window.location.href = `/api/admin/complaints/export-excel?${params.toString()}`;
}

window.exportToExcelWithDateRange = exportToExcelWithDateRange;

loadCategoryOptions();
initSidebarState();
updateMainContentHeading(activeTab);
loadFilterOptions().then(() => loadComplaints());
