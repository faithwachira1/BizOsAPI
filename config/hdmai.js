const axios = require('axios');
const { env } = require('./env');

const hdmAi = axios.create({
  baseURL: env.hdmAi.url,
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${env.hdmAi.key}`,
    'Content-Type': 'application/json',
  },
});

const HDM_AI_ENDPOINTS = Object.freeze({
  PUBLIC_CHAT: '/api/v1/projects/general/public-chat',
});

module.exports = { hdmAi, HDM_AI_ENDPOINTS };