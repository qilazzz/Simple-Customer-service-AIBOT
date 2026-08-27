/**
 * Admin Live Agent Chat workspace — queue list, views, chat management, polling.
 */
(function initAdminLiveChat() {
  const listEl = document.getElementById('live-chat-list');
  const searchEl = document.getElementById('live-chat-search');
  const summaryEl = document.getElementById('live-chat-queue-summary');
  const queueTitleEl = document.getElementById('live-chat-queue-title');
  const badgeEl = document.getElementById('live-chat-badge');
  const trashBadgeEl = document.getElementById('live-chat-trash-badge');
  const headerEl = document.getElementById('live-chat-header');
  const placeholderEl = document.getElementById('live-chat-placeholder');
  const messagesEl = document.getElementById('live-chat-messages');
  const composeEl = document.getElementById('live-chat-compose');
  const customerNameEl = document.getElementById('live-chat-customer-name');
  const customerMetaEl = document.getElementById('live-chat-customer-meta');
  const customerOutletEl = document.getElementById('live-chat-customer-outlet');
  const resolveBtn = document.getElementById('live-chat-resolve-btn');
  const inputEl = document.getElementById('live-chat-input');
  const sendBtn = document.getElementById('live-chat-send-btn');
  const templatesEl = document.getElementById('live-chat-templates');
  const bulkToolbarEl = document.getElementById('live-chat-bulk-toolbar');
  const selectAllEl = document.getElementById('live-chat-select-all');
  const deleteSelectedBtn = document.getElementById('live-chat-delete-selected-btn');
  const deleteAllBtn = document.getElementById('live-chat-delete-all-btn');
  const refreshBtn = document.getElementById('live-chat-refresh-btn');
  const selectModeBtn = document.getElementById('live-chat-select-mode-btn');
  const deleteModalEl = document.getElementById('live-chat-delete-modal');
  const deleteMessageEl = document.getElementById('live-chat-delete-message');
  const deleteConfirmBtn = document.getElementById('live-chat-delete-confirm-btn');
  const restoreModalEl = document.getElementById('live-chat-restore-modal');
  const restoreConfirmBtn = document.getElementById('live-chat-restore-confirm-btn');
  const restoreErrorEl = document.getElementById('live-chat-restore-error');
  const subtabButtons = document.querySelectorAll('.live-chat-subtab');

  if (!listEl) return;

  const VIEW_LABELS = {
    active: 'Active Chats',
    resolved: 'Resolved Chats',
    trash: 'Trash / Deleted Chats',
  };

  const EMPTY_MESSAGES = {
    active: 'No active chats in the queue.',
    resolved: 'No resolved chats yet.',
    trash: 'Trash is empty.',
  };

  let liveChats = [];
  let selectedSessionId = null;
  let selectedIds = new Set();
  let currentView = 'active';
  let pollTimer = null;
  let lastWaitingCount = 0;
  let isTabActive = false;
  let pendingDeleteAction = null;
  let pendingRestoreSessionId = null;
  let eventSource = null;
  let queueRefreshTimer = null;
  let selectModeEnabled = false;

  function scheduleQueueRefresh(options = {}) {
    if (queueRefreshTimer) {
      window.clearTimeout(queueRefreshTimer);
    }
    queueRefreshTimer = window.setTimeout(() => {
      queueRefreshTimer = null;
      loadQueue(options);
    }, 250);
  }

  function handleLiveChatEvent(payload = {}) {
    if (!payload.type || payload.type === 'connected') return;

    const shouldRefresh =
      payload.type === 'reopened' ||
      payload.type === 'message' ||
      payload.type === 'new_session' ||
      payload.type === 'claimed' ||
      payload.type === 'resolved' ||
      payload.type === 'deleted' ||
      payload.type === 'purged' ||
      payload.type === 'restored';

    if (!shouldRefresh) return;

    if (
      payload.type === 'reopened' &&
      selectedSessionId &&
      Number(payload.liveSessionId) === Number(selectedSessionId) &&
      currentView !== 'active'
    ) {
      clearSelection();
    }

    if (
      payload.type === 'new_session' ||
      ((payload.type === 'reopened' || (payload.type === 'message' && payload.sender === 'user')) &&
        !isTabActive)
    ) {
      playNotificationSound();
    }

    scheduleQueueRefresh({
      preserveSelection: currentView === 'active',
    });
  }

  function connectLiveChatEvents() {
    disconnectLiveChatEvents();

    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;

    const url = `/api/admin/live-chats/events?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        handleLiveChatEvent(JSON.parse(event.data));
      } catch {
        // Ignore malformed event payloads.
      }
    };

    eventSource.onerror = () => {
      disconnectLiveChatEvents();
      window.setTimeout(connectLiveChatEvents, 5000);
    };
  }

  function disconnectLiveChatEvents() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function formatSnippet(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return 'No messages yet';
    return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
  }

  function formatListTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function statusClass(status) {
    switch (status) {
      case 'AGENT_CONNECTED':
        return 'is-progress';
      case 'RESOLVED':
        return 'is-resolved';
      case 'DELETED':
        return 'is-deleted';
      default:
        return 'is-waiting';
    }
  }

  function isSelectModeEnabled() {
    return selectModeEnabled;
  }

  function isPermanentDeleteContext() {
    return currentView === 'trash';
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
      }, 180);
    } catch {
      // Ignore audio failures.
    }
  }

  function updateBadge(waitingCount) {
    if (!badgeEl) return;
    if (waitingCount > 0) {
      badgeEl.textContent = String(waitingCount);
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }

    if (waitingCount > lastWaitingCount && !isTabActive) {
      playNotificationSound();
    }
    lastWaitingCount = waitingCount;
  }

  function updateTrashBadge(count) {
    if (!trashBadgeEl) return;
    if (count > 0) {
      trashBadgeEl.textContent = String(count);
      trashBadgeEl.classList.remove('hidden');
    } else {
      trashBadgeEl.classList.add('hidden');
    }
  }

  function updateSelectModeUi() {
    if (selectModeBtn) {
      selectModeBtn.classList.toggle('is-active', selectModeEnabled);
      selectModeBtn.setAttribute('aria-pressed', selectModeEnabled ? 'true' : 'false');
    }

    if (bulkToolbarEl) {
      bulkToolbarEl.classList.toggle('hidden', !selectModeEnabled);
    }

    updateBulkActionButtons();
  }

  function updateBulkActionButtons() {
    if (deleteSelectedBtn) {
      deleteSelectedBtn.textContent = `Delete Selected (${selectedIds.size})`;
      deleteSelectedBtn.disabled = selectedIds.size === 0;
    }

    if (deleteAllBtn) {
      deleteAllBtn.disabled = !liveChats.length;
    }
  }

  function setSelectMode(enabled) {
    selectModeEnabled = Boolean(enabled);

    if (!selectModeEnabled) {
      selectedIds.clear();
      if (selectAllEl) {
        selectAllEl.checked = false;
        selectAllEl.indeterminate = false;
      }
    }

    updateSelectModeUi();
    renderQueue();
  }

  function toggleSelectMode() {
    setSelectMode(!selectModeEnabled);
  }

  async function fetchChatQueue(options = {}) {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-refreshing');
    }

    try {
      await loadQueue(options);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-refreshing');
      }
    }
  }

  function updateViewUi() {
    subtabButtons.forEach((button) => {
      const isActive = button.dataset.view === currentView;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (queueTitleEl) {
      queueTitleEl.textContent = VIEW_LABELS[currentView] || VIEW_LABELS.active;
    }

    if (resolveBtn) {
      resolveBtn.classList.toggle('hidden', currentView !== 'active');
    }

    setSelectMode(false);
  }

  function syncSelectAllState(filteredCount) {
    if (!selectAllEl || !isSelectModeEnabled()) return;
    selectAllEl.checked = filteredCount > 0 && selectedIds.size === filteredCount;
    selectAllEl.indeterminate =
      selectedIds.size > 0 && selectedIds.size < filteredCount;

    updateBulkActionButtons();
  }

  function renderQueue() {
    const term = searchEl?.value.trim().toLowerCase() || '';
    const filtered = liveChats.filter((chat) => {
      if (!term) return true;
      const haystack = [chat.customer_name, chat.customer_contact, chat.last_message]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<li class="live-chat-empty">${EMPTY_MESSAGES[currentView] || EMPTY_MESSAGES.active}</li>`;
      syncSelectAllState(0);
      return;
    }

    listEl.innerHTML = filtered
      .map((chat) => {
        const bulkCheckbox = isSelectModeEnabled()
          ? `
              <label class="live-chat-list-checkbox">
                <input
                  type="checkbox"
                  class="live-chat-item-checkbox"
                  data-session-id="${chat.id}"
                  ${selectedIds.has(chat.id) ? 'checked' : ''}
                  aria-label="Select chat with ${escapeHtml(chat.customer_name)}"
                />
              </label>
            `
          : '';

        const restoreButton =
          currentView === 'trash'
            ? `
              <button
                type="button"
                class="live-chat-item-restore"
                data-restore-id="${chat.id}"
                aria-label="Restore chat with ${escapeHtml(chat.customer_name)}"
                title="Restore to Active Chats"
              >
                ↩️
              </button>
            `
            : '';

        return `
          <li class="live-chat-list-item${isSelectModeEnabled() ? ' is-select-mode' : ''}">
            ${bulkCheckbox}
            <div class="live-chat-item-wrap${currentView === 'trash' ? ' has-side-actions' : ''}">
              <div
                class="live-chat-item${selectedSessionId === chat.id ? ' is-selected' : ''}"
                data-session-id="${chat.id}"
                role="button"
                tabindex="0"
              >
                <div class="live-chat-item-top">
                  <strong>${escapeHtml(chat.customer_name)}</strong>
                  <div class="live-chat-item-actions">
                    ${chat.unread_count ? `<span class="live-chat-unread">${chat.unread_count}</span>` : ''}
                  </div>
                </div>
                <p class="live-chat-item-contact">${escapeHtml(chat.customer_contact || '-')}</p>
                <p class="live-chat-item-snippet">${escapeHtml(formatSnippet(chat.last_message))}</p>
                <div class="live-chat-item-foot">
                  <span class="live-chat-status ${statusClass(chat.status)}">${escapeHtml(chat.status_label)}</span>
                  <time>${escapeHtml(formatListTime(chat.last_message_at || chat.updated_at))}</time>
                </div>
              </div>
              <div class="live-chat-item-side-actions">
                <button
                  type="button"
                  class="live-chat-item-trash"
                  data-trash-id="${chat.id}"
                  aria-label="Delete chat with ${escapeHtml(chat.customer_name)}"
                  title="${isPermanentDeleteContext() ? 'Permanently delete' : 'Move to trash'}"
                >
                  🗑️
                </button>
                ${restoreButton}
              </div>
            </div>
          </li>
        `;
      })
      .join('');

    syncSelectAllState(filtered.length);
  }

  function senderLabel(sender) {
    switch (sender) {
      case 'admin':
        return 'Support Agent';
      case 'user':
        return 'Customer';
      case 'bot':
        return 'Bot';
      default:
        return sender;
    }
  }

  function renderMessages(messages = []) {
    messagesEl.innerHTML = messages
      .map(
        (message) => `
          <div class="live-chat-bubble live-chat-bubble-${message.sender}">
            <div class="live-chat-bubble-meta">${escapeHtml(senderLabel(message.sender))} · ${escapeHtml(formatListTime(message.created_at || message.timestamp))}</div>
            <div class="live-chat-bubble-text">${escapeHtml(message.message_text)}</div>
          </div>
        `,
      )
      .join('');

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  let lastRenderedCount = 0;
  let lastRenderedMessageId = 0;

  async function loadQueue(options = {}) {
    const { preserveSelection = true } = options;

    try {
      const params = new URLSearchParams();
      params.set('view', currentView);
      if (searchEl?.value.trim()) params.set('search', searchEl.value.trim());

      const res = await adminFetch(`/api/admin/live-chats?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      liveChats = data.chats || [];
      updateTrashBadge(data.trash_count || 0);

      if (currentView === 'active') {
        summaryEl.textContent = `${data.count} active chat${data.count === 1 ? '' : 's'} · ${data.waiting_count} waiting`;
        updateBadge(data.waiting_count || 0);
      } else if (currentView === 'resolved') {
        summaryEl.textContent = `${data.count} resolved chat${data.count === 1 ? '' : 's'}`;
      } else {
        summaryEl.textContent = `${data.count} deleted chat${data.count === 1 ? '' : 's'}`;
      }

      renderQueue();

      if (preserveSelection && selectedSessionId) {
        const stillVisible = liveChats.some((chat) => chat.id === selectedSessionId);
        if (stillVisible) {
          await loadSessionDetail(selectedSessionId, { silent: true });
        } else {
          clearSelection();
        }
      }
    } catch (err) {
      summaryEl.textContent = 'Could not load live chats';
      listEl.innerHTML = `<li class="live-chat-empty">${escapeHtml(err.message)}</li>`;
    }
  }

  async function loadSessionDetail(sessionId, options = {}) {
    try {
      const res = await adminFetch(`/api/admin/live-chats/${sessionId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const session = data.session;
      selectedSessionId = session.id;

      headerEl.classList.remove('hidden');
      placeholderEl.classList.add('hidden');
      messagesEl.classList.remove('hidden');

      const canCompose =
        currentView === 'active' &&
        session.status !== 'RESOLVED' &&
        session.status !== 'DELETED';

      composeEl.classList.toggle('hidden', !canCompose);
      resolveBtn?.classList.toggle('hidden', !canCompose);

      customerNameEl.textContent = session.customer_name;
      customerMetaEl.textContent = session.customer_contact || '-';
      customerOutletEl.textContent = session.outlet_name
        ? `Outlet: ${session.outlet_name}`
        : '';

      const messages = session.messages || [];
      const latestId = messages.length ? Number(messages[messages.length - 1].id) || 0 : 0;

      if (options.silent && latestId === lastRenderedMessageId && messages.length === lastRenderedCount) {
        renderQueue();
        return;
      }

      lastRenderedCount = messages.length;
      lastRenderedMessageId = latestId;
      renderMessages(messages);
      renderQueue();

      if (
        !options.silent &&
        currentView === 'active' &&
        session.status === 'WAITING_FOR_AGENT'
      ) {
        await adminFetch(`/api/admin/live-chats/${sessionId}/claim`, { method: 'POST' });
        await loadQueue({ preserveSelection: true });
      }
    } catch (err) {
      messagesEl.innerHTML = `<p class="live-chat-empty">${escapeHtml(err.message)}</p>`;
    }
  }

  function clearSelection() {
    selectedSessionId = null;
    lastRenderedCount = 0;
    lastRenderedMessageId = 0;
    headerEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
    messagesEl.classList.add('hidden');
    composeEl.classList.add('hidden');
    messagesEl.innerHTML = '';
    renderQueue();
  }

  async function selectSession(sessionId) {
    selectedSessionId = sessionId;
    lastRenderedCount = 0;
    lastRenderedMessageId = 0;
    renderQueue();
    startPolling();
    await loadSessionDetail(sessionId);
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || !selectedSessionId || currentView !== 'active') return;

    sendBtn.disabled = true;
    try {
      const res = await adminFetch('/api/admin/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          live_session_id: selectedSessionId,
          message_text: text,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      inputEl.value = '';
      templatesEl.value = '';
      const messages = data.session.messages || [];
      lastRenderedCount = messages.length;
      lastRenderedMessageId = messages.length
        ? Number(messages[messages.length - 1].id) || 0
        : 0;
      renderMessages(messages);
      await loadQueue({ preserveSelection: true });
    } catch (err) {
      alert(err.message || 'Could not send message.');
    } finally {
      sendBtn.disabled = false;
    }
  }

  async function resolveSession() {
    if (!selectedSessionId || currentView !== 'active') return;
    if (!window.confirm('Mark this chat as resolved and return the customer to the chatbot?')) return;

    resolveBtn.disabled = true;
    try {
      const res = await adminFetch(`/api/admin/live-chats/${selectedSessionId}/resolve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      clearSelection();
      await loadQueue({ preserveSelection: false });
      startPolling();
    } catch (err) {
      alert(err.message || 'Could not resolve session.');
    } finally {
      resolveBtn.disabled = false;
    }
  }

  function getDeleteMessage(action) {
    const count = action.ids.length;
    const plural = count > 1;

    if (action.permanent) {
      if (action.type === 'all') {
        return 'Are you sure you want to delete all chats in the trash? This action will permanently delete them.';
      }

      if (plural) {
        return 'Are you sure you want to delete the selected chat(s)? This action will permanently delete them.';
      }

      return 'Are you sure you want to delete this chat? This action will permanently delete it.';
    }

    if (action.type === 'all') {
      return 'Are you sure you want to delete all chats in this view? This action will move them to the trash.';
    }

    if (plural) {
      return 'Are you sure you want to delete the selected chat(s)? This action will move them to the trash.';
    }

    return 'Are you sure you want to delete this chat? This action will move it to the trash.';
  }

  function openDeleteModal(action) {
    pendingDeleteAction = action;
    if (deleteMessageEl) {
      deleteMessageEl.textContent = getDeleteMessage(action);
    }
    deleteModalEl?.classList.remove('hidden');
    document.body.classList.add('admin-modal-open');
  }

  function closeDeleteModal() {
    pendingDeleteAction = null;
    deleteModalEl?.classList.add('hidden');
    document.body.classList.remove('admin-modal-open');
  }

  async function executeDeleteAction() {
    if (!pendingDeleteAction) return;

    const action = pendingDeleteAction;
    deleteConfirmBtn.disabled = true;

    try {
      if (action.type === 'all') {
        const endpoint = action.permanent
          ? '/api/admin/live-chats/purge-all'
          : '/api/admin/live-chats/trash-all';
        const body = action.permanent ? {} : { view: currentView };

        const res = await adminFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
      } else {
        const res = await adminFetch('/api/admin/chats/batch-delete', {
          method: 'POST',
          body: JSON.stringify({
            session_ids: action.ids,
            permanent: action.permanent,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
      }

      closeDeleteModal();
      selectedIds.clear();
      if (selectAllEl) {
        selectAllEl.checked = false;
        selectAllEl.indeterminate = false;
      }
      updateBulkActionButtons();

      if (selectedSessionId && action.ids.includes(selectedSessionId)) {
        clearSelection();
      }

      await fetchChatQueue({ preserveSelection: true });
      startPolling();
    } catch (err) {
      alert(err.message || 'Could not complete deletion.');
    } finally {
      deleteConfirmBtn.disabled = false;
    }
  }

  function requestSingleDelete(sessionId) {
    openDeleteModal({
      type: 'single',
      ids: [Number(sessionId)],
      permanent: isPermanentDeleteContext(),
    });
  }

  function requestSelectedDelete() {
    const ids = [...selectedIds];
    if (!ids.length) {
      alert('Select at least one chat to delete.');
      return;
    }

    openDeleteModal({
      type: 'selected',
      ids,
      permanent: isPermanentDeleteContext(),
    });
  }

  function requestDeleteAll() {
    if (!liveChats.length) {
      alert('There are no chats to delete in this view.');
      return;
    }

    openDeleteModal({
      type: 'all',
      ids: liveChats.map((chat) => chat.id),
      permanent: isPermanentDeleteContext(),
    });
  }

  function openRestoreModal(sessionId) {
    pendingRestoreSessionId = Number(sessionId);
    if (restoreErrorEl) {
      restoreErrorEl.textContent = '';
      restoreErrorEl.classList.add('hidden');
    }
    restoreModalEl?.classList.remove('hidden');
    document.body.classList.add('admin-modal-open');
  }

  function closeRestoreModal() {
    pendingRestoreSessionId = null;
    if (restoreErrorEl) {
      restoreErrorEl.textContent = '';
      restoreErrorEl.classList.add('hidden');
    }
    restoreModalEl?.classList.add('hidden');
    document.body.classList.remove('admin-modal-open');
  }

  function showRestoreError(message) {
    if (!restoreErrorEl) return;
    restoreErrorEl.textContent = message;
    restoreErrorEl.classList.remove('hidden');
  }

  async function parseAdminJsonResponse(res) {
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return data;
  }

  async function executeRestoreAction() {
    if (!pendingRestoreSessionId) return;

    const sessionId = pendingRestoreSessionId;
    restoreConfirmBtn.disabled = true;
    if (restoreErrorEl) {
      restoreErrorEl.textContent = '';
      restoreErrorEl.classList.add('hidden');
    }

    try {
      const res = await adminFetch(`/api/admin/live-chats/${sessionId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      const data = await parseAdminJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.message || `Restore failed (${res.status})`);
      }

      closeRestoreModal();
      selectedIds.delete(sessionId);

      if (selectedSessionId === sessionId) {
        clearSelection();
      }

      if (currentView === 'trash') {
        liveChats = liveChats.filter((chat) => chat.id !== sessionId);
        renderQueue();
      }

      currentView = 'active';
      subtabButtons.forEach((button) => {
        const isActive = button.dataset.view === 'active';
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (queueTitleEl) {
        queueTitleEl.textContent = VIEW_LABELS.active;
      }

      if (resolveBtn) {
        resolveBtn.classList.remove('hidden');
      }

      setSelectMode(false);
      await fetchChatQueue({ preserveSelection: false });
      await selectSession(sessionId);
      startPolling();
    } catch (err) {
      showRestoreError(err.message || 'Could not restore chat session.');
    } finally {
      restoreConfirmBtn.disabled = false;
    }
  }

  function requestRestore(sessionId) {
    openRestoreModal(Number(sessionId));
  }

  async function switchView(view) {
    if (view === currentView) return;
    currentView = view;
    clearSelection();
    updateViewUi();
    await fetchChatQueue({ preserveSelection: false });
    startPolling();
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      loadQueue({ preserveSelection: true });
    }, selectedSessionId && currentView === 'active' ? 1500 : 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  listEl.addEventListener('click', (event) => {
    const restoreButton = event.target.closest('[data-restore-id]');
    if (restoreButton) {
      event.preventDefault();
      event.stopPropagation();
      requestRestore(Number(restoreButton.dataset.restoreId));
      return;
    }

    const trashButton = event.target.closest('[data-trash-id]');
    if (trashButton) {
      event.preventDefault();
      event.stopPropagation();
      requestSingleDelete(Number(trashButton.dataset.trashId));
      return;
    }

    const sessionButton = event.target.closest('[data-session-id]');
    if (sessionButton && sessionButton.classList.contains('live-chat-item')) {
      selectSession(Number(sessionButton.dataset.sessionId));
    }
  });

  listEl.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.live-chat-item-checkbox');
    if (!checkbox) return;

    const sessionId = Number(checkbox.dataset.sessionId);
    if (checkbox.checked) {
      selectedIds.add(sessionId);
    } else {
      selectedIds.delete(sessionId);
    }

    const filteredCount = liveChats.filter((chat) => {
      const term = searchEl?.value.trim().toLowerCase() || '';
      if (!term) return true;
      const haystack = [chat.customer_name, chat.customer_contact, chat.last_message]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    }).length;

    syncSelectAllState(filteredCount);
  });

  selectAllEl?.addEventListener('change', () => {
    const term = searchEl?.value.trim().toLowerCase() || '';
    const filtered = liveChats.filter((chat) => {
      if (!term) return true;
      const haystack = [chat.customer_name, chat.customer_contact, chat.last_message]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });

    selectedIds.clear();
    if (selectAllEl.checked) {
      filtered.forEach((chat) => selectedIds.add(chat.id));
    }

    renderQueue();
  });

  subtabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      switchView(button.dataset.view || 'active');
    });
  });

  refreshBtn?.addEventListener('click', () => {
    fetchChatQueue({ preserveSelection: true });
  });

  selectModeBtn?.addEventListener('click', toggleSelectMode);

  deleteSelectedBtn?.addEventListener('click', requestSelectedDelete);
  deleteAllBtn?.addEventListener('click', requestDeleteAll);
  deleteConfirmBtn?.addEventListener('click', executeDeleteAction);
  restoreConfirmBtn?.addEventListener('click', executeRestoreAction);

  document.querySelectorAll('[data-close-live-chat-modal]').forEach((element) => {
    element.addEventListener('click', closeDeleteModal);
  });

  document.querySelectorAll('[data-close-live-chat-restore-modal]').forEach((element) => {
    element.addEventListener('click', closeRestoreModal);
  });

  searchEl?.addEventListener('input', () => {
    renderQueue();
    loadQueue({ preserveSelection: true });
  });

  sendBtn?.addEventListener('click', sendMessage);
  resolveBtn?.addEventListener('click', resolveSession);

  templatesEl?.addEventListener('change', () => {
    if (templatesEl.value) {
      inputEl.value = templatesEl.value;
      inputEl.focus();
    }
  });

  inputEl?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  updateViewUi();
  updateSelectModeUi();

  window.AdminLiveChat = {
    activate() {
      isTabActive = true;
      connectLiveChatEvents();
      fetchChatQueue({ preserveSelection: true });
      startPolling();
    },
    deactivate() {
      isTabActive = false;
      stopPolling();
      disconnectLiveChatEvents();
    },
    refreshBadge() {
      fetchChatQueue({ preserveSelection: false });
    },
    fetchChatQueue,
  };

  connectLiveChatEvents();
  loadQueue({ preserveSelection: false });
  window.setInterval(() => {
    if (!isTabActive) {
      loadQueue({ preserveSelection: false });
    }
  }, 10000);
})();
