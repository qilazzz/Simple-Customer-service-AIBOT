const express = require('express');
const complaintService = require('../../complaints/complaintService');
const { validateComplaintPayload } = require('../validators/complaintValidator');
const { handlePhotoUpload } = require('../middleware/upload');
const { optionalCustomer } = require('../middleware/customerAuth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const complaints = await complaintService.listComplaints();
    return res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    console.error('Failed to fetch complaints:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load complaints.' });
  }
});

router.get('/track', optionalCustomer, async (req, res) => {
  try {
    const queryEmail = String(req.query.email || '').trim().toLowerCase();
    const queryPhone = String(req.query.phone || req.query.phone_number || '').trim();

    let email = queryEmail || null;
    let phone = queryPhone || null;
    let requireBoth = false;

    if (req.customer) {
      email = req.customer.email?.toLowerCase() || email;
      phone = req.customer.phone_number || phone;
    } else {
      requireBoth = true;
      if (!email || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Log in to view your complaint history, or provide both email and phone number.',
        });
      }
    }

    const complaints = await complaintService.listComplaintsForCustomer({
      email,
      phone,
      requireBoth,
    });

    return res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (err) {
    console.error('Failed to track complaints:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load complaint history.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const complaint = await complaintService.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    return res.json({ success: true, complaint });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not load complaint.' });
  }
});

router.post('/', handlePhotoUpload, async (req, res) => {
  const validation = validateComplaintPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors,
    });
  }

  try {
    const data = validation.data;
    const contact = [data.customer_email, data.customer_phone].filter(Boolean).join(' / ');
    const files = req.files || [];
    const attachmentUrls = files.map((f) => `/uploads/complaints/${f.filename}`);

    const complaint = await complaintService.createComplaint(
      {
        ...data,
        customer_contact: contact || data.customer_phone,
        description: data.message,
        attachment_urls: attachmentUrls,
        source: 'form',
      },
      {
        files,
        chatMessages: [{ sender: 'customer', message_text: data.message }],
      },
    );

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      ticket_id: complaint.id,
      photos_uploaded: files.length,
      complaint,
    });
  } catch (err) {
    console.error('Failed to save complaint:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not submit complaint. Please try again later.',
    });
  }
});

module.exports = router;
