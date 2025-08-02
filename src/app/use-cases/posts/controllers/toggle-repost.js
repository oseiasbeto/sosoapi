const Post = require("../../../models/Post");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const mongoose = require("mongoose");
const { getIO } = require("../../../services/socket");

const toggleRepost = async (req, res) => {
  try {
    const postId = req.params.id; // ID do post a ser repostado
    const userId = req.user.id; // ID do usuário autenticado (vindo do middleware de autenticação)

    // Validar se o postId é válido
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: "ID do post inválido" });
    }

    // Buscar o post original
    const originalPost = await Post.findById(postId).populate(
      "author",
      "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image"
    );

    if (!originalPost) {
      return res.status(404).json({ error: "Post não encontrado" });
    }

    // Verificar se o autor do post existe
    const author = await User.findById(originalPost.author).select(
      "username activity_status unread_notifications_count"
    );
    if (!author) {
      return res
        .status(400)
        .json({ error: "O autor do post não foi encontrado" });
    }

    // Verificar se o usuário está tentando repostar seu próprio post
    if (originalPost.author.toString() === userId.toString()) {
      return res
        .status(400)
        .json({ error: "Você não pode repostar seu próprio post" });
    }

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
        $pull: { reposts: user._id },
        $inc: { reposts_count: -1 },
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
        $push: { reposts: user._id },
        $inc: { reposts_count: 1 },
      });

      if (originalPost.author?._id.toString() !== user?._id.toString()) {
        // Lógica de notificação para o repost
        const notificationType = "repost";
        const timeThreshold = new Date(Date.now() - 60 * 60 * 1000);

        // Verifica se já existe uma notificação do mesmo usuário para o mesmo post
        let existingNotification = await Notification.findOne({
          recipient: originalPost.author._id,
          type: notificationType,
          senders: userId,
          target: originalPost._id,
          created_at: { $gte: timeThreshold },
        });

        const io = getIO();

        if (existingNotification) {
          // Se já existe uma notificação do mesmo remetente, ignora
          console.log(
            `Notificação de repost já existe para o remetente ${userId}, ação ignorada.`
          );
        } else {
          // Verifica se existe uma notificação agrupada para o mesmo post
          existingNotification = await Notification.findOne({
            recipient: originalPost.author._id,
            type: notificationType,
            target: originalPost._id,
            created_at: { $gte: timeThreshold },
          }).populate({
            path: "target",
            select: "content text author created_at",
            populate: {
              path: "author",
              select: "username profile_image name",
            },
          });

          if (existingNotification) {
            // Agrupa notificações de reposts para o mesmo post
            let updatedSenders = [...existingNotification.senders];
            let isNewSender = !updatedSenders.find(
              (sender) => sender._id.toString() === userId.toString()
            );

            if (isNewSender) {
              updatedSenders.push(userId);

              const totalSenders = updatedSenders.length;
              let message =
                totalSenders === 1
                  ? "repostou seu post."
                  : "repostaram seu post.";

              // Atualiza a notificação existente
              await existingNotification.updateOne({
                $set: { message, read: false },
                $push: { senders: userId },
              });

              // Busca detalhes dos remetentes
              const senderDetails = await User.find(
                { _id: { $in: updatedSenders } },
                "username name profile_image verified"
              ).lean();

              // Incrementa contador de notificações não lidas
              await author.updateOne({
                $inc: { unread_notifications_count: 1 },
              });

              // Emite notificação em tempo real
              if (
                author.activity_status.is_active &&
                author.activity_status.socket_id
              ) {
                console.log(
                  "Emitindo newNotification para socket:",
                  author.activity_status.socket_id
                );
                io.to(author.activity_status.socket_id).emit(
                  "newNotification",
                  {
                    _id: existingNotification._id,
                    type: notificationType,
                    message,
                    created_at: existingNotification.created_at,
                    updated_at: Date.now(),
                    target: originalPost,
                    target_model: "Post",
                    senders: senderDetails,
                  }
                );
              }
            }
          } else {
            // Cria uma nova notificação para o repost
            const message = "repostou seu post.";
            const notification = new Notification({
              recipient: originalPost.author._id,
              senders: [userId],
              type: notificationType,
              target: originalPost._id,
              target_model: "Post",
              message,
              read: false,
            });
            await notification.save();

            // Busca detalhes do remetente
            const senderDetails = await User.find(
              { _id: { $in: [userId] } },
              "username name profile_image verified"
            ).lean();

            // Incrementa contador de notificações não lidas
            await author.updateOne({
              $inc: { unread_notifications_count: 1 },
            });

            // Emite notificação em tempo real
            if (
              author.activity_status.is_active &&
              author.activity_status.socket_id
            ) {
              console.log(
                "Emitindo newNotification para socket:",
                author.activity_status.socket_id
              );
              io.to(author.activity_status.socket_id).emit("newNotification", {
                _id: notification._id,
                type: notificationType,
                message,
                created_at: notification.created_at,
                updated_at: Date.now(),
                target: originalPost,
                target_model: "Post",
                senders: senderDetails,
              });
            }
          }
        }
      }

      return res.status(201).json({
        message: "Post repostado com sucesso",
        repost: repost._id,
      });
    }
  } catch (err) {
    console.error("Erro ao repostar:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

module.exports = toggleRepost;
