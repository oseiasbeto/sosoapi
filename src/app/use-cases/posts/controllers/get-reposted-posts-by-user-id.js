const Post = require("../../../models/Post");

const getRepostedPostsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalItems = parseInt(req.query.total) || 0;
    const isLoad = req?.query?.is_load === "true" || false;

    const posts = await Post.find({
      author: userId,
      is_repost: true, // Filtra apenas reposts
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "author",
        "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image"
      )
      .populate({
        path: "original_post",
        populate: {
          path: "author",
          select:
            "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image",
        },
      })
      .lean();

    let total;

    if (!isLoad) {
      total = await Post.countDocuments({
        author: userId,
        is_repost: true, // Filtra apenas reposts
      });
    } else {
      total = totalItems;
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar reposts:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getRepostedPostsByUserId;
