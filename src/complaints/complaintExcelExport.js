const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { CATEGORY_LABELS, STATUS_LABELS } = require('./complaintTypes');

const HEADER_FILL = 'FFA61C1C';
const HEADER_FONT = 'FFFFFFFF';
const DESCRIPTION_COLUMN = 11;
const PHOTO_COLUMN = 12;
const PHOTO_COL_ZERO = 11;
const AI_SUMMARY_COLUMN = 13;
const WRAP_COLUMNS = new Set([DESCRIPTION_COLUMN, AI_SUMMARY_COLUMN]);
const IMAGE_WIDTH = 110;
const IMAGE_HEIGHT = 80;
const DATA_ROW_HEIGHT = 75;

const UPLOAD_SEARCH_DIRS = [
  path.join(__dirname, '../../uploads/complaints'),
  path.join(__dirname, '../../public/uploads/complaints'),
  path.join(__dirname, '../../public/uploads'),
];

const COLUMNS = [
  { header: 'Ticket ID', key: 'ticket_id', width: 14 },
  { header: 'Order ID', key: 'order_id', width: 16 },
  { header: 'Customer Name', key: 'customer_name', width: 22 },
  { header: 'Customer Email', key: 'customer_email', width: 28 },
  { header: 'Customer Phone', key: 'customer_phone', width: 18 },
  { header: 'Outlet', key: 'outlet_name', width: 24 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Created Date', key: 'created_date', width: 20 },
  { header: 'Customer Complaint Description', key: 'description', width: 42 },
  { header: 'Proof / Photo', key: 'photo', width: 18 },
  { header: 'AI Summary', key: 'ai_summary', width: 42 },
];

function formatTicketReference(id) {
  return `CMP-${String(id).padStart(3, '0')}`;
}

function formatExportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function extractPhotoFilename(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/\/uploads\/(?:complaints\/)?([^/?#]+)/i);
  if (match) return decodeURIComponent(match[1]);
  if (!text.includes('/') && !text.includes('\\')) return text;
  return path.basename(text);
}

function resolvePhotoFilename(complaint) {
  if (complaint.proof_photo_url) {
    const fromProof = extractPhotoFilename(complaint.proof_photo_url);
    if (fromProof) return fromProof;
  }

  if (complaint.photos?.length) {
    const photo = complaint.photos[0];
    const fromUrl = extractPhotoFilename(photo.url);
    if (fromUrl) return fromUrl;
    if (photo.file_path) return photo.file_path;
  }

  if (complaint.attachment_urls?.length) {
    const fromUrl = extractPhotoFilename(complaint.attachment_urls[0]);
    if (fromUrl) return fromUrl;
  }

  return null;
}

function resolvePhotoPath(complaint) {
  const filename = resolvePhotoFilename(complaint);
  if (!filename) return null;

  for (const dir of UPLOAD_SEARCH_DIRS) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) return filePath;
  }

  return null;
}

function getImageExtension(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (ext === 'jpg') return 'jpeg';
  if (['jpeg', 'png', 'gif'].includes(ext)) return ext;
  return 'jpeg';
}

function resolveCustomerEmail(complaint) {
  if (complaint.customer_email?.trim()) return complaint.customer_email.trim();
  const contact = String(complaint.customer_contact || '').trim();
  if (contact.includes('@')) return contact.split('/')[0].trim();
  return '';
}

function resolveCustomerPhone(complaint) {
  if (complaint.customer_phone?.trim()) return complaint.customer_phone.trim();
  const contact = String(complaint.customer_contact || '').trim();
  if (contact && !contact.includes('@')) return contact;
  if (contact.includes('/')) {
    const phonePart = contact.split('/').pop()?.trim();
    if (phonePart && !phonePart.includes('@')) return phonePart;
  }
  return '';
}

function mapComplaintToRow(complaint) {
  const category = complaint.complaint_category || complaint.category || 'other';
  const status = complaint.status === 'in_review' ? 'in_progress' : complaint.status;

  return {
    ticket_id: formatTicketReference(complaint.id),
    order_id: complaint.order_id || '',
    customer_name: complaint.customer_name || '',
    customer_email: resolveCustomerEmail(complaint),
    customer_phone: resolveCustomerPhone(complaint),
    outlet_name: complaint.outlet_name || '',
    category: CATEGORY_LABELS[category] || category,
    priority: complaint.priority || 'Medium',
    status: STATUS_LABELS[status] || status,
    created_date: formatExportDate(complaint.created_at),
    description: complaint.description || complaint.message || '',
    photo: '',
    ai_summary: complaint.ai_summary || '',
  };
}

function buildExportFilename(startDate, endDate) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (startDate && endDate) {
    return `complaints-${startDate}_to_${endDate}.xlsx`;
  }
  if (startDate) {
    return `complaints-from-${startDate}.xlsx`;
  }
  if (endDate) {
    return `complaints-until-${endDate}.xlsx`;
  }
  return `complaints-export-${stamp}.xlsx`;
}

/**
 * @param {Array<Object>} complaints
 * @returns {Promise<Buffer>}
 */
async function buildComplaintsExcelBuffer(complaints = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'US Pizza Admin Portal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Complaints', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = COLUMNS;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    };
    cell.font = {
      bold: true,
      color: { argb: HEADER_FONT },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF8B1515' } },
    };

    if (WRAP_COLUMNS.has(colNumber)) {
      worksheet.getColumn(colNumber).alignment = { wrapText: true, vertical: 'top' };
    }
  });

  complaints.forEach((complaint) => {
    const row = worksheet.addRow(mapComplaintToRow(complaint));
    row.height = DATA_ROW_HEIGHT;
    row.alignment = { vertical: 'top', wrapText: true };

    WRAP_COLUMNS.forEach((colNumber) => {
      row.getCell(colNumber).alignment = { wrapText: true, vertical: 'top' };
    });

    const photoPath = resolvePhotoPath(complaint);
    const photoCell = row.getCell(PHOTO_COLUMN);

    if (photoPath) {
      try {
        const imageId = workbook.addImage({
          buffer: fs.readFileSync(photoPath),
          extension: getImageExtension(photoPath),
        });

        worksheet.addImage(imageId, {
          tl: { col: PHOTO_COL_ZERO, row: row.number - 1 },
          ext: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
        });

        photoCell.value = '';
      } catch (err) {
        console.warn(`Could not embed photo for complaint ${complaint.id}:`, err.message);
        photoCell.value = 'No Photo';
      }
    } else {
      photoCell.value = 'No Photo';
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  buildComplaintsExcelBuffer,
  buildExportFilename,
  mapComplaintToRow,
  resolvePhotoPath,
};
