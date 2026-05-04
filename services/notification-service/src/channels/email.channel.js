const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    // Use Ethereal (fake SMTP) in dev — replace with SendGrid in production
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) return false;
  if (!process.env.SMTP_USER) {
    logger.warn('Email skipped: no SMTP_USER configured');
    return false;
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"Bougons" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    logger.error(`Email failed: ${err.message}`);
    return false;
  }
};

module.exports = { sendEmail };