const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route");

const getUserByUsername = require("./controllers/get-user-by-username");
const getUserById = require("./controllers/get-user-by-id");
const followUser = require("./controllers/follow-user");
const getUsersByQuery = require("./controllers/get-users-by-query");
const updateUserProfile = require("./controllers/update-user-profile");
const checkUsernameExists = require("./controllers/check-username-exists");
const getSuggestedUsers = require("./controllers/get-suggested-users");

// configurando as rotas
router.get("/search-users", protectedRoute, getUsersByQuery);

router.get("/:id", protectedRoute, getUserById);

router.post("/follow-user", protectedRoute, followUser);

router.put("/update-user-profile", protectedRoute, updateUserProfile);

router.get("/", protectedRoute, getSuggestedUsers);

router.get("/profile/:username", protectedRoute, getUserByUsername);

router.get("/check-username/:username", checkUsernameExists);

// exportando as rotas
module.exports = router;
