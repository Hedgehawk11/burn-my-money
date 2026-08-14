const mongoose = require("mongoose");
const config = require("./config");
const { bootstrapAdmin } = require("./services/adminBootstrap");

let readyPromise = null;

function connectAndBootstrap() {
  if (!config.mongoUri) {
    return Promise.reject(new Error("MONGODB_URI is not set in the environment"));
  }
  if (!readyPromise) {
    readyPromise = (async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
      }
      await bootstrapAdmin();
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

module.exports = {
  connectAndBootstrap,
};