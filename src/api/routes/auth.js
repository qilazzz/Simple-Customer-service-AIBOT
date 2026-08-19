const express = require('express');
const {
  registerCustomer,
  loginCustomer,
  getCustomerById,
  revokeToken,
  verifyToken,
} = require('../../auth/customerAuthService');
const { extractCustomerToken, requireCustomer } = require('../middleware/customerAuth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const result = await registerCustomer(req.body);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token: result.token,
      user: result.user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Registration failed.',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await loginCustomer(req.body);
    return res.json({
      success: true,
      message: 'Login successful.',
      token: result.token,
      user: result.user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Login failed.',
    });
  }
});

router.post('/logout', (req, res) => {
  const token = extractCustomerToken(req);
  if (token) revokeToken(token);
  return res.json({ success: true, message: 'Logged out.' });
});

router.get('/me', requireCustomer, (req, res) => {
  return res.json({ success: true, user: req.customer });
});

router.get('/session-check', (req, res) => {
  const token = extractCustomerToken(req);
  const userId = verifyToken(token);

  if (!userId) {
    return res.json({ success: true, authenticated: false });
  }

  getCustomerById(userId)
    .then((user) => {
      if (!user) {
        return res.json({ success: true, authenticated: false });
      }
      return res.json({ success: true, authenticated: true, user });
    })
    .catch(() => res.status(500).json({ success: false, message: 'Could not verify session.' }));
});

module.exports = router;
