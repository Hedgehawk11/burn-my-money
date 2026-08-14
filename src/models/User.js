const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ["superuser", "admin", "gambler"],
      default: "gambler",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ username: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
