const app = require("../src/app");
const { connectAndBootstrap } = require("../src/db");

module.exports = async function handler(req, res) {
  try {
    await connectAndBootstrap();
    return app(req, res);
  } catch (error) {
    console.error("Server initialization failed", error);
    return res.status(500).json({ error: "Server initialization failed", detail: error.message });
  }
};