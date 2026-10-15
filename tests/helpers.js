require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const config = require("../src/config");
const Team = require("../src/models/Team");
const User = require("../src/models/User");
const Bet = require("../src/models/Bet");
const MatchResult = require("../src/models/MatchResult");
const Debt = require("../src/models/Debt");
const SystemState = require("../src/models/SystemState");
const { getPoolState } = require("../src/services/adminBootstrap");
const app = require("../src/app");

async function connectTestDb() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is not set in the environment");
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  }
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

async function getTeam9999() {
  const team = await Team.findOne({ name: "9999" });
  if (!team) {
    throw new Error('Test team "9999" not found. Create it before running integration tests.');
  }
  return team;
}

function mintToken(user) {
  const teamId = user.teamId ? user.teamId.toString() : null;
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      teamId,
    },
    config.jwtSecret,
    { expiresIn: "1h" }
  );
}

function authHeader(user) {
  return { Authorization: `Bearer ${mintToken(user)}` };
}

async function makeGambler(teamId, suffix, balance) {
  const username = `test-${Date.now()}-${suffix}`;
  const passwordHash = await bcrypt.hash("password123", 4);
  return User.create({
    username,
    passwordHash,
    balance,
    role: "gambler",
    teamId,
  });
}

async function getOrCreateTeamAdmin(team) {
  const existing = await User.findOne({ teamId: team._id, role: "admin" });
  if (existing) {
    return { admin: existing, created: false };
  }
  const passwordHash = await bcrypt.hash("password123", 4);
  const admin = await User.create({
    username: `test-admin-${Date.now()}`,
    passwordHash,
    balance: 0,
    role: "admin",
    teamId: team._id,
  });
  team.admin = admin._id;
  await team.save();
  return { admin, created: true };
}

async function cleanupTeam9999Match(team, matchId, createdUserIds = []) {
  const teamId = team._id;
  await Bet.deleteMany({ matchId: { $eq: matchId }, teamId: { $eq: teamId } });
  await MatchResult.deleteMany({ matchId: { $eq: matchId }, teamId: { $eq: teamId } });
  await Debt.deleteMany({ matchId: { $eq: matchId }, teamId: { $eq: teamId } });
  if (createdUserIds.length) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
}

async function snapshotPool(teamId) {
  const state = await getPoolState(teamId.toString());
  return state.poolBalance;
}

async function restorePool(teamId, poolBalance) {
  await SystemState.findOneAndUpdate(
    { key: `team:${teamId.toString()}` },
    { $set: { poolBalance } },
    { upsert: true }
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function apiFetch(baseUrl, path, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  return { status: response.status, data };
}

module.exports = {
  connectTestDb,
  disconnectTestDb,
  getTeam9999,
  mintToken,
  authHeader,
  makeGambler,
  getOrCreateTeamAdmin,
  cleanupTeam9999Match,
  snapshotPool,
  restorePool,
  startServer,
  apiFetch,
};
