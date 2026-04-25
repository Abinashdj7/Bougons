const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().allow('').optional(),
  role: Joi.string().valid('rider', 'driver').default('rider'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  phone: Joi.string().allow('').optional(),
  avatar: Joi.string().uri(),
});

const updateDriverSchema = Joi.object({
  vehicle: Joi.object({
    make: Joi.string(),
    model: Joi.string(),
    year: Joi.number().min(2000).max(new Date().getFullYear() + 1),
    licensePlate: Joi.string(),
    color: Joi.string(),
  }),
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map((d) => d.message),
    });
  }
  req.body = value;
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updateDriverSchema,
};