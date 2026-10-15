function calculateEstimates({ poolBalance, groupBets }) {
  const estimates = new Map();
  if (!groupBets.length || poolBalance <= 0) {
    groupBets.forEach((bet) => {
      estimates.set(bet._id.toString(), 0);
    });
    return estimates;
  }
  const allianceCount = new Set(groupBets.map((bet) => bet.alliance)).size;
  if (allianceCount === 1) {
    groupBets.forEach((bet) => {
      estimates.set(bet._id.toString(), bet.amount);
    });
    return estimates;
  }
  const totalsByAlliance = {};
  groupBets.forEach((bet) => {
    totalsByAlliance[bet.alliance] = (totalsByAlliance[bet.alliance] || 0) + bet.amount;
  });
  ["red", "blue"].forEach((alliance) => {
    const winners = groupBets.filter((bet) => bet.alliance === alliance);
    if (!winners.length) {
      return;
    }
    const totalWinningStake = totalsByAlliance[alliance];
    const planned = winners.map((bet) => {
      const raw = (poolBalance * bet.amount) / totalWinningStake;
      const base = Math.floor(raw);
      return {
        bet,
        base,
        fractional: raw - base,
        payout: base,
      };
    });
    const distributed = planned.reduce((sum, item) => sum + item.base, 0);
    let remainder = poolBalance - distributed;
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
    planned.forEach((item) => {
      estimates.set(item.bet._id.toString(), item.payout);
    });
  });
  return estimates;
}

module.exports = { calculateEstimates };
