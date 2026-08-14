require("dotenv").config();
const app = require("./app");
const config = require("./config");
const { connectAndBootstrap } = require("./db");

async function start() {
  if (!config.mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  if (!config.jwtSecret || config.jwtSecret === "replace-this-secret") {
    console.warn("Using default JWT secret. Set JWT_SECRET for production.");
  }

  try {
    await connectAndBootstrap();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
