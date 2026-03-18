export default async function (fastify, opts) {
    fastify.get(
        "/",
        {
            schema: { hide: true },
        },
        async (request, reply) => {
            return reply.send({
                service: "Gestione delle iscrizioni e check-in per formazione aziendale",
                message:
                    "Vedi /docs per la documentazione Swagger.",
            });
        }
    );
}
