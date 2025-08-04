// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

// Importa a função para transformar os dados do usuário antes de enviá-los para o frontend
const userTransformer = require("../../../utils/user-transformer");

// Controller para listar usuários sugestivos com resultados aleatórios
const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário atual (obtido via query, pode vir de um token JWT)
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 5; // Limite por página (padrão: 5)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular

    // Verifica se o userId foi enviado
    if (!userId) {
      return res
        .status(400)
        .json({ message: "O ID do usuário é obrigatório." });
    }

    // Busca o usuário atual para obter informações sobre quem ele segue, bloqueia e seus interesses
    const currentUser = await User.findById(userId).select(
      "following blocked_users interests"
    );
    if (!currentUser) {
      return res.status(404).json({ message: "Usuário atual não encontrado." });
    }

    // Define os critérios para usuários sugestivos
    const matchCriteria = {
      _id: { $ne: userId }, // Exclui o próprio usuário
      _id: { $nin: currentUser.following }, // Exclui usuários que o usuário atual já segue
      _id: { $nin: currentUser.blocked_users }, // Exclui usuários bloqueados
      $or: [
        { verified: true }, // Usuários verificados
        { followers_count: { $gte: 100 } }, // Usuários com 100 ou mais seguidores
        { interests: { $in: currentUser.interests } }, // Usuários com interesses em comum
      ],
    };

    // Busca usuários sugestivos com randomização usando $sample
    const users = await User.aggregate([
      { $match: matchCriteria }, // Aplica os filtros
      { $sample: { size: limit } }, // Seleciona aleatoriamente o número de documentos especificado
      {
        $project: {
          username: 1,
          name: 1,
          verified: 1,
          subscribers: 1,
          website: 1,
          activity_status: 1,
          posts_count: 1,
          cover_photo: 1,
          followers: 1,
          following: 1,
          followers_count: 1,
          following_count: 1,
          bio: 1,
          profile_image: 1,
        },
      },
    ])
      .skip(skip)
      .limit(limit);


    // Conta o total de usuários que atendem aos critérios
    const total = await User.countDocuments(matchCriteria);
    const totalPages = Math.ceil(total / limit);

    // Formata a resposta
    res.status(200).json({
      users: users || [],
      page,
      totalPages,
      total,
      hasMore: page < totalPages, // Indica se há mais páginas
    });
  } catch (err) {
    // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
    console.error("Erro ao buscar usuários sugestivos:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = getSuggestedUsers;
