const mongoose = require("mongoose");

const matchResultSchema = new mongoose.Schema(
  {
    matchId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    winningAlliance: {
      type: String,
      required: true,
      enum: ["red", "blue"],
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

matchResultSchema.index({ matchId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model("MatchResult", matchResultSchema);
