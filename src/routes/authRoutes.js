const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Team = require("../models/Team");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password, teamId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const filter = { username };
    if (teamId) {
      filter.teamId = teamId;
    }

    const users = await User.find(filter);
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (users.length > 1) {
      return res.status(400).json({ error: "Multiple accounts match this username. Select a team." });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let team = null;
    if (user.teamId) {
      const teamDoc = await Team.findById(user.teamId).select("name");
      team = teamDoc ? teamDoc.name : null;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
        teamId: user.teamId ? user.teamId.toString() : null,
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        balance: user.balance,
        role: user.role,
        teamId: user.teamId,
        team,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to log in" });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    if (!username) {
      return res.json({ teams: [] });
    }

    const users = await User.find({ username, teamId: { $ne: null } }).select("teamId");
    const teamIds = [...new Set(users.map((user) => user.teamId.toString()))];
    const teams = teamIds.length ? await Team.find({ _id: { $in: teamIds } }).select("name") : [];

    return res.json({ teams: teams.map((team) => ({ id: team._id.toString(), name: team.name })) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load teams" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ ok: true, message: "Password updated" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update password" });
  }
});

module.exports = router;
