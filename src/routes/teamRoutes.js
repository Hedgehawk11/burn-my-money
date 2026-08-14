const express = require("express");
const bcrypt = require("bcryptjs");
const Bet = require("../models/Bet");
const MatchResult = require("../models/MatchResult");
const User = require("../models/User");
const Team = require("../models/Team");
const { requireAuth, requireTeamAdmin } = require("../middleware/auth");
const { getPoolState } = require("../services/adminBootstrap");
const { resolveMatch, resettleMatch } = require("../services/matchResolution");

const router = express.Router();

router.use(requireAuth, requireTeamAdmin);

router.get("/state", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const state = await getPoolState(teamId);
    const members = await User.find({ teamId })
      .select("username balance role")
      .sort({ username: 1 });
    const teamDoc = await Team.findById(teamId).select("activeMatchId");
    const unsettledMatches = await Bet.distinct("matchId", { teamId, settled: false });
    const settledMatches = await MatchResult.distinct("matchId", { teamId });

    return res.json({
      teamId,
      poolBalance: state.poolBalance,
      activeMatchId: teamDoc ? teamDoc.activeMatchId : null,
      unsettledMatches,
      settledMatches,
      members,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load team state" });
  }
});

router.patch("/active-match", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const matchId = (req.body.matchId || "").trim();

    if (!matchId) {
      return res.status(400).json({ error: "matchId is required" });
    }

    const team = await Team.findByIdAndUpdate(
      teamId,
      { activeMatchId: matchId },
      { returnDocument: "after" }
    );
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    return res.json({ activeMatchId: team.activeMatchId });
  } catch (error) {
    return res.status(500).json({ error: "Failed to set active match" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const { username, password, initialBalance = 0 } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    if (!Number.isInteger(initialBalance) || initialBalance < 0) {
      return res.status(400).json({ error: "initialBalance must be an integer >= 0" });
    }

    const existing = await User.findOne({ username, teamId });
    if (existing) {
      return res.status(409).json({ error: "username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      passwordHash,
      balance: initialBalance,
      role: "gambler",
      teamId,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        balance: user.balance,
        role: user.role,
        teamId: user.teamId,
      },
      minted: initialBalance,
      note: "initialBalance is currency minted by the team admin",
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create user" });
  }
});

router.delete("/users/:username", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const { username } = req.params;

    const user = await User.findOne({ username, teamId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.teamId || user.teamId.toString() !== teamId) {
      return res.status(403).json({ error: "Can only delete users in your own team" });
    }

    const removedBalance = user.balance;
    await user.deleteOne();

    return res.json({
      deletedUser: username,
      removedBalance,
      burned: removedBalance,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

router.patch("/users/:username/balance", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const { username } = req.params;
    const { mode, amount } = req.body;

    if (!["add", "remove"].includes(mode)) {
      return res.status(400).json({ error: "mode must be add or remove" });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be an integer > 0" });
    }

    const user = await User.findOne({ username, teamId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.teamId || user.teamId.toString() !== teamId) {
      return res.status(403).json({ error: "Can only adjust users in your own team" });
    }

    if (mode === "remove" && user.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance for removal" });
    }

    if (mode === "add") {
      user.balance += amount;
    } else {
      user.balance -= amount;
    }

    await user.save();

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        balance: user.balance,
      },
      minted: mode === "add" ? amount : 0,
      burned: mode === "remove" ? amount : 0,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update balance" });
  }
});

router.post("/matches/resolve", async (req, res) => {
  try {
    const { matchId, winningAlliance } = req.body;

    if (!matchId || !["red", "blue", "tie"].includes(winningAlliance)) {
      return res.status(400).json({
        error: "matchId and winningAlliance (red, blue, or tie) are required",
      });
    }

    const result = await resolveMatch({
      matchId,
      winningAlliance,
      resolverId: req.user.userId,
      scopeTeamId: req.user.teamId,
    });

    if (!result) {
      return res.status(404).json({ error: "No unsettled bets for this match in your team" });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to resolve match" });
  }
});

router.post("/matches/resettle", async (req, res) => {
  try {
    const { matchId, winningAlliance } = req.body;

    if (!matchId || !["red", "blue", "tie"].includes(winningAlliance)) {
      return res.status(400).json({
        error: "matchId and winningAlliance (red, blue, or tie) are required",
      });
    }

    const result = await resettleMatch({
      matchId,
      winningAlliance,
      resolverId: req.user.userId,
      scopeTeamId: req.user.teamId,
    });

    if (!result) {
      return res.status(404).json({ error: "No resolved match found for this match in your team" });
    }

    return res.json({ ...result, resettled: true });
  } catch (error) {
    if (error.message === "Cannot resettle: a gambler has already spent their winnings.") {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Match was settled before resettle support; cannot resettle it.") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to resettle match" });
  }
});

router.get("/debts", async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const results = await MatchResult.find({ teamId }).select("matchId winningAlliance");

    const rawDebts = new Map();

    for (const result of results) {
      const bets = await Bet.find({ matchId: result.matchId, teamId, settled: true }).populate(
        "user",
        "username"
      );
      const winners = bets.filter((bet) => bet.alliance === result.winningAlliance);
      const losers = bets.filter((bet) => bet.alliance !== result.winningAlliance);

      if (winners.length === 0 || losers.length === 0) {
        continue;
      }

      const totalWinningStake = winners.reduce((sum, bet) => sum + bet.amount, 0);
      if (totalWinningStake <= 0) {
        continue;
      }

      for (const loser of losers) {
        for (const winner of winners) {
          const amount = (loser.amount * winner.amount) / totalWinningStake;
          if (amount <= 0) {
            continue;
          }

          const from = loser.user.username;
          const to = winner.user.username;
          if (from === to) {
            continue;
          }

          const key = `${from}|${to}`;
          rawDebts.set(key, (rawDebts.get(key) || 0) + amount);
        }
      }
    }

    const netDebts = new Map();
    const visited = new Set();

    for (const [key, amount] of rawDebts.entries()) {
      if (visited.has(key)) {
        continue;
      }

      const [from, to] = key.split("|");
      const reverseKey = `${to}|${from}`;
      const reverseAmount = rawDebts.get(reverseKey) || 0;
      const netAmount = amount - reverseAmount;

      visited.add(key);
      visited.add(reverseKey);

      if (netAmount > 0.000001) {
        netDebts.set(key, netAmount);
      } else if (netAmount < -0.000001) {
        netDebts.set(reverseKey, -netAmount);
      }
    }

    const debts = Array.from(netDebts.entries())
      .map(([key, amount]) => {
        const [from, to] = key.split("|");
        return {
          from,
          to,
          amount: Number(amount.toFixed(2)),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const totalsMap = new Map();
    for (const debt of debts) {
      if (!totalsMap.has(debt.from)) {
        totalsMap.set(debt.from, { user: debt.from, owes: 0, owedTo: 0 });
      }
      if (!totalsMap.has(debt.to)) {
        totalsMap.set(debt.to, { user: debt.to, owes: 0, owedTo: 0 });
      }

      totalsMap.get(debt.from).owes += debt.amount;
      totalsMap.get(debt.to).owedTo += debt.amount;
    }

    const summary = Array.from(totalsMap.values())
      .map((item) => ({
        user: item.user,
        owes: Number(item.owes.toFixed(2)),
        owedTo: Number(item.owedTo.toFixed(2)),
        net: Number((item.owedTo - item.owes).toFixed(2)),
      }))
      .sort((a, b) => {
        if (b.net !== a.net) {
          return b.net - a.net;
        }
        return a.user.localeCompare(b.user);
      });

    return res.json({ debts, summary });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load debt report" });
  }
});

module.exports = router;