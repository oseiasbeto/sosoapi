const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createPost = require("./controllers/create-post")
const getFeedPosts = require("./controllers/get-feed-posts")
const getPostsByOriginalPost = require("./controllers/get-posts-by-original-post")
const getPostById = require("./controllers/get-post-by-id")
const getPostsByUserId = require("./controllers/get-posts-by-user-id")
const getRepostedPostsByUserId = require("./controllers/get-reposted-posts-by-user-id")
const getPostsWithMediaByUserId = require("./controllers/get-posts-with-media-by-user-id")
const getFollowingPosts = require("./controllers/get-following-posts")
const getLikedPostsByUserId = require("./controllers/get-liked-posts-by-user-id")
const toggleLikePost = require("./controllers/toggle-like-post")
const searchPosts = require("./controllers/search-posts")
const toggleRepost = require("./controllers/toggle-repost")
const deletePostAndHierarchy = require("./controllers/delete-post-and-hierarchy")

// configurando as rotas
router.post("/new-post", protectedRoute, createPost)
router.get("/feed", protectedRoute, getFeedPosts)
router.get("/following", protectedRoute, getFollowingPosts)
router.get("/profile/feed/:id", protectedRoute, getPostsByUserId)
router.get("/profile/reposted/:id", protectedRoute, getRepostedPostsByUserId)
router.get("/profile/media/:id", protectedRoute, getPostsWithMediaByUserId)
router.get("/search", protectedRoute, searchPosts)
router.get("/profile/liked/:id", protectedRoute, getLikedPostsByUserId)
router.get("/replies/:id", protectedRoute, getPostsByOriginalPost)
router.get("/:id", protectedRoute, getPostById)
router.put("/like/:id", protectedRoute, toggleLikePost)
router.put("/repost/:id", protectedRoute, toggleRepost)
router.delete("/:id", protectedRoute, deletePostAndHierarchy)

// exportando as rotas
module.exports = router