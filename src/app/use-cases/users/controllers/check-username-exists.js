const User = require('../../../models/User'); // Supondo que o modelo de User está em ../models/User

const checkUsernameExists = async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            return res.status(400).json({ message: "O nome de usuário é obrigatório." });
        }

        const user = await User.findOne({ username });
        if (user) {
            return res.status(409).json({ message: "Este nome de usuário já está em uso." });
        }

        return res.status(200).json({ message: "Nome de usuário disponível." });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao verificar nome de usuário.", error: error.message });
    }
};

module.exports = checkUsernameExists;
