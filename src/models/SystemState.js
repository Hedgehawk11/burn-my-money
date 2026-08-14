const mongoose = require("mongoose");

const systemStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    poolBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

systemStateSchema.index({ key: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model("SystemState", systemStateSchema);
