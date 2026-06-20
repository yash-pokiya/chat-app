const ApiError = require('../utils/ApiError');

const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err.errors) {
      const message = err.errors.map((e) => e.message).join('. ');
      return next(new ApiError(400, message));
    }
    next(err);
  }
};

module.exports = validateRequest;
