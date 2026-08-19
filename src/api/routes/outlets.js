const express = require('express');
const outletService = require('../../outlets/outletService');

const router = express.Router();

router.get('/states', async (_req, res) => {
  try {
    const states = await outletService.listStates();
    return res.json({ success: true, states });
  } catch (err) {
    console.error('Failed to load outlet states:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load outlet states.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { state, city, search, limit } = req.query;
    const outlets = await outletService.listOutlets({
      state: state || undefined,
      city: city || undefined,
      search: search || undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json({
      success: true,
      count: outlets.length,
      outlets,
    });
  } catch (err) {
    console.error('Failed to load outlets:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load outlets.' });
  }
});

router.get('/:outletId', async (req, res) => {
  try {
    const outlet = await outletService.getOutletById(req.params.outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found.' });
    }

    return res.json({ success: true, outlet });
  } catch (err) {
    console.error('Failed to load outlet:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load outlet.' });
  }
});

module.exports = router;
