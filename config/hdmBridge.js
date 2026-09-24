const axios = require('axios');
const { env } = require('./env');

const hdmBridge = axios.create({
  baseURL: env.mail.apiUrl,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${env.mail.apiKey}`,
    'Content-Type': 'application/json',
  },
});

const HDM_BRIDGE_ENDPOINTS = Object.freeze({
  SEND_EMAIL: '/emails/send',
});

const mailFrom = Object.freeze({
  email: env.mail.fromEmail,
  name: env.mail.fromName,
});

module.exports = { hdmBridge, HDM_BRIDGE_ENDPOINTS, mailFrom };