// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const Post = require("../../../models/Post");
const User = require("../../../models/User");
const mongoose = require("mongoose");

const toggleRepost = async (req, res) => {
  try {
    const postId = req.params.id; // ID do post a ser repostado
    const userId = req.user.id; // ID do usuário autenticado (vindo do middleware de autenticação)

    // Validar se o postId é válido
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: "ID do post inválido" });
    }

    // Buscar o post original
    const originalPost = await Post.findById(postId);

    if (!originalPost) {
      return res.status(404).json({ error: "Post não encontrado" });
    } else {
      // Verificar se o usuário já repostou este post
      const user = await User.findById(userId);

      if (originalPost.reposts.includes(user._id)) {
        // Buscar o repost do usuário
        const repost = await Post.findOne({
          author: user._id,
          original_post: originalPost._id,
          is_repost: true,
        });

        if (!repost) {
          return res.status(400).json({ error: "Repost não encontrado" });
        }

        // Remover o repost
        await repost.remove();

        await originalPost.updateOne({
          $pull: {
            reposts: user._id,
          },
        });

        return res.status(200).json({ message: "Repost desfeito com sucesso" });
      } else {
        // Criar um novo post de repost
        const repost = new Post({
          content: "", // repost não tem conteúdo próprio
          author: userId,
          is_repost: true,
          is_reply: originalPost.is_reply,
          original_post: originalPost._id,
        });

        // Salvar o repost
        await repost.save();
        await originalPost.updateOne({
          $push: {
            reposts: user._id,
          },
        });

        return res.status(201).json({
          message: "Post repostado com sucesso",
          repost: repost._id,
        });
      }
    }
  } catch (err) {
    // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
    console.error("Erro ao repostar:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = toggleRepost;
