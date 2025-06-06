const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createPost = require("./controllers/create-post")
const getPostsFeed = require("./controllers/get-posts-feed")
const getPostsByOriginalPost = require("./controllers/get-posts-by-original-post")
const getPostById = require("./controllers/get-post-by-id")
const toggleLikePost = require("./controllers/toggle-like-post")
const toggleRepost = require("./controllers/toggle-repost")

// configurando as rotas
router.post("/", protectedRoute, createPost)
router.get("/feed", protectedRoute, getPostsFeed)
router.get("/replies/:id", protectedRoute, getPostsByOriginalPost)
router.get("/:id", protectedRoute, getPostById)
router.put("/like/:id", protectedRoute, toggleLikePost)
router.put("/repost/:id", protectedRoute, toggleRepost)

// exportando as rotas
module.exports = router