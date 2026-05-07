const Joi = require('joi');
const { logger } = require('../utils/logger');


const schemas = {
    requestRide: Joi.object({
        pickup: Joi.object({
            address: Joi.string().required(),
            location: Joi.object({
                type: Joi.string().valid('Point').default('Point'),
                coordinates: Joi.array().length(2).items(Joi.number()).required(),
            }).required(),
        }).required(),
        destination: Joi.object({
            address: Joi.string().required(),
            location: Joi.object({
                type: Joi.string().valid('Point').default('Point'),
                coordinates: Joi.array().length(2).items(Joi.number()).required(),
            }).required(),
        }).required(),
        paymentMethod: Joi.string().valid('card', 'cash'),
    }),

    submitRating: Joi.object({
        score: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().max(500).optional(),
    }),

    cancelRide: Joi.object({
        reason: Joi.string().max(500).optional(),
    }),
};


const validate = (schemaKey) => (req, res, next) => {
    const schema = schemas[schemaKey];
    if (!schema) {
        logger.warn(`Validation schema not found: ${schemaKey}`);
        return next();
    }

    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const details = error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
        }));
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: details,
        });
    }

    req.body = value;
    next();
};

module.exports = { validate, schemas };
