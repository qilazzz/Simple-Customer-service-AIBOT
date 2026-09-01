const express = require('express');
const complaintService = require('../../complaints/complaintService');
const { login, requireAdmin } = require('../middleware/adminAuth');
const { subscribeLiveChatUpdates } = require('../../liveChat/liveChatHub');
const { VALID_STATUSES, VALID_CATEGORIES, CATEGORY_LABELS } = require('../../complaints/complaintTypes');

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  const token = login(password);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Invalid admin password.' });
  }

  return res.json({ success: true, token, message: 'Login successful.' });
});

router.get('/complaints', requireAdmin, async (req, res) => {
  try {
    const complaints = await complaintService.listComplaints({
      search: req.query.search,
      status: req.query.status,
      state: req.query.state,
      outlet: req.query.outlet,
      category: req.query.category,
    });

    return res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    console.error('Admin list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load complaints.' });
  }
});

router.get('/complaints/export-excel', requireAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !datePattern.test(String(startDate))) {
    return res.status(400).json({ success: false, message: 'startDate must be YYYY-MM-DD.' });
  }

  if (endDate && !datePattern.test(String(endDate))) {
    return res.status(400).json({ success: false, message: 'endDate must be YYYY-MM-DD.' });
  }

  try {
    const { buildComplaintsExcelBuffer, buildExportFilename } = require('../../complaints/complaintExcelExport');
    const complaints = await complaintService.listComplaintsForExport({ startDate, endDate });
    const buffer = await buildComplaintsExcelBuffer(complaints);
    const filename = buildExportFilename(startDate, endDate);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Complaints Excel export error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not export complaints.' });
  }
});

router.get('/complaints/:id', requireAdmin, async (req, res) => {
  try {
    let complaint = await complaintService.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    complaint = await complaintService.ensureComplaintAiSummary(complaint);
    return res.json({ success: true, complaint });
  } catch (err) {
    console.error('Admin detail error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load complaint.' });
  }
});

router.patch('/complaints/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const complaint = await complaintService.updateComplaintStatus(req.params.id, status);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    return res.json({ success: true, message: 'Status updated.', complaint });
  } catch (err) {
    console.error('Status update error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not update status.' });
  }
});

router.post('/complaints/:id/messages', requireAdmin, async (req, res) => {
  const { message_text } = req.body;
  if (!message_text?.trim()) {
    return res.status(400).json({ success: false, message: 'message_text is required.' });
  }

  try {
    const complaint = await complaintService.addAdminMessage(req.params.id, message_text.trim());
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    return res.json({
      success: true,
      message: 'Reply sent to customer (logged on ticket).',
      complaint,
      email_mock: {
        to: complaint.customer_contact,
        subject: `Re: US Pizza Complaint Ticket #${complaint.id}`,
        body: message_text.trim(),
      },
    });
  } catch (err) {
    console.error('Admin message error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not send message.' });
  }
});

router.post('/complaints/:id/draft-reply', requireAdmin, async (req, res) => {
  try {
    let complaint = await complaintService.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    complaint = await complaintService.ensureComplaintAiSummary(complaint);

    const { generateTicketEmailReply } = require('../../complaints/ticketAiReply');
    const draft = await generateTicketEmailReply(complaint);

    return res.json({
      success: true,
      draft: {
        message_text: draft.message_text,
        source: draft.source,
      },
    });
  } catch (err) {
    console.error('Admin draft reply error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not generate AI reply draft.' });
  }
});

router.get('/meta', requireAdmin, (_req, res) => {
  res.json({
    success: true,
    statuses: VALID_STATUSES,
    categories: VALID_CATEGORIES,
    category_labels: CATEGORY_LABELS,
  });
});

router.get('/analytics/button-clicks', requireAdmin, async (_req, res) => {
  try {
    const { getButtonClickStats } = require('../../analytics/buttonClickService');
    const stats = await getButtonClickStats();
    return res.json({ success: true, ...stats });
  } catch (err) {
    console.error('Button click analytics error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load click analytics.' });
  }
});

router.get('/analytics/click-details', requireAdmin, async (req, res) => {
  try {
    const { getButtonClickDetails } = require('../../analytics/buttonClickService');
    const buttonName = String(req.query.button_name || '').trim();

    if (!buttonName) {
      return res.status(400).json({
        success: false,
        message: 'button_name query parameter is required.',
      });
    }

    const clicks = await getButtonClickDetails(buttonName);
    return res.json({
      success: true,
      button_name: buttonName,
      total: clicks.length,
      clicks,
    });
  } catch (err) {
    console.error('Click details error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not load click details.',
    });
  }
});

router.get('/live-chats/events', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent({ type: 'connected' });

  const unsubscribe = subscribeLiveChatUpdates((payload) => {
    sendEvent(payload);
  });

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.get('/live-chats', requireAdmin, async (req, res) => {
  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const view = req.query.view || 'active';
    const [chats, waiting_count, trash_count] = await Promise.all([
      liveChatService.listLiveChatsByView(view, { search: req.query.search }),
      liveChatService.countWaitingChats(),
      liveChatService.countDeletedChats(),
    ]);

    return res.json({
      success: true,
      view,
      waiting_count,
      trash_count,
      count: chats.length,
      chats,
    });
  } catch (err) {
    console.error('Live chats list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load live chats.' });
  }
});

router.get('/live-chats/:id', requireAdmin, async (req, res) => {
  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const session = await liveChatService.getLiveChatSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live chat session not found.' });
    }

    await liveChatService.markLiveChatRead(session.id);
    session.unread_count = 0;

    return res.json({ success: true, session });
  } catch (err) {
    console.error('Live chat detail error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load live chat session.' });
  }
});

router.post('/live-chats/:id/claim', requireAdmin, async (req, res) => {
  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const session = await liveChatService.claimLiveChatSession(req.params.id, 'admin');
    return res.json({ success: true, session });
  } catch (err) {
    console.error('Live chat claim error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not claim live chat session.',
    });
  }
});

router.post('/live-chats/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const session = await liveChatService.resolveLiveChatSession(req.params.id);
    return res.json({ success: true, session });
  } catch (err) {
    console.error('Live chat resolve error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not resolve live chat session.',
    });
  }
});

router.post('/live-chats/:id/restore', requireAdmin, async (req, res) => {
  const sessionId = Number(req.params.id);

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'A valid session id is required.',
    });
  }

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const session = await liveChatService.restoreLiveChatSession(sessionId);
    return res.json({
      success: true,
      message: 'Chat restored successfully',
      session,
    });
  } catch (err) {
    console.error('Live chat restore error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not restore chat session.',
    });
  }
});

router.post('/live-chats/trash', requireAdmin, async (req, res) => {
  const { ids } = req.body;

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const deletedCount = await liveChatService.moveLiveChatsToTrash(ids);
    return res.json({ success: true, deleted_count: deletedCount });
  } catch (err) {
    console.error('Live chat trash error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not move chats to trash.',
    });
  }
});

router.post('/live-chats/trash-all', requireAdmin, async (req, res) => {
  const { view } = req.body;

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const deletedCount = await liveChatService.moveAllLiveChatsToTrash(view);
    return res.json({ success: true, deleted_count: deletedCount });
  } catch (err) {
    console.error('Live chat trash-all error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not move chats to trash.',
    });
  }
});

router.post('/live-chats/purge', requireAdmin, async (req, res) => {
  const { ids } = req.body;

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const purgedCount = await liveChatService.permanentlyDeleteLiveChats(ids);
    return res.json({ success: true, purged_count: purgedCount });
  } catch (err) {
    console.error('Live chat purge error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not permanently delete chats.',
    });
  }
});

router.post('/live-chats/purge-all', requireAdmin, async (req, res) => {
  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const purgedCount = await liveChatService.permanentlyDeleteAllInTrash();
    return res.json({ success: true, purged_count: purgedCount });
  } catch (err) {
    console.error('Live chat purge-all error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not permanently delete chats.',
    });
  }
});

router.post('/chats/batch-delete', requireAdmin, async (req, res) => {
  const { session_ids: sessionIds, permanent = false } = req.body;

  if (!Array.isArray(sessionIds) || !sessionIds.length) {
    return res.status(400).json({
      success: false,
      message: 'session_ids array is required.',
    });
  }

  try {
    const liveChatService = require('../../liveChat/liveChatService');

    if (permanent) {
      const purgedCount = await liveChatService.permanentlyDeleteLiveChats(sessionIds);
      return res.json({ success: true, purged_count: purgedCount });
    }

    const deletedCount = await liveChatService.moveLiveChatsToTrash(sessionIds);
    return res.json({ success: true, deleted_count: deletedCount });
  } catch (err) {
    console.error('Live chat batch-delete error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not delete selected chats.',
    });
  }
});

router.post('/chats/restore', requireAdmin, async (req, res) => {
  const sessionId = Number(
    req.body.sessionId ?? req.body.session_id ?? req.body.chat_id,
  );

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId is required.',
    });
  }

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const session = await liveChatService.restoreLiveChatSession(sessionId);
    return res.json({
      success: true,
      message: 'Chat restored successfully',
      session,
    });
  } catch (err) {
    console.error('Live chat restore error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not restore chat session.',
    });
  }
});

router.post('/chat/send', requireAdmin, async (req, res) => {
  const { live_session_id, message_text } = req.body;

  if (!live_session_id || !message_text?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'live_session_id and message_text are required.',
    });
  }

  try {
    const liveChatService = require('../../liveChat/liveChatService');
    const message = await liveChatService.addLiveChatMessage(
      Number(live_session_id),
      'admin',
      message_text.trim(),
    );
    const session = await liveChatService.getLiveChatSessionById(Number(live_session_id));

    return res.json({ success: true, message, session });
  } catch (err) {
    console.error('Admin live chat send error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not send message.',
    });
  }
});

module.exports = router;
