// Importa o módulo mongoose, que é usado para interagir com o MongoDB.
const mongoose = require("mongoose");

// Define um novo schema (estrutura) para o modelo de usuário no banco de dados.
const user = new mongoose.Schema(
  {
    // Campo para o nome de usuário, único e obrigatório.
    username: {
      type: String, // Tipo de dado: String
      required: [true, "O nome de usuário é obrigatório."], // Obrigatório, com mensagem de erro personalizada
      unique: true, // Deve ser único no banco de dados
      minlength: [3, "O nome de usuário deve ter no mínimo 3 caracteres."], // Restrição de tamanho mínimo
      maxlength: [30, "O nome de usuário deve ter no máximo 30 caracteres."], // Restrição de tamanho máximo
    },

    // Nome completo do usuário, obrigatório e com limite de caracteres.
    name: {
      type: String,
      required: [true, "O nome é obrigatório."],
      maxlength: [50, "O nome pode ter no máximo 50 caracteres."],
    },

    // E-mail do usuário, obrigatório caso não use login social (Google/Facebook).
    email: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.facebookId; // Se o usuário não tiver Google ou Facebook, o e-mail é obrigatório.
        },
        "O e-mail é obrigatório para usuários que não usam redes sociais.",
      ],
      unique: true, // O e-mail deve ser único
      match: [
        /^\S+@\S+\.\S+$/,
        "Por favor, insira um endereço de e-mail válido.",
      ], // Validação de formato de e-mail
    },

    // Foto de perfil do usuário, armazenando múltiplas resoluções e o ID no Cloudinary.
    profile_image: {
      public_id: { type: String, default: null }, // ID da imagem armazenada no Cloudinary
      original: {
        type: String,
        default:
          "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
      }, // URL da imagem original
      low: {
        type: String,
        default:
          "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
      }, // Versão de baixa qualidade
      high: {
        type: String,
        default:
          "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
      }, // Versão de alta qualidade
      medium: {
        type: String,
        default:
          "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
      }, // Versão média
    },

    // Foto de capa do usuário
    cover_photo: {
      public_id: { type: String, default: null },
      original: { type: String, default: null },
      low: { type: String, default: null },
      high: { type: String, default: null },
      medium: { type: String, default: null },
    },

    // Pequena biografia do usuário com limite de 160 caracteres.
    bio: {
      type: String,
      maxlength: [160, "A bio pode ter no máximo 160 caracteres."],
      default: "",
    },

    // Indica se o usuário tem uma conta verificada.
    verified: {
      type: Boolean,
      default: false,
    },

    // Lista de seguidores do usuário, armazenando IDs de outros usuários.
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    followers_count: {
      type: Number,
      default: 0,
    },

    // Lista de usuários que esse usuário segue.
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following_count: {
      type: Number,
      default: 0,
    },

    // Lista de usuários inscritos para receber notificações deste usuário
    subscribers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    // IDs de autenticação social para login via Google e Facebook.
    google_id: {
      type: String,
      default: null,
    },
    facebook_id: {
      type: String,
      default: null,
    },

    // Contagem de posts do usuário.
    posts_count: {
      type: Number,
      default: 0,
    },

    website: {
      type: String,
      default: "",
    },

    // Contagem de notificações não lidas.
    unread_notifications_count: {
      type: Number,
      default: 0,
    },

    // Contagem de mensagens não lidas.
    unread_messages_count: {
      type: Number,
      default: 0,
    },

    // Número de telefone com validação de formato internacional.
    phone_number: {
      type: String,
      match: [
        /^\+?[1-9]\d{1,14}$/,
        "Por favor, insira um número de telefone válido.",
      ],
      default: "",
    },

    // Data de nascimento do usuário.
    birth_date: {
      month: {
        type: Number,
        default: null,
      },
      day: {
        type: Number,
        default: null,
      },
      year: {
        type: Number,
        default: null,
      },
    },

    // Site pessoal do usuário.
    website: {
      type: String,
      default: "",
    },

    // Gênero do usuário, com valores pré-definidos.
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    // Status de atividade do usuário.
    activity_status: {
      is_active: { type: Boolean, default: false }, // Se está ativo agora
      active_since: { type: Date, default: null }, // Última vez que ficou ativo
      inactive_since: { type: Date, default: null }, // Última vez que ficou inativo
      socket_id: { type: String, default: null }, // ID da conexão socket para WebSocket
    },

    // Localização do usuário.
    location: {
      type: String,
      default: null,
    },

    // Lista de interesses do usuário.
    interests: [
      {
        type: String,
      },
    ],

    // Status de relacionamento.
    relationship_status: {
      type: String,
      enum: [
        "single",
        "in_a_relationship",
        "married",
        "divorced",
        "complicated",
      ],
      default: "single",
    },

    // Configurações de privacidade do usuário.
    privacy_settings: {
      profile_visibility: {
        type: String,
        enum: ["public", "friends_only", "private"],
        default: "public",
      },
      message_privacy: {
        type: String,
        enum: ["public", "friends_only", "private"],
        default: "friends_only",
      },
    },

    // Lista de usuários bloqueados.
    blocked_users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Histórico de atividades do usuário (misto para armazenar diferentes tipos de eventos).
    activity_history: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],

    // Configurações de notificações.
    notification_settings: {
      email_notifications: { type: Boolean, default: true },
      push_notifications: { type: Boolean, default: true },
    },

    // Histórico de login, incluindo timestamp, IP e dispositivo usado.
    login_history: [
      {
        timestamp: { type: Date, default: Date.now },
        ipAddress: { type: String },
        device: { type: String },
      },
    ],

    // Token para verificação da conta.
    account_verification_token: {
      type: String,
      required: false,
    },

    // Data de expiração do token de verificação.
    account_verification_token_expires: {
      type: Date,
      required: false,
    },

    // Status da verificação da conta.
    account_verification_status: {
      type: String,
      enum: ["pending", "verified", "locked", "rejected"],
      default: "pending",
    },

    // Idioma preferido do usuário.
    preferred_language: {
      type: String,
      default: "pt",
    },

    // Configuração de tema (modo claro ou escuro).
    theme_settings: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },

    // Senha do usuário (armazenada criptografada).
    password: {
      type: String,
      default: null,
    },

    // Token para redefinição de senha e sua expiração.
    reset_password_token: {
      type: String,
      default: null,
    },
    reset_password_token_expires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, // Adiciona timestamps automáticos.
  }
);

// Cria um índice para o campo `username`, melhorando a busca.
user.index({ username: 1 });

// Exporta o modelo para ser usado em outras partes do projeto.
module.exports = mongoose.model("User", user);
