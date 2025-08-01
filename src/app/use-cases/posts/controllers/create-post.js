const Post = require("../../../models/Post.js");
const Media = require("../../../models/Media.js");
const User = require("../../../models/User.js");

const createPost = async (req, res) => {
  try {
    const { content = "", media = [] } = req.body;
    const userId = req.user.id; // ID do usuário autenticado
    const isReply = req.body.isReply || false;
    const originalPost = req.body.originalPost || null;

    // Validação manual
    if (!content.trim() && media.length === 0) {
      return res.status(400).json({
        success: false,
        error: "O post deve conter texto ou mídia",
      });
    }

    if (content.length > 280) {
      return res.status(400).json({
        success: false,
        error: "O post não pode ter mais de 280 caracteres",
      });
    }

    if (media.length > 4) {
      return res.status(400).json({
        success: false,
        error: "Você pode adicionar no máximo 4 mídias",
      });
    }

    // Verificar se o post original existe (para replies)
    if (isReply && originalPost) {
      const originalPostExists = await Post.findById(originalPost);
      if (!originalPostExists) {
        return res.status(404).json({
          success: false,
          error: "Post original não encontrado",
        });
      }
    }

    const mediaDocs = [];
    for (const mediaItem of media) {
      // Verificar se é um objeto válido
      if (!mediaItem.public_id || !mediaItem.url || !mediaItem.type) {
        return res.status(400).json({
          success: false,
          error: "Dados de mídia inválidos",
        });
      }

      // Para vídeos, exigir duração
      if (mediaItem.type === "video" && !mediaItem.duration) {
        return res.status(400).json({
          success: false,
          error: "Vídeos devem incluir a duração",
        });
      }

      const mediaDoc = await Media.findOneAndUpdate(
        { public_id: mediaItem.public_id },
        {
          $setOnInsert: {
            // Só cria se não existir
            public_id: mediaItem.public_id,
            url: mediaItem.url,
            type: mediaItem.type,
            format: mediaItem.format,
            thumbnail: mediaItem.thumbnail,
            width: mediaItem.width,
            height: mediaItem.height,
            duration: mediaItem.duration,
            uploaded_by: userId,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      mediaDocs.push(mediaDoc._id);
    }

    // Criar o post
    const newPost = await Post.create({
      content,
      author: userId,
      media: mediaDocs,
      is_reply: isReply,
      original_post: originalPost ?? undefined,
    });

    if (newPost) {
      // Atualizar as mídias com a referência ao post
      await Media.updateMany(
        { _id: { $in: mediaDocs } },
        { $set: { post: newPost._id } }
      );

      // Se for reply, atualizar o post original
      if (isReply && originalPost) {
        await Post.findByIdAndUpdate(originalPost, {
          $push: { replies: newPost._id },
          $inc: { replies_count: 1 }
        });
      }

      if (!isReply) {
        await User.findOne(
          {
            _id: newPost.author,
          },
          {
            $inc: {
              posts_count: 1,
            },
          }
        );
      }

      // Popular os dados para retornar
      const populatedPost = await Post.findById(newPost._id)
        .populate(
          "author",
          "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image"
        )
        .populate({
          path: "original_post",
          populate: [
            {
              path: "author",
              select:
                "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image",
            },
            {
              path: "original_post",
              populate: {
                path: "author",
                select:
                  "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image",
              },
            },
          ],
        })
        .populate({
          path: "media",
          select: "url type thumbnail format width height duration",
        })
        .lean();
      // Retornar resposta
      res.status(201).json({
        new_post: populatedPost,
        message: "Post criado com sucesso.",
      });
    }
  } catch (error) {
    console.error("Erro ao criar post:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

module.exports = createPost;
