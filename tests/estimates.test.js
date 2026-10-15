const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateEstimates } = require("../src/services/estimates");

function bet(id, alliance, amount) {
  return { _id: id, alliance, amount };
}

describe("calculateEstimates", () => {
  it("splits pool proportionally by stake", () => {
    const groupBets = [bet("a", "red", 100), bet("b", "red", 50), bet("c", "blue", 150)];
    const estimates = calculateEstimates({ poolBalance: 300, groupBets });
    assert.equal(estimates.get("a"), 200);
    assert.equal(estimates.get("b"), 100);
    assert.equal(estimates.get("c"), 300);
  });

  it("distributes remainder by fraction then _id", () => {
    const groupBets = [bet("a", "red", 1), bet("b", "red", 1), bet("c", "red", 1), bet("d", "blue", 100)];
    const estimates = calculateEstimates({ poolBalance: 10, groupBets });
    assert.equal(estimates.get("a"), 4);
    assert.equal(estimates.get("b"), 3);
    assert.equal(estimates.get("c"), 3);
    assert.equal(estimates.get("a") + estimates.get("b") + estimates.get("c"), 10);
  });

  it("refunds stake when all bets are one-sided", () => {
    const groupBets = [bet("a", "red", 100), bet("b", "red", 40)];
    const estimates = calculateEstimates({ poolBalance: 140, groupBets });
    assert.equal(estimates.get("a"), 100);
    assert.equal(estimates.get("b"), 40);
  });

  it("returns zero for every bet when pool is zero", () => {
    const groupBets = [bet("a", "red", 100), bet("b", "blue", 100)];
    const estimates = calculateEstimates({ poolBalance: 0, groupBets });
    assert.equal(estimates.get("a"), 0);
    assert.equal(estimates.get("b"), 0);
  });

  it("returns an empty map when there are no bets", () => {
    const estimates = calculateEstimates({ poolBalance: 100, groupBets: [] });
    assert.equal(estimates.size, 0);
  });

  it("keeps every estimate an integer", () => {
    const groupBets = [bet("a", "red", 2), bet("b", "red", 1), bet("c", "blue", 3)];
    const estimates = calculateEstimates({ poolBalance: 100, groupBets });
    for (const payout of estimates.values()) {
      assert.ok(Number.isInteger(payout));
    }
  });
});
