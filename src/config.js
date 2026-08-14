const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "replace-this-secret",
  supervisorUsername: process.env.SUPERVISOR_USERNAME || "Superuser",
  supervisorPassword: process.env.SUPERVISOR_PASSWORD || "I<3MST3k",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
};

module.exports = config;