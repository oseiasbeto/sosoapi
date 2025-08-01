const Post = require("../../../models/Post");
const Media = require("../../../models/Media");
const User = require("../../../models/User");
const mongoose = require("mongoose");

const deletePostAndHierarchy = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!id) {
    return res.status(400).json({ message: "O ID do post é obrigatório." });
  }

  // 👇 Verifica se está em desenvolvimento
  const isProdEnv = process.env.NODE_ENV === "prod";

  try {
    // Lógica sem transação (ambiente de desenvolvimento)
    if (!isProdEnv) {
      // 1. Encontre o post e verifique permissões
      const post = await Post.findOne({ _id: id, "author._id": userId });

      if (!post) {
        return res.status(404).json({
          message: "Post não encontrado ou permissão negada.",
        });
      }

      // 2. Identifique dependências
      const [replies, mediaList] = await Promise.all([
        Post.find({ original_post: id }),
        Media.find({ post: id }),
      ]);

      // 3. Operações de deleção
      await Promise.all([
        Post.deleteMany({ _id: { $in: replies.map((r) => r._id) } }),
        Post.deleteOne({ _id: id }),
        Media.deleteMany({ _id: { $in: mediaList.map((m) => m._id) } }),
      ]);

      // 4. Atualize contadores
      await User.updateMany(
        { _id: { $in: [post.author, ...replies.map((r) => r.author)] } },
        { $inc: { posts_count: -1 } }
      );

      if (post.is_reply) {
        await Post.findByIdAndUpdate(post?.original_post, {
          $inc: {
            replies_count: -1,
          },
          $pull: {
            replies: post?._id,
          },
        });
      }

      return res.status(200).json({
        message: "[DEV] Post e dependências deletados (sem transação).",
        details: {
          postsDeleted: 1 + replies.length,
          mediaDeleted: mediaList.length,
        },
      });
    } else {
      //Lógica COM transação (produção)
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const post = await Post.findOne({ _id: id, author: userId }).session(
          session
        );
        if (!post) {
          await session.abortTransaction();
          return res.status(404).json({ message: "Post não encontrado." });
        }

        const [replies, mediaList] = await Promise.all([
          Post.find({ original_post: id }).session(session),
          Media.find({ post: id }).session(session),
        ]);

        await Promise.all([
          Post.deleteMany({ _id: { $in: replies.map((r) => r._id) } }).session(
            session
          ),
          Post.deleteOne({ _id: id }).session(session),
          Media.deleteMany({
            _id: { $in: mediaList.map((m) => m._id) },
          }).session(session),
          User.updateMany(
            { _id: { $in: [post.author, ...replies.map((r) => r.author)] } },
            { $inc: { posts_count: -1 } },
            { session }
          ),
        ]);
        
        if (post.is_reply) {
          await Post.findByIdAndUpdate(post?.original_post, {
            $inc: {
              replies_count: -1,
            },
            $pull: {
              replies: post?._id,
            },
          }).session(session);
        }

        await session.commitTransaction();
        return res.status(200).json({
          message: "[PROD] Post deletado com transação.",
          details: {
            postsDeleted: 1 + replies.length,
            mediaDeleted: mediaList.length,
          },
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }
  } catch (err) {
    console.error("Erro ao deletar post:", err);
    return res.status(500).json({
      message: "Falha ao deletar post.",
      error: err.message,
    });
  }
};

module.exports = deletePostAndHierarchy;
