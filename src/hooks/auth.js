import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "8h"

export function authHook(fastify) {
    fastify.decorate("authenticate", async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({ error: "Token mancante o non valido" });
        }

        const token = authHeader.substring("Bearer ".length);

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            request.user = payload;
        } catch (err) {
            return reply.code(401).send({ error: "Token non valido" });
        }
    });

    fastify.decorate("authorizeOrganizzatore", async (request, reply) => {
        if (!request.user || request.user.ruolo !== 'Organizzatore') {
            return reply.code(403).send({ error: "Accesso riservato agli organizzatori" });
        }
    });

    fastify.decorate("authorizeDipendente", async (request, reply) => {
        if (!request.user || request.user.ruolo !== 'Dipendente') {
            return reply.code(403).send({ error: "Accesso riservato ai dipendenti" });
        }
    });
}

export function signUserToken(user) {
    const payload = {
        utenteId: user.UtenteID,
        email: user.Email,
        ruolo: user.Ruolo,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}
