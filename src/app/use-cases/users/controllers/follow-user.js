const User = require("../../../models/User");
const Relationship = require("../../../models/Relationship");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");

const followUser = async (req, res) => {
  try {
    const { userIdToFollow } = req.body;
    const loggedUserId = req.user.id;

    if (!userIdToFollow) {
      return res
        .status(400)
        .json({ message: "O id do usuário a seguir é obrigatório." });
    }

    const userToFollow = await User.findOne({ _id: userIdToFollow }).select(
      "username privacy_settings activity_status followers followers_count"
    );
    if (!userToFollow) {
      return res
        .status(404)
        .json({ message: "Usuário a seguir não encontrado." });
    }

    if (userToFollow._id.toString() === loggedUserId.toString()) {
      return res
        .status(400)
        .json({ message: "Você não pode seguir a si mesmo." });
    }

    const user = await User.findOne({ _id: loggedUserId }).select("followers");
    if (!user) {
      return res
        .status(400)
        .json({ message: "Houve um erro, tente novamente!" });
    }

    // Verifica se o usuário a seguir já segue o usuário logado
    const isFollowBack = user.followers.includes(userToFollow._id.toString());

    const existingRelationship = await Relationship.findOne({
      follower: loggedUserId,
      following: userToFollow._id,
    });

    const isFollowedBy = await Relationship.findOne({
      follower: userToFollow._id,
      following: loggedUserId,
    });

    if (existingRelationship) {
      // Unfollow
      await Relationship.deleteOne({ _id: existingRelationship._id });
      await User.updateOne(
        { _id: loggedUserId },
        {
          $pull: { following: userToFollow._id },
          $inc: { following_count: -1 },
        }
      );
      await User.updateOne(
        { _id: userToFollow._id },
        { $pull: { followers: loggedUserId }, $inc: { followers_count: -1 } }
      );

      return res.status(200).json({
        message: "Você deixou de seguir o usuário com sucesso.",
        isFollowing: false,
        isFollowedBy: !!isFollowedBy,
      });
    } else {
      // Follow
      const status = "active";

      const newRelationship = new Relationship({
        follower: loggedUserId,
        following: userToFollow._id,
        status,
      });
      await newRelationship.save();

      await User.updateOne(
        { _id: loggedUserId },
        {
          $addToSet: { following: userToFollow._id },
          $inc: { following_count: 1 },
        }
      );
      await User.updateOne(
        { _id: userToFollow._id },
        { $addToSet: { followers: loggedUserId }, $inc: { followers_count: 1 } }
      );

      const notificationType = "follow";
      const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Busca notificação existente
      let existingNotification = null;
      if (!isFollowBack) {
        // Para "seguir", verifica notificações agrupadas
        existingNotification = await Notification.findOne({
          recipient: userToFollow._id,
          type: notificationType,
          senders: loggedUserId, // Verifica se o remetente já está na notificação
          created_at: { $gte: timeThreshold },
        }).populate({
          path: "target",
          select: "content text author post follower following status created_at",
          populate: {
            path: "follower following",
            select: "username profile_image name",
          },
        });
      } else {
        // Para "seguir de volta", verifica se já existe uma notificação para o mesmo remetente
        existingNotification = await Notification.findOne({
          recipient: userToFollow._id,
          type: notificationType,
          senders: loggedUserId,
          message: "seguiu você de volta.",
          created_at: { $gte: timeThreshold },
        });
      }

      const io = getIO();

      if (existingNotification) {
        // Se já existe uma notificação com o mesmo remetente, não faz nada
        console.log(
          `Notificação já existe para o remetente ${loggedUserId}, ação ignorada.`
        );
      } else {
        if (!isFollowBack) {
          // Lógica de agrupamento para notificações de "seguir"
          existingNotification = await Notification.findOne({
            recipient: userToFollow._id,
            type: notificationType,
            created_at: { $gte: timeThreshold },
          }).populate({
            path: "target",
            select: "content text author post follower following status created_at",
            populate: {
              path: "follower following",
              select: "username profile_image name",
            },
          });

          if (existingNotification) {
            let updatedSenders = [...existingNotification.senders];
            let isNewSender = !updatedSenders.find(
              (sender) => sender._id.toString() === loggedUserId.toString()
            );

            if (isNewSender) {
              updatedSenders.push(loggedUserId);

              const totalSenders = updatedSenders.length;
              let message =
                totalSenders === 1
                  ? "começou a seguir você."
                  : "começaram a seguir você.";

              // Atualiza a notificação existente
              await existingNotification.updateOne({
                $set: { message, read: false },
                $push: { senders: loggedUserId },
              });

              // Busca detalhes dos remetentes
              const senderDetails = await User.find(
                { _id: { $in: updatedSenders } },
                "username name profile_image verified"
              ).lean();

              // Incrementa contador de notificações não lidas
              await userToFollow.updateOne({
                $inc: { unread_notifications_count: 1 },
              });

              // Emite notificação em tempo real
              if (
                userToFollow.activity_status.is_active &&
                userToFollow.activity_status.socket_id
              ) {
                console.log(
                  "Emitindo newNotification para socket:",
                  userToFollow.activity_status.socket_id
                );
                io.to(userToFollow.activity_status.socket_id).emit(
                  "newNotification",
                  {
                    _id: existingNotification._id,
                    type: notificationType,
                    message,
                    created_at: existingNotification.created_at,
                    updated_at: Date.now(),
                    target: {
                      follower: newRelationship.follower,
                      following: newRelationship.following,
                      status: newRelationship.status,
                    },
                    target_model: "Relationship",
                    senders: senderDetails,
                  }
                );
              }
            }
          } else {
            // Cria nova notificação para "seguir" se não houver notificação agrupada
            const message = "começou a seguir você.";
            const notification = new Notification({
              recipient: userToFollow._id,
              senders: [loggedUserId],
              type: notificationType,
              target: newRelationship._id,
              target_model: "Relationship",
              message,
              read: false,
            });
            await notification.save();

            // Busca detalhes do remetente
            const senderDetails = await User.find(
              { _id: { $in: [loggedUserId] } },
              "username name profile_image verified"
            ).lean();

            // Incrementa contador de notificações não lidas
            await userToFollow.updateOne({
              $inc: { unread_notifications_count: 1 },
            });

            // Emite notificação em tempo real
            if (
              userToFollow.activity_status.is_active &&
              userToFollow.activity_status.socket_id
            ) {
              console.log(
                "Emitindo newNotification para socket:",
                userToFollow.activity_status.socket_id
              );
              io.to(userToFollow.activity_status.socket_id).emit(
                "newNotification",
                {
                  _id: notification._id,
                  type: notificationType,
                  message,
                  created_at: notification.created_at,
                  updated_at: Date.now(),
                  target: {
                    follower: loggedUserId,
                    following: userToFollow._id,
                    status,
                  },
                  target_model: "Relationship",
                  senders: senderDetails,
                }
              );
            }
          }
        } else {
          // Cria nova notificação para "seguir de volta"
          const message = "seguiu você de volta.";
          const notification = new Notification({
            recipient: userToFollow._id,
            senders: [loggedUserId],
            type: notificationType,
            target: newRelationship._id,
            target_model: "Relationship",
            message,
            read: false,
          });
          await notification.save();

          // Busca detalhes do remetente
          const senderDetails = await User.find(
            { _id: { $in: [loggedUserId] } },
            "username name profile_image verified"
          ).lean();

          // Incrementa contador de notificações não lidas
          await userToFollow.updateOne({
            $inc: { unread_notifications_count: 1 },
          });

          // Emite notificação em tempo real
          if (
            userToFollow.activity_status.is_active &&
            userToFollow.activity_status.socket_id
          ) {
            console.log(
              "Emitindo newNotification para socket:",
              userToFollow.activity_status.socket_id
            );
            io.to(userToFollow.activity_status.socket_id).emit(
              "newNotification",
              {
                _id: notification._id,
                type: notificationType,
                message,
                created_at: notification.created_at,
                updated_at: Date.now(),
                target: {
                  follower: loggedUserId,
                  following: userToFollow._id,
                  status,
                },
                target_model: "Relationship",
                senders: senderDetails,
              }
            );
          }
        }
      }

      return res.status(200).json({
        message: isFollowBack
          ? "Você seguiu o usuário de volta com sucesso."
          : "Você começou a seguir o usuário com sucesso.",
        isFollowing: status === "active",
        isFollowedBy: !!isFollowedBy,
        relationship: {
          follower: loggedUserId,
          following: userToFollow._id,
          status,
        },
      });
    }
  } catch (err) {
    console.error("Erro ao processar ação de seguir/deixar de seguir:", err);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = followUser;