const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")
//const validObjectId = require("../../middlewares/validObjectId")

// importando os controllers
const authUser = require("./controllers/auth-user")
const refreshAccessToken = require("./controllers/refresh-access-token")
const registerUser = require("./controllers/register-user")
const verifyEmail = require("./controllers/verify-email")
const destroySession = require("./controllers/destroy-session")

// configurando as rotas
router.post("/register-user", registerUser)
router.post("/verify-email", verifyEmail)
router.post("/auth-user", authUser)
router.post("/refresh-access-token", refreshAccessToken)
router.delete("/destroy-session/:id", destroySession)

// exportando as rotas
module.exports = router