const db = require('../db/knex');
const { CATEGORY_LABELS, STATUS_LABELS } = require('./complaintTypes');
const {
  SUMMARY_UNAVAILABLE,
  generateTicketAiSummary,
  hasAnalyzableContent,
} = require('./ticketAiSummary');

/** Avoid MySQL collation errors between complaints and us_pizza_outlets. */
function withOutletJoin(query) {
  return query
    .leftJoin(
      db.raw(
        'us_pizza_outlets ON complaints.outlet_name COLLATE utf8mb4_unicode_ci = us_pizza_outlets.outlet_name COLLATE utf8mb4_unicode_ci',
      ),
    )
    .select('complaints.*', 'us_pizza_outlets.state as outlet_state');
}

async function loadPhotosForComplaints(ids) {
  if (!ids.length) return {};
  const photos = await db('complaint_photos').whereIn('complaint_id', ids);
  return photos.reduce((acc, photo) => {
    if (!acc[photo.complaint_id]) acc[photo.complaint_id] = [];
    acc[photo.complaint_id].push({
      id: photo.id,
      url: `/uploads/complaints/${photo.file_path}`,
      original_name: photo.original_name,
    });
    return acc;
  }, {});
}

async function loadMessagesForComplaint(complaintId) {
  return db('messages')
    .where({ complaint_id: complaintId })
    .orderBy('timestamp', 'asc');
}

function buildAttachmentUrls(row, photos = []) {
  if (row.attachment_urls) {
    try {
      const parsed =
        typeof row.attachment_urls === 'string'
          ? JSON.parse(row.attachment_urls)
          : row.attachment_urls;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // fall through to photos
    }
  }
  return photos.map((p) => p.url);
}

/**
 * @param {Object} row
 * @param {Object} [options]
 * @param {Array} [options.photos]
 * @param {Array} [options.messages]
 */
function formatComplaint(row, { photos = [], messages = [] } = {}) {
  const category = row.complaint_category || row.category || 'other';
  const status = row.status === 'in_review' ? 'in_progress' : row.status;

  return {
    id: row.id,
    ticket_id: row.id,
    customer_name: row.customer_name,
    customer_contact:
      row.customer_contact ||
      [row.customer_email, row.customer_phone].filter(Boolean).join(' / ') ||
      null,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    order_id: row.order_id,
    outlet_name: row.outlet_name || null,
    outlet_state: row.outlet_state || null,
    category,
    complaint_category: category,
    category_label: CATEGORY_LABELS[category] || category,
    description: row.description || row.message,
    message: row.description || row.message,
    chat_transcript: row.chat_transcript || null,
    attachment_urls: buildAttachmentUrls(row, photos),
    photos,
    ai_summary: row.ai_summary,
    sentiment: row.sentiment,
    priority: row.priority || 'Medium',
    status,
    status_label: STATUS_LABELS[status] || status,
    source: row.source || 'form',
    created_at: row.created_at,
    updated_at: row.updated_at,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      message_text: m.message_text,
      timestamp: m.timestamp,
    })),
  };
}

async function listComplaints(filters = {}) {
  let query = withOutletJoin(db('complaints')).orderBy('complaints.created_at', 'desc');

  if (filters.status) query = query.where('complaints.status', filters.status);

  if (filters.category) {
    query = query.where('complaints.complaint_category', filters.category);
  }

  if (filters.state) {
    query = query.where('us_pizza_outlets.state', filters.state);
  }

  if (filters.outlet) {
    query = query.whereRaw(
      'us_pizza_outlets.outlet_name COLLATE utf8mb4_unicode_ci = ?',
      [filters.outlet],
    );
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.where(function searchScope() {
      this.where('complaints.customer_name', 'like', term)
        .orWhere('complaints.customer_email', 'like', term)
        .orWhere('complaints.customer_contact', 'like', term)
        .orWhere('complaints.order_id', 'like', term)
        .orWhere('complaints.outlet_name', 'like', term)
        .orWhere('complaints.message', 'like', term)
        .orWhere('complaints.description', 'like', term);
    });
  }

  const rows = await query;
  const photosByComplaint = await loadPhotosForComplaints(rows.map((r) => r.id));

  return rows.map((row) => formatComplaint(row, { photos: photosByComplaint[row.id] || [] }));
}

function isValidDateParam(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

async function listComplaintsForExport(filters = {}) {
  let query = withOutletJoin(db('complaints')).orderBy('complaints.created_at', 'desc');

  if (filters.startDate && isValidDateParam(filters.startDate)) {
    query = query.where('complaints.created_at', '>=', `${filters.startDate.trim()} 00:00:00`);
  }

  if (filters.endDate && isValidDateParam(filters.endDate)) {
    query = query.where('complaints.created_at', '<=', `${filters.endDate.trim()} 23:59:59`);
  }

  const rows = await query;
  const photosByComplaint = await loadPhotosForComplaints(rows.map((row) => row.id));

  return rows.map((row) => formatComplaint(row, { photos: photosByComplaint[row.id] || [] }));
}

function normalizePhone(value) {
  return String(value || '').replace(/[\s-]/g, '').trim();
}

async function loadMessagesForComplaints(ids) {
  if (!ids.length) return {};
  const rows = await db('messages').whereIn('complaint_id', ids).orderBy('timestamp', 'asc');
  return rows.reduce((acc, row) => {
    if (!acc[row.complaint_id]) acc[row.complaint_id] = [];
    acc[row.complaint_id].push(row);
    return acc;
  }, {});
}

function formatTicketReference(id) {
  return `CMP-${String(id).padStart(3, '0')}`;
}

const PUBLIC_NOTE_PREFIX = '[Public note]';
const STATUS_UPDATE_PATTERN = /^Status updated to /i;

function looksLikeInternalEmailReply(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (value.length > 280) return true;
  if (/^AI Summary Context:/i.test(value)) return true;
  if (/^Dear\s+/i.test(value) && /Warm regards|Customer Care Team|US Pizza Customer Care/i.test(value)) {
    return true;
  }
  return false;
}

function isPublicStatusUpdate(message) {
  const text = String(message.message_text || '').trim();
  if (!text || String(message.sender || '').toLowerCase() !== 'admin') return false;
  if (looksLikeInternalEmailReply(text)) return false;
  if (STATUS_UPDATE_PATTERN.test(text)) return true;
  if (text.startsWith(PUBLIC_NOTE_PREFIX)) return true;
  return false;
}

function formatPublicStatusUpdate(message) {
  let text = String(message.message_text || '').trim();
  if (text.startsWith(PUBLIC_NOTE_PREFIX)) {
    text = text.slice(PUBLIC_NOTE_PREFIX.length).trim();
  }
  return {
    message_text: text,
    timestamp: message.timestamp,
  };
}

function extractPublicStatusUpdates(messages = []) {
  const seen = new Set();
  return messages
    .filter(isPublicStatusUpdate)
    .map(formatPublicStatusUpdate)
    .filter((update) => {
      const key = `${update.message_text}|${update.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatComplaintForCustomerTracking(row, messages = []) {
  const formatted = formatComplaint(row, { messages });
  const statusUpdates = extractPublicStatusUpdates(formatted.messages);

  return {
    id: formatted.id,
    ticket_reference: formatTicketReference(formatted.id),
    status: formatted.status,
    status_label: formatted.status_label,
    category: formatted.category,
    category_label: formatted.category_label,
    order_id: formatted.order_id,
    description: formatted.description,
    outlet_name: formatted.outlet_name,
    created_at: formatted.created_at,
    updated_at: formatted.updated_at,
    status_updates: statusUpdates,
  };
}

/**
 * List complaints belonging to a customer by email / phone.
 * @param {{ email?: string, phone?: string, requireBoth?: boolean }} filters
 */
async function listComplaintsForCustomer({ email, phone, requireBoth = false } = {}) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const normalizedPhone = phone ? normalizePhone(phone) : null;

  if (!normalizedEmail && !normalizedPhone) {
    return [];
  }

  let query = withOutletJoin(db('complaints')).orderBy('complaints.created_at', 'desc');

  if (requireBoth) {
    query = query
      .where('complaints.customer_email', normalizedEmail)
      .whereRaw('REPLACE(REPLACE(complaints.customer_phone, " ", ""), "-", "") = ?', [
        normalizedPhone,
      ]);
  } else {
    query = query.where(function matchCustomerContact() {
      if (normalizedEmail) {
        this.orWhere('complaints.customer_email', normalizedEmail);
      }
      if (normalizedPhone) {
        this.orWhereRaw('REPLACE(REPLACE(complaints.customer_phone, " ", ""), "-", "") = ?', [
          normalizedPhone,
        ]);
      }
    });
  }

  const rows = await query;
  const messagesByComplaint = await loadMessagesForComplaints(rows.map((row) => row.id));

  return rows.map((row) =>
    formatComplaintForCustomerTracking(row, messagesByComplaint[row.id] || []),
  );
}

async function getComplaintById(id) {
  const row = await withOutletJoin(db('complaints')).where('complaints.id', id).first();
  if (!row) return null;

  const photos = (await loadPhotosForComplaints([id]))[id] || [];
  const messages = await loadMessagesForComplaint(id);
  return formatComplaint(row, { photos, messages });
}

/**
 * @param {Object} data
 * @param {Object} [options]
 * @param {Array<{filename: string, originalname: string}>} [options.files]
 * @param {Array<{sender: string, message_text: string}>} [options.chatMessages]
 */
async function createComplaint(data, { files = [], chatMessages = [] } = {}) {
  let aiSummary = data.ai_summary || null;
  let sentiment = data.sentiment || null;
  let chatTranscript = data.chat_transcript || null;

  const shouldGenerateAi =
    !aiSummary ||
    aiSummary === SUMMARY_UNAVAILABLE ||
    !sentiment;

  if (shouldGenerateAi) {
    const generated = await generateTicketAiSummary({
      description: data.description || data.message,
      chatTranscript,
      chatMessages,
      orderId: data.order_id,
      customerName: data.customer_name,
      category: data.complaint_category || data.category,
    });

    aiSummary = generated.ai_summary;
    sentiment = generated.sentiment;
    chatTranscript = generated.chat_transcript || chatTranscript;
  }

  const trx = await db.transaction();

  try {
    const insertData = {
      customer_name: data.customer_name,
      customer_email:
        data.customer_email ||
        (data.customer_contact?.includes('@') ? data.customer_contact : 'noreply@local.dev'),
      customer_phone: data.customer_phone || null,
      customer_contact: data.customer_contact,
      order_id: data.order_id || null,
      outlet_name: data.outlet_name || null,
      outlet_id: data.outlet_id || null,
      complaint_category: data.complaint_category || data.category || 'other',
      message: data.description || data.message,
      description: data.description || data.message,
      chat_transcript: chatTranscript,
      ai_summary: aiSummary,
      sentiment,
      priority: data.priority || 'Medium',
      attachment_urls: data.attachment_urls ? JSON.stringify(data.attachment_urls) : null,
      status: 'pending',
      source: data.source || 'chatbot',
    };

    const [complaintId] = await trx('complaints').insert(insertData);

    if (files.length) {
      await trx('complaint_photos').insert(
        files.map((file) => ({
          complaint_id: complaintId,
          file_path: file.filename,
          original_name: file.originalname,
        })),
      );
    }

    const messagesToInsert = chatMessages.length
      ? chatMessages
      : [{ sender: 'customer', message_text: insertData.description }];

    await trx('messages').insert(
      messagesToInsert.map((m) => ({
        complaint_id: complaintId,
        sender: m.sender,
        message_text: m.message_text,
      })),
    );

    await trx.commit();
    return getComplaintById(complaintId);
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

async function updateComplaintStatus(id, status) {
  const normalized = status === 'in_review' ? 'in_progress' : status;
  const existing = await db('complaints').where({ id }).first();
  if (!existing) return null;

  const previousStatus = existing.status === 'in_review' ? 'in_progress' : existing.status;

  await db('complaints').where({ id }).update({ status: normalized });

  if (previousStatus !== normalized) {
    const label = STATUS_LABELS[normalized] || normalized;
    await db('messages').insert({
      complaint_id: id,
      sender: 'admin',
      message_text: `Status updated to ${label}`,
    });
  }

  return getComplaintById(id);
}

async function addAdminMessage(complaintId, messageText) {
  await db('messages').insert({
    complaint_id: complaintId,
    sender: 'admin',
    message_text: messageText,
  });
  return getComplaintById(complaintId);
}

async function ensureComplaintAiSummary(complaint) {
  if (!complaint) return complaint;

  const hasSummary =
    complaint.ai_summary &&
    complaint.ai_summary.trim() &&
    complaint.ai_summary !== SUMMARY_UNAVAILABLE;

  if (hasSummary && complaint.sentiment) {
    return complaint;
  }

  const input = {
    description: complaint.description,
    chatTranscript: complaint.chat_transcript,
    chatMessages: complaint.messages,
    orderId: complaint.order_id,
    customerName: complaint.customer_name,
    category: complaint.complaint_category,
  };

  if (!hasAnalyzableContent(input)) {
    return {
      ...complaint,
      ai_summary: complaint.ai_summary || SUMMARY_UNAVAILABLE,
      sentiment: complaint.sentiment || 'neutral',
    };
  }

  const generated = await generateTicketAiSummary(input);

  await db('complaints')
    .where({ id: complaint.id })
    .update({
      ai_summary: generated.ai_summary,
      sentiment: generated.sentiment,
      chat_transcript: generated.chat_transcript || complaint.chat_transcript,
    });

  return getComplaintById(complaint.id);
}

module.exports = {
  listComplaints,
  listComplaintsForExport,
  listComplaintsForCustomer,
  getComplaintById,
  createComplaint,
  updateComplaintStatus,
  addAdminMessage,
  ensureComplaintAiSummary,
  formatComplaint,
  formatComplaintForCustomerTracking,
  formatTicketReference,
};
