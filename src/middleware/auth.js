const jwt = require("jsonwebtoken");
const config = require("../config");

function getTokenFromHeader(authorization) {
  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid auth token" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired auth token" });
  }
}

function requireSuperuser(req, res, next) {
  if (!req.user || req.user.role !== "superuser") {
    return res.status(403).json({ error: "Only the Superuser can perform this action" });
  }

  return next();
}

function requireTeamAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Only team admins can perform this action" });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireSuperuser,
  requireTeamAdmin,
};