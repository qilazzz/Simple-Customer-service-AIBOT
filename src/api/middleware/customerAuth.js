const { verifyToken, getCustomerById } = require('../../auth/customerAuthService');

function extractCustomerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.headers['x-customer-token'] || null;
}

async function optionalCustomer(req, _res, next) {
  const token = extractCustomerToken(req);
  const userId = verifyToken(token);

  if (userId) {
    req.customer = await getCustomerById(userId);
    req.customerToken = token;
  }

  return next();
}

async function requireCustomer(req, res, next) {
  const token = extractCustomerToken(req);
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    });
  }

  const customer = await getCustomerById(userId);
  if (!customer) {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please log in again.',
    });
  }

  req.customer = customer;
  req.customerToken = token;
  return next();
}

module.exports = {
  extractCustomerToken,
  optionalCustomer,
  requireCustomer,
};
