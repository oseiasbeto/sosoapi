// models/Relationship.js
const mongoose = require("mongoose");

const relationshipSchema = new mongoose.Schema(
    {
        follower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "O seguidor é obrigatório."],
        },
        following: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "O usuário seguido é obrigatório."],
        },
        status: {
            type: String,
            enum: ["active", "pending", "blocked"],
            default: "active",
        },
        created_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Índice composto para melhorar buscas por relações específicas
relationshipSchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model("Relationship", relationshipSchema);