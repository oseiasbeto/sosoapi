// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

// Importa a função para transformar os dados do usuário antes de enviá-los para o frontend
const userTransformer = require("../../../utils/user-transformer");

// Define a função assíncrona para verificar o e-mail do usuário
const getUserByUsername = async (req, res) => {
    try {
        const { username } = req.params;

        // Verifica se o token foi enviado na requisição
        if (!username) {
            return res.status(400).json({ message: "O nome de utilizador e obrigatorio." });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: "Usuario nao encontrado" });
        } else {
            return res.status(200).json({
                user: userTransformer(user), 
                message: "Usuario encontrado com sucesso."
            });
        }
    } catch (err) {
        // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
        console.error("Erro ao verificar e-mail:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
}

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = getUserByUsername;
