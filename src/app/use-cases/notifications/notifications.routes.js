const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const getAllNotifications = require("./controllers/get-all-notifications")
const getFollowNotifications = require("./controllers/get-follow-notifications")
const getReplyNotifications = require("./controllers/get-reply-notifications")
const getRepostNotifications = require("./controllers/get-repost-notifications")

// configurando as rotas
router.get("/all", protectedRoute, getAllNotifications)
router.get("/follow", protectedRoute, getFollowNotifications)
router.get("/reply", protectedRoute, getReplyNotifications)
router.get("/repost", protectedRoute, getRepostNotifications)

// exportando as rotas
module.exports = router