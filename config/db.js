const mongoose = require('mongoose');
const { env } = require('./env');
const { logger } = require('../utils/logger');

async function connectDB() {
  mongoose.connection.on('connected', () => logger.info('mongodb connected'));
  mongoose.connection.on('error', (e) => logger.error({ err: e.message }, 'mongodb error'));
  mongoose.connection.on('disconnected', () => logger.warn('mongodb disconnected'));

  await mongoose.connect(env.mongodbUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoose };