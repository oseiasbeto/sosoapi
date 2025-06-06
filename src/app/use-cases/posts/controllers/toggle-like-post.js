// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const Post = require("../../../models/Post");
const User = require("../../../models/User");

const toggleLikePost = async (req, res) => {
    try {
        const postId = req.params.id; // Recupera o ID do post a partir dos parâmetros da URL
        const userId = req.user.id; // Recupera o ID do usuário da sessão autenticada (req.user)

        // Verifica se o usuário atual existe no banco de dados
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Usuário não encontrado' }); // Se o usuário não for encontrado, retorna erro 400
        }

        // Encontra o post pelo ID
        const post = await Post.findById(postId);

        // Se o post não for encontrado, retorna erro 400
        if (!post) {
            return res.status(400).json({ message: 'Post não encontrado' });
        }

        // Verifica se o autor do post existe no banco de dados
        const author = await User.findOne({
            _id: post.author
        });

        // Se o autor não for encontrado, retorna erro 400
        if (!author) {
            return res.status(400).send({ message: "O autor do post não foi encontrado" });
        }

        // Verifica se o usuário já curtiu o post, se sim, remove o like (deslike)
        if (post.likes.includes(userId)) {
            post.likes = post.likes.filter(like => like.toString() !== userId); // Remove o ID do usuário da lista de likes
            await post.save(); // Salva a alteração no banco

            // Retorna uma resposta informando que o like foi removido com sucesso
            return res.status(200).json({ message: 'Like removido com sucesso' });
        } else {
            // Caso contrário, adiciona o like
            post.likes.push(userId); // Adiciona o usuário à lista de likes
            await post.save(); // Salva o post atualizado no banco de dados
            
            // Retorna uma resposta informando que o like foi adicionado com sucesso
            return res.status(200).json({ message: 'Like adicionado com sucesso' });
        }
    } catch (err) {
        // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
        console.error("Erro ao dar like na postagem:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
}

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = toggleLikePost;
