const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "replace-this-secret",
  supervisorUsername: process.env.SUPERVISOR_USERNAME || "Superuser",
  supervisorPassword: process.env.SUPERVISOR_PASSWORD || "I<3MST3k",
};

module.exports = config;