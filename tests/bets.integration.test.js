const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");
const Team = require("../src/models/Team");
const {
  connectTestDb,
  disconnectTestDb,
  getTeam9999,
  mintToken,
  makeGambler,
  getOrCreateTeamAdmin,
  cleanupTeam9999Match,
  snapshotPool,
  restorePool,
  startServer,
  apiFetch,
} = require("./helpers");
const config = require("../src/config");

const describeIntegration = config.mongoUri ? describe : describe.skip;

describeIntegration("team 9999 bet and resolve flow", () => {
  let team;
  let server;
  let baseUrl;
  let poolBefore;
  let previousActiveMatchId;
  let matchId;
  let redGambler;
  let blueGambler;
  let admin;
  let adminCreated;
  const createdUserIds = [];

  before(async () => {
    await connectTestDb();
    team = await getTeam9999();
    poolBefore = await snapshotPool(team._id);
    previousActiveMatchId = team.activeMatchId || null;
    matchId = `TEST-9999-${Date.now()}`;
    const adminResult = await getOrCreateTeamAdmin(team);
    admin = adminResult.admin;
    adminCreated = adminResult.created;
    if (adminCreated) {
      createdUserIds.push(admin._id);
    }
    redGambler = await makeGambler(team._id, "red", 1000);
    blueGambler = await makeGambler(team._id, "blue", 1000);
    createdUserIds.push(redGambler._id, blueGambler._id);
    const started = await startServer();
    server = started.server;
    baseUrl = started.baseUrl;
    const setActive = await apiFetch(baseUrl, "/team/active-match", {
      token: mintToken(admin),
      method: "PATCH",
      body: { matchId },
    });
    assert.equal(setActive.status, 200);
    assert.equal(setActive.data.activeMatchId, matchId);
  });

  after(async () => {
    try {
      if (team && matchId) {
        await cleanupTeam9999Match(team, matchId, createdUserIds);
        await restorePool(team._id, poolBefore);
        await Team.findByIdAndUpdate(team._id, { activeMatchId: previousActiveMatchId });
      }
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      await disconnectTestDb();
    }
  });

  it("places opposing bets and reports full-pool estimates", async () => {
    const redBet = await apiFetch(baseUrl, "/api/bets", {
      token: mintToken(redGambler),
      method: "POST",
      body: { matchId, alliance: "red", amount: 100 },
    });
    assert.equal(redBet.status, 201);
    const blueBet = await apiFetch(baseUrl, "/api/bets", {
      token: mintToken(blueGambler),
      method: "POST",
      body: { matchId, alliance: "blue", amount: 150 },
    });
    assert.equal(blueBet.status, 201);
    const totalPool = poolBefore + 250;
    assert.equal(blueBet.data.poolBalance, totalPool);
    const redBets = await apiFetch(baseUrl, "/api/my-bets", { token: mintToken(redGambler) });
    assert.equal(redBets.status, 200);
    const redEntry = redBets.data.bets.find((bet) => bet.matchId === matchId);
    assert.ok(redEntry);
    assert.equal(redEntry.settled, false);
    assert.equal(redEntry.estimatedWinnings, totalPool);
    const blueBets = await apiFetch(baseUrl, "/api/my-bets", { token: mintToken(blueGambler) });
    assert.equal(blueBets.status, 200);
    const blueEntry = blueBets.data.bets.find((bet) => bet.matchId === matchId);
    assert.ok(blueEntry);
    assert.equal(blueEntry.estimatedWinnings, totalPool);
  });

  it("resolves red and pays the whole pool to the winner", async () => {
    const resolved = await apiFetch(baseUrl, "/team/matches/resolve", {
      token: mintToken(admin),
      method: "POST",
      body: { matchId, winningAlliance: "red" },
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.data.matchId, matchId);
    const totalPool = poolBefore + 250;
    const redAfter = await User.findById(redGambler._id);
    const blueAfter = await User.findById(blueGambler._id);
    assert.equal(redAfter.balance, 1000 - 100 + totalPool);
    assert.equal(blueAfter.balance, 1000 - 150);
    const state = await apiFetch(baseUrl, "/team/state", { token: mintToken(admin) });
    assert.equal(state.status, 200);
    assert.equal(state.data.poolBalance, 0);
    const redBets = await apiFetch(baseUrl, "/api/my-bets", { token: mintToken(redGambler) });
    const redEntry = redBets.data.bets.find((bet) => bet.matchId === matchId);
    assert.equal(redEntry.settled, true);
    assert.equal(redEntry.estimatedWinnings, null);
    const debts = await apiFetch(baseUrl, "/team/debts", { token: mintToken(admin) });
    assert.equal(debts.status, 200);
    const debt = debts.data.debts.find(
      (entry) => entry.from === blueGambler.username && entry.to === redGambler.username
    );
    assert.ok(debt);
    assert.equal(debt.amount, 150);
  });
});
