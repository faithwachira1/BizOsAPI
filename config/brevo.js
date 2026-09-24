const axios = require('axios');
const { env } = require('./env');

const brevo = axios.create({
  baseURL: 'https://api.brevo.com/v3',
  timeout: 10000,
  headers: {
    'api-key': env.brevo.apiKey,
    'Content-Type': 'application/json',
  },
});

const brevoSender = env.brevo.sender;

module.exports = { brevo, brevoSender };