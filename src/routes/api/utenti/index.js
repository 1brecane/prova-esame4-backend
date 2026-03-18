import bcrypt from "bcryptjs";
import { signUserToken } from "../../../hooks/auth.js";

const PASSWORD_MIN_LENGTH = 6;

async function utentiRoutes(fastify) {
    const db = fastify.db;

    // Registrazione (API pubblica)
    fastify.post(
        "/register",
        {
            schema: {
                tags: ["Utenti"],
                body: {
                    type: "object",
                    required: ["Nome", "Cognome", "Email", "Password"],
                    properties: {
                        Nome: { type: "string", minLength: 1 },
                        Cognome: { type: "string", minLength: 1 },
                        Email: { type: "string", format: "email" },
                        Password: { type: "string", minLength: PASSWORD_MIN_LENGTH },
                    },
                },
            },
        },
        async (request, reply) => {
            const { Nome, Cognome, Email, Password } = request.body;

            // Controlla se la mail è già registrata
            const existing = await db.query(
                "SELECT UtenteID FROM Utenti WHERE Email = ?",
                [Email],
            );
            if (existing.length > 0) {
                return reply.code(409).send({ error: "Email già registrata" });
            }

            const passwordHash = await bcrypt.hash(Password, 10);
            
            // Di default registriamo come Dipendente
            const result = await db.execute(
                `
                INSERT INTO Utenti (Nome, Cognome, Email, Password, Ruolo)
                VALUES (?, ?, ?, ?, 'Dipendente')
                `,
                [Nome, Cognome, Email, passwordHash],
            );

            return reply.code(201).send({
                UtenteID: result.insertId,
                Nome,
                Cognome,
                Email,
                Ruolo: 'Dipendente'
            });
        },
    );

    // Login (API pubblica)
    fastify.post(
        "/login",
        {
            schema: {
                tags: ["Utenti"],
                body: {
                    type: "object",
                    required: ["Email", "Password"],
                    properties: {
                        Email: { type: "string", format: "email" },
                        Password: { type: "string" },
                    },
                },
            },
        },
        async (request, reply) => {
            const { Email, Password } = request.body;

            const rows = await db.query(
                "SELECT UtenteID, Nome, Cognome, Email, Password, Ruolo FROM Utenti WHERE Email = ?",
                [Email],
            );
            const user = rows[0];

            if (!user) {
                return reply
                    .code(401)
                    .send({ error: "Credenziali non valide" });
            }

            const ok = await bcrypt.compare(Password, user.Password);
            if (!ok) {
                return reply
                    .code(401)
                    .send({ error: "Credenziali non valide" });
            }

            const token = signUserToken(user);

            return reply.send({
                token,
                utente: {
                    UtenteID: user.UtenteID,
                    Nome: user.Nome,
                    Cognome: user.Cognome,
                    Email: user.Email,
                    Ruolo: user.Ruolo,
                },
            });
        },
    );
}

export default utentiRoutes;
