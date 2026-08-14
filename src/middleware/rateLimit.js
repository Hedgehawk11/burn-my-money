const rateLimit = require("express-rate-limit");
const config = require("../config");

const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  limit: config.rateLimitMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMs,
  limit: config.loginRateLimitMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

module.exports = { globalLimiter, loginLimiter };
