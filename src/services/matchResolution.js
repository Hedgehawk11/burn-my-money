const mongoose = require("mongoose");
const Bet = require("../models/Bet");
const Debt = require("../models/Debt");
const MatchResult = require("../models/MatchResult");
const User = require("../models/User");
const { getPoolState } = require("./adminBootstrap");

async function settleGroup({ groupBets, winningAlliance, teamIdKey, resolverId }) {
  const state = await getPoolState(teamIdKey ? teamIdKey : null);
  const pool = state.poolBalance;
  const winners = groupBets.filter((bet) => bet.alliance === winningAlliance);
  const allianceCount = new Set(groupBets.map((bet) => bet.alliance)).size;
  const isOneSidedBet = allianceCount === 1;

  let payoutsByUser = {};
  let note;

  if (winningAlliance === "tie") {
    payoutsByUser = groupBets.reduce((acc, bet) => {
      const userId = bet.user.toString();
      acc[userId] = (acc[userId] || 0) + bet.amount;
      return acc;
    }, {});

    const refundTotal = groupBets.reduce((sum, bet) => sum + bet.amount, 0);
    state.poolBalance = Math.max(0, state.poolBalance - refundTotal);
    note = "Tie match. All bets refunded.";
  } else if (isOneSidedBet) {
    payoutsByUser = groupBets.reduce((acc, bet) => {
      const userId = bet.user.toString();
      acc[userId] = (acc[userId] || 0) + bet.amount;
      return acc;
    }, {});

    const refundTotal = groupBets.reduce((sum, bet) => sum + bet.amount, 0);
    state.poolBalance = Math.max(0, state.poolBalance - refundTotal);
    note = "Only one alliance had bets. Bets were refunded.";
  } else if (winners.length > 0 && pool > 0) {
    const totalWinningStake = winners.reduce((sum, bet) => sum + bet.amount, 0);

    const planned = winners.map((bet) => {
      const raw = (pool * bet.amount) / totalWinningStake;
      const base = Math.floor(raw);
      return {
        bet,
        base,
        fractional: raw - base,
        payout: base,
      };
    });

    let distributed = planned.reduce((sum, item) => sum + item.base, 0);
    let remainder = pool - distributed;

    planned.sort((a, b) => {
      if (b.fractional !== a.fractional) {
        return b.fractional - a.fractional;
      }
      return a.bet._id.toString().localeCompare(b.bet._id.toString());
    });

    for (let i = 0; i < planned.length && remainder > 0; i += 1) {
      planned[i].payout += 1;
      remainder -= 1;
    }

    payoutsByUser = planned.reduce((acc, item) => {
      const userId = item.bet.user.toString();
      acc[userId] = (acc[userId] || 0) + item.payout;
      return acc;
    }, {});

    state.poolBalance = 0;
    note = "Pool distributed proportionally to winning gamblers.";
  } else {
    note = "No winners on this alliance. Pool carries forward.";
  }

  for (const [userId, payout] of Object.entries(payoutsByUser)) {
    await User.findByIdAndUpdate(userId, { $inc: { balance: payout } });
  }

  await state.save();

  await Bet.updateMany(
    { _id: { $in: groupBets.map((bet) => bet._id) } },
    { $set: { settled: true } }
  );

  const teamId = teamIdKey ? new mongoose.Types.ObjectId(teamIdKey) : null;
  const payoutRecords = Object.entries(payoutsByUser).map(([userId, amount]) => ({
    userId,
    amount,
  }));

  const losers = groupBets.filter((bet) => bet.alliance !== winningAlliance);
  if (winningAlliance !== "tie" && winners.length > 0 && losers.length > 0) {
    const totalWinningStake = winners.reduce((sum, bet) => sum + bet.amount, 0);
    for (const loser of losers) {
      for (const winner of winners) {
        const amount = Math.floor((loser.amount * winner.amount) / totalWinningStake);
        if (amount <= 0 || loser.user.toString() === winner.user.toString()) {
          continue;
        }
        await Debt.updateOne(
          {
            teamId: { $eq: teamId },
            matchId: { $eq: groupBets[0].matchId },
            from: { $eq: loser.user },
            to: { $eq: winner.user },
          },
          { $setOnInsert: { teamId, matchId: groupBets[0].matchId, from: loser.user, to: winner.user, amount } },
          { upsert: true }
        );
      }
    }
  }

  await MatchResult.findOneAndUpdate(
    { matchId: { $eq: groupBets[0].matchId }, teamId: { $eq: teamId } },
    {
      matchId: groupBets[0].matchId,
      teamId,
      winningAlliance,
      resolvedBy: resolverId,
      payouts: payoutRecords,
      debtsCreated: true,
    },
    { upsert: true, returnDocument: "after" }
  );

  let userIdToName = {};
  if (Object.keys(payoutsByUser).length > 0) {
    const users = await User.find({ _id: { $in: Object.keys(payoutsByUser) } }).select("username");
    users.forEach((user) => {
      userIdToName[user._id.toString()] = user.username;
    });
  }

  const payouts = Object.entries(payoutsByUser).map(([userId, payout]) => ({
    userId,
    username: userIdToName[userId] || "unknown",
    payout,
  }));

  return {
    teamId: teamIdKey,
    winnerCount: winners.length,
    payouts,
    remainingPool: state.poolBalance,
    note,
  };
}

async function resolveMatch({ matchId, winningAlliance, resolverId, scopeTeamId = null }) {
  const bets = await Bet.find({ matchId, settled: false });

  const groups = new Map();
  for (const bet of bets) {
    const teamIdKey = bet.teamId ? bet.teamId.toString() : null;
    if (scopeTeamId && teamIdKey !== scopeTeamId) {
      continue;
    }
    if (!groups.has(teamIdKey)) {
      groups.set(teamIdKey, []);
    }
    groups.get(teamIdKey).push(bet);
  }

  if (groups.size === 0) {
    return null;
  }

  const results = [];
  for (const [teamIdKey, groupBets] of groups) {
    results.push(await settleGroup({ groupBets, winningAlliance, teamIdKey, resolverId }));
  }

  return { matchId, winningAlliance, results };
}

async function resettleMatch({ matchId, winningAlliance, resolverId, scopeTeamId = null }) {
  if (!scopeTeamId) {
    return null;
  }

  const result = await MatchResult.findOne({
    matchId: { $eq: matchId },
    teamId: { $eq: scopeTeamId },
  });
  if (!result) {
    return null;
  }

  if (result.payouts === undefined) {
    throw new Error("Match was settled before resettle support; cannot resettle it.");
  }

  for (const payout of result.payouts) {
    const user = await User.findById(payout.userId);
    if (!user || user.balance < payout.amount) {
      throw new Error("Cannot resettle: a gambler has already spent their winnings.");
    }
  }

  for (const payout of result.payouts) {
    await User.updateOne({ _id: payout.userId }, { $inc: { balance: -payout.amount } });
  }

  const state = await getPoolState(scopeTeamId);
  const totalRefund = result.payouts.reduce((sum, payout) => sum + payout.amount, 0);
  state.poolBalance += totalRefund;
  await state.save();

  await Bet.updateMany(
    { matchId: { $eq: matchId }, teamId: { $eq: scopeTeamId } },
    { $set: { settled: false } }
  );
  await Debt.deleteMany({ matchId: { $eq: matchId }, teamId: { $eq: scopeTeamId } });
  await result.deleteOne();

  return resolveMatch({ matchId, winningAlliance, resolverId, scopeTeamId });
}

module.exports = { resolveMatch, resettleMatch };