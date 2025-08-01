const User = require("../../../models/User");
const Relationship = require("../../../models/Relationship");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");

const followUser = async (req, res) => {
    try {
        const { userIdToFollow, isFollowBack = false } = req.body;
        const loggedUserId = req.user.id;

        if (!userIdToFollow) {
            return res.status(400).json({ message: "O id do usuário a seguir é obrigatório." });
        }

        const userToFollow = await User.findOne({ _id: userIdToFollow }).select("username privacy_settings activity_status");
        if (!userToFollow) {
            return res.status(404).json({ message: "Usuário a seguir não encontrado." });
        }

        if (userToFollow._id.toString() === loggedUserId.toString()) {
            return res.status(400).json({ message: "Você não pode seguir a si mesmo." });
        }

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
            await User.updateOne({ _id: loggedUserId }, { $pull: { following: userToFollow._id } });
            await User.updateOne({ _id: userToFollow._id }, { $pull: { followers: loggedUserId } });

            return res.status(200).json({
                message: "Você deixou de seguir o usuário com sucesso.",
                isFollowing: false,
                isFollowedBy: !!isFollowedBy,
            });
        } else {
            // Follow
            if (isFollowBack && !isFollowedBy) {
                return res.status(400).json({
                    message: "Você não pode seguir de volta porque este usuário não te segue.",
                    isFollowing: false,
                    isFollowedBy: false,
                });
            }

            const status = userToFollow.privacy_settings.profile_visibility === "private" ? "pending" : "active";

            const newRelationship = new Relationship({
                follower: loggedUserId,
                following: userToFollow._id,
                status,
            });
            await newRelationship.save();

            if (status === "active") {
                await User.updateOne({ _id: loggedUserId }, { $addToSet: { following: userToFollow._id } });
                await User.updateOne({ _id: userToFollow._id }, { $addToSet: { followers: loggedUserId } });
            }

            const notificationType = status === "pending" ? "follow_request" : "follow";
            const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

            let existingNotification = await Notification.findOne({
                recipient: userToFollow._id,
                type: notificationType,
                created_at: { $gte: timeThreshold },
            }).populate({
                path: 'target',
                select: 'content text author post follower following status created_at',
                populate: {
                    path: 'follower following',
                    select: 'username profile_image name'
                }
            });

            const io = getIO();

            if (existingNotification) {
                let updatedSenders = [...existingNotification.senders];
                let isNewSender = false;
                if (!updatedSenders.find(sender => sender._id.toString() === loggedUserId.toString())) {
                    updatedSenders.push(loggedUserId);
                    isNewSender = true;
                }

                const senderNames = await User.find(
                    { _id: { $in: updatedSenders.slice(0, 2) } },
                    "name"
                ).lean();

                // Concatena até dois nomes com <b></b>
                const names = senderNames.map(user => `<b>${user.name}</b>`).join(", ");
                const totalSenders = updatedSenders.length;

                // Define a mensagem com base no número de remetentes
                let message = totalSenders === 1
                    ? `${names} ${notificationType === "follow" ? "começou a seguir você" : "solicitou seguir você"}.`
                    : totalSenders === 2
                    ? `${names} ${notificationType === "follow" ? "começaram a seguir você" : "solicitaram seguir você"}.`
                    : `${names} e mais ${totalSenders - 2} pessoa${totalSenders - 2 > 1 ? "s" : ""} ${notificationType === "follow" ? "começaram a seguir você" : "solicitaram seguir você"}.`;

                if (isFollowBack && existingNotification.senders.length === 1) {
                    message = `<b>${req.user.name}</b> seguiu você de volta.`;
                }

                // Atualiza a notificação com a nova mensagem
                await existingNotification.updateOne({
                    $set: { message }
                });

                // Adiciona o novo remetente, se necessário
                if (isNewSender) {
                    await existingNotification.updateOne({
                        $push: { senders: loggedUserId }
                    });
                }

                // Busca detalhes dos remetentes para o socket
                const senderDetails = await User.find(
                    { _id: { $in: updatedSenders } },
                    "username profile_image name"
                ).lean();

                // Envia notificação em tempo real apenas se houver mudança relevante
                if (userToFollow.activity_status.is_active && userToFollow.activity_status.socket_id) {
                    console.log('Emitindo newNotification para socket:', userToFollow.activity_status.socket_id);
                    io.to(userToFollow.activity_status.socket_id).emit('newNotification', {
                        id: existingNotification._id,
                        type: notificationType,
                        message: message,
                        created_at: existingNotification.created_at,
                        target: {
                            follower: newRelationship.follower,
                            following: newRelationship.following,
                            status: newRelationship.status
                        },
                        target_model: "Relationship",
                        senders: senderDetails.map(sender => ({
                            id: sender._id,
                            username: sender.username,
                            profile_image: sender.profile_image || null,
                            name: sender.name
                        }))
                    });
                }
            } else {
                const message = isFollowBack
                    ? `<b>${req.user.name}</b> seguiu você de volta.`
                    : `<b>${req.user.name}</b> ${notificationType === "follow" ? "começou a seguir você" : "solicitou seguir você"}.`;

                const notification = new Notification({
                    recipient: userToFollow._id,
                    senders: [loggedUserId],
                    type: notificationType,
                    target: newRelationship._id,
                    target_model: "Relationship",
                    message,
                });
                await notification.save();

                // Busca detalhes do remetente
                const senderDetails = await User.find(
                    { _id: { $in: [loggedUserId] } },
                    "username profile_image name"
                ).lean();

                // Envia notificação em tempo real
                if (userToFollow.activity_status.is_active && userToFollow.activity_status.socket_id) {
                    console.log('Emitindo newNotification para socket:', userToFollow.activity_status.socket_id);
                    io.to(userToFollow.activity_status.socket_id).emit('newNotification', {
                        id: notification._id,
                        type: notificationType,
                        message: message,
                        created_at: notification.created_at,
                        target: {
                            follower: loggedUserId,
                            following: userToFollow._id,
                            status
                        },
                        target_model: "Relationship",
                        senders: senderDetails.map(sender => ({
                            id: sender._id,
                            username: sender.username,
                            profile_image: sender.profile_image || null,
                            name: sender.name
                        }))
                    });
                }
            }

            return res.status(200).json({
                message: isFollowBack
                    ? "Você seguiu o usuário de volta com sucesso."
                    : `Você ${status === "pending" ? "solicitou seguir" : "começou a seguir"} o usuário com sucesso.`,
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