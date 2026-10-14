const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Bet = require("../models/Bet");
const SystemState = require("../models/SystemState");
const config = require("../config");

async function ensureSystemState(teamId = null) {
  const key = teamId ? `team:${teamId}` : "global";
  await SystemState.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, teamId, poolBalance: 0 } },
    { upsert: true, returnDocument: "after" }
  );
}

async function ensureSuperuser() {
  const existing = await User.findOne({ username: config.supervisorUsername, teamId: null });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.supervisorPassword, 12);
  await User.create({
    username: config.supervisorUsername,
    passwordHash,
    balance: 0,
    role: "superuser",
    teamId: null,
  });
}

async function bootstrapAdmin() {
  await User.syncIndexes();
  try {
    await Bet.syncIndexes();
  } catch (error) {
    console.warn("Bet indexes not synced (possible duplicate bets); one-bet rule still enforced per request.", error.message);
  }
  await ensureSystemState();
  await ensureSuperuser();
}

async function getPoolState(teamId = null) {
  const key = teamId ? `team:${teamId}` : "global";
  return SystemState.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, teamId, poolBalance: 0 } },
    { upsert: true, returnDocument: "after" }
  );
}

module.exports = {
  bootstrapAdmin,
  ensureSystemState,
  getPoolState,
};