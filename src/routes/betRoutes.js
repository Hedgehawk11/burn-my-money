const express = require("express");
const Bet = require("../models/Bet");
const User = require("../models/User");
const Team = require("../models/Team");
const { requireAuth } = require("../middleware/auth");
const { getPoolState } = require("../services/adminBootstrap");

const router = express.Router();

router.use(requireAuth);

router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("username balance role teamId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let team = null;
    if (user.teamId) {
      const teamDoc = await Team.findById(user.teamId).select("name");
      team = teamDoc ? teamDoc.name : null;
    }

    const state = await getPoolState(user.teamId ? user.teamId.toString() : null);

    return res.json({
      user,
      poolBalance: state.poolBalance,
      team,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load account state" });
  }
});

router.get("/my-bets", async (req, res) => {
  try {
    const bets = await Bet.find({ user: req.user.userId }).sort({ createdAt: -1 });
    return res.json({ bets });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load bets" });
  }
});

router.post("/bets", async (req, res) => {
  try {
    const { matchId, alliance, amount } = req.body;

    if (!matchId || !alliance || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        error: "matchId, alliance, and integer amount > 0 are required",
      });
    }

    if (!["red", "blue"].includes(alliance)) {
      return res.status(400).json({ error: "alliance must be red or blue" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const teamId = user.teamId;
    const state = await getPoolState(teamId ? teamId.toString() : null);

    user.balance -= amount;
    state.poolBalance += amount;

    await user.save();
    const bet = await Bet.create({
      matchId,
      user: user._id,
      alliance,
      amount,
      teamId,
      settled: false,
    });
    await state.save();

    return res.status(201).json({
      bet,
      newBalance: user.balance,
      poolBalance: state.poolBalance,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to place bet" });
  }
});

module.exports = router;