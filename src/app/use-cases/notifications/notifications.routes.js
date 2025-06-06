const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const getNotifications = require("./controllers/get-notifications")

// configurando as rotas
router.get("/", protectedRoute, getNotifications)

// exportando as rotas
module.exports = router