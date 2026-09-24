const express = require('express');

const bodyParser = [
  express.json({ limit: '1mb' }),
  express.urlencoded({ extended: false, limit: '1mb' }),
];

module.exports = { bodyParser };