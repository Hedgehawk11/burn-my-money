const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Team = require("../models/Team");
const Bet = require("../models/Bet");
const MatchResult = require("../models/MatchResult");
const SystemState = require("../models/SystemState");
const { requireAuth, requireSuperuser } = require("../middleware/auth");
const { ensureSystemState } = require("../services/adminBootstrap");

const router = express.Router();

router.use(requireAuth, requireSuperuser);

router.post("/teams", async (req, res) => {
  try {
    const { name, adminUsername, adminPassword, initialBalance = 0 } = req.body;

    if (!name || !adminUsername || !adminPassword) {
      return res.status(400).json({
        error: "name, adminUsername, and adminPassword are required",
      });
    }

    if (!Number.isInteger(initialBalance) || initialBalance < 0) {
      return res.status(400).json({ error: "initialBalance must be an integer >= 0" });
    }

    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(409).json({ error: "team name already exists" });
    }

    const existingUser = await User.findOne({ username: adminUsername, teamId: null });
    if (existingUser) {
      return res.status(409).json({ error: "admin username already exists" });
    }

    const team = await Team.create({ name });

    try {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const admin = await User.create({
        username: adminUsername,
        passwordHash,
        balance: initialBalance,
        role: "admin",
        teamId: team._id,
      });

      await ensureSystemState(team._id);

      return res.status(201).json({
        team: {
          id: team._id,
          name: team.name,
        },
        admin: {
          id: admin._id,
          username: admin.username,
          balance: admin.balance,
          role: admin.role,
        },
        minted: initialBalance,
        note: "initialBalance is currency minted for the team admin",
      });
    } catch (error) {
      await team.deleteOne();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to create team" });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const teams = await Team.find({}).sort({ name: 1 });
    const users = await User.find({ teamId: { $ne: null } }).select("username role teamId balance");

    const teamsOut = await Promise.all(
      teams.map(async (team) => {
        const teamId = team._id;
        const members = users.filter((user) => user.teamId.toString() === teamId.toString());
        const admin = members.find((user) => user.role === "admin");
        const state = await SystemState.findOne({ teamId });

        return {
          id: team._id,
          name: team.name,
          admin: admin ? admin.username : null,
          memberCount: members.length,
          poolBalance: state ? state.poolBalance : 0,
          members: members.map((member) => ({
            id: member._id,
            username: member.username,
            role: member.role,
          })),
        };
      })
    );

    return res.json({ teams: teamsOut });
  } catch (error) {
    return res.status(500).json({ error: "Failed to list teams" });
  }
});

router.put("/teams/:id/admin", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    const user = await User.findOne({ username, teamId: team._id });
    if (!user) {
      return res.status(404).json({ error: "No member with that username in this team" });
    }

    await User.updateMany({ teamId: team._id, role: "admin" }, { role: "gambler" });

    user.role = "admin";
    await user.save();

    team.admin = user._id;
    await team.save();

    return res.json({
      team: {
        id: team._id,
        name: team.name,
      },
      admin: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to change team admin" });
  }
});

router.delete("/teams/:id", async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamId = team._id;
    const memberCount = await User.countDocuments({ teamId });

    await Bet.deleteMany({ teamId });
    await MatchResult.deleteMany({ teamId });
    await SystemState.deleteOne({ key: `team:${teamId}` });
    await User.deleteMany({ teamId });
    await team.deleteOne();

    return res.json({
      deletedTeam: team.name,
      memberCount,
      note: "Team, its members, bets, results, and pool were deleted.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete team" });
  }
});

module.exports = router;