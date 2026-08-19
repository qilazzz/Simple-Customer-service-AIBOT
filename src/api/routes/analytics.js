const express = require('express');
const { trackButtonClick } = require('../../analytics/buttonClickService');

const router = express.Router();

router.post('/track-click', async (req, res) => {
  const { button_name, user_id } = req.body || {};

  if (!button_name?.trim()) {
    return res.status(400).json({ success: false, message: 'button_name is required.' });
  }

  try {
    const recorded = await trackButtonClick({ button_name, user_id });
    return res.status(201).json({ success: true, ...recorded });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Track click error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not record click.' });
  }
});

module.exports = router;
