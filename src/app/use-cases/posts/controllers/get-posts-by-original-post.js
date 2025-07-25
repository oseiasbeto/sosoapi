const Post = require("../../../models/Post");

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getPostsByOriginalPost = async (req, res) => {
  try {
    const originalPostId = req.params.id;
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const posts = await Post.find({
      original_post: originalPostId,
      is_repost: false,
      is_reply: true,
    })
      .sort({ created_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate("author", "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image") // Popula username e profile_picture
      .populate({
        path: "original_post",
        populate: {
          path: "author",
          select: "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image",
        },
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    const total = await Post.countDocuments({
      original_post: originalPostId,
      is_repost: false,
      is_reply: true,
    });
    const totalPages = Math.ceil(total / limit);

    // Formata a resposta
    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages, // Indica se há mais páginas
    });
  } catch (err) {
    console.error("Erro ao buscar postagem:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getPostsByOriginalPost;
