const Notification = require('../../../models/Notification');

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id; // ID do usuário logado
        const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
        const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
        const skip = (page - 1) * limit; // Quantidade de documentos a pular

        // Busca notificações com paginação, ordenadas por created_at (descendente)
        const notifications = await Notification.find({ recipient: userId })
            .sort({ created_at: -1 }) // Mais recentes primeiro
            .skip(skip)
            .limit(limit)
            .populate('senders', 'username profile_image') // Popula username e profile_picture
            .populate({
                path: 'target',
                select: 'content text author post follower followed status created_at',
                populate: {
                    path: 'follower following', // Popula follower e followed dentro de Relationship
                    select: 'username profile_image'
                }
            })
            .lean(); // Converte para objeto JavaScript puro

        // Conta o total de notificações para calcular totalPages
        const total = await Notification.countDocuments({ recipient: userId });
        const totalPages = Math.ceil(total / limit);

        // Formata a resposta
        res.status(200).json({
            notifications,
            page,
            totalPages,
            total,
            hasMore: page < totalPages // Indica se há mais páginas
        });
    } catch (err) {
        console.error('Erro ao buscar notificações:', err);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

module.exports = getNotifications;