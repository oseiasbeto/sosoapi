const User = require('../../../models/User'); // Supondo que o modelo de User está em ../models/User
const userTransformer = require("../../../utils/user-transformer");

const updateUserProfile = async (req, res) => {
    try {
        const { id } = req.user;

        const {
            name,
            username,
            profile_image,
            bio,
            website,
            location,
            gender,
            birth_date
        } = req.body
        if (!id) {
            return res.status(401).json({ message: "Algo deu errado, inicie a sessao e tente novamente!" });
        }

        const user = await User.findOne({ _id: id });
        if (!user) {
            return res.status(401).json({ message: "Algo deu errado, inicie a sessao e tente novamente!" });
        } else {
            const newProfile = await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        name,
                        username,
                        profile_image,
                        bio,
                        location,
                        website,
                        gender,
                        birth_date
                    }
                },
                {
                    new: true,
                    upsert: true,
                }
            )
            
            res.status(200).send({
                new_profile: userTransformer(newProfile),
                message: "Alteracoes salvas com sucesso"
            })
        }

    } catch (error) {
        return res.status(500).json({ message: "Erro ao verificar nome de usuário.", error: error.message });
    }
};

module.exports = updateUserProfile;
