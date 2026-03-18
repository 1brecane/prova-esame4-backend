async function eventiRoutes(fastify) {
    const db = fastify.db;

    // Elenco eventi (visibile da tutti i dipendenti/utenti autenticati)
    fastify.get(
        "/",
        {
            schema: { tags: ["Eventi"] },
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const eventi = await db.query(
                "SELECT EventoID, Titolo, Data, Descrizione FROM Eventi ORDER BY Data ASC",
            );
            return eventi;
        },
    );

    // Crea evento (solo organizzatori)
    fastify.post(
        "/",
        {
            schema: {
                tags: ["Eventi"],
                body: {
                    type: "object",
                    required: ["Titolo", "Data"],
                    properties: {
                        Titolo: { type: "string", minLength: 1 },
                        Data: { type: "string", format: "date" },
                        Descrizione: { type: "string" },
                    },
                },
            },
            onRequest: [fastify.authenticate, fastify.authorizeOrganizzatore],
        },
        async (request, reply) => {
            const { Titolo, Data, Descrizione } = request.body;

            const result = await db.execute(
                "INSERT INTO Eventi (Titolo, Data, Descrizione) VALUES (?, ?, ?)",
                [Titolo, Data, Descrizione || null],
            );

            return reply.code(201).send({
                EventoID: result.insertId,
                Titolo,
                Data,
                Descrizione,
            });
        },
    );

    // Modifica evento (solo organizzatori)
    fastify.put(
        "/:id",
        {
            schema: {
                tags: ["Eventi"],
                params: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                    },
                },
                body: {
                    type: "object",
                    required: ["Titolo", "Data"],
                    properties: {
                        Titolo: { type: "string", minLength: 1 },
                        Data: { type: "string", format: "date" },
                        Descrizione: { type: "string" },
                    },
                },
            },
            onRequest: [fastify.authenticate, fastify.authorizeOrganizzatore],
        },
        async (request, reply) => {
            const { id } = request.params;
            const { Titolo, Data, Descrizione } = request.body;

            const result = await db.execute(
                "UPDATE Eventi SET Titolo = ?, Data = ?, Descrizione = ? WHERE EventoID = ?",
                [Titolo, Data, Descrizione || null, id],
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ error: "Evento non trovato" });
            }

            return { message: "Evento aggiornato con successo" };
        },
    );

    // Elimina evento (solo organizzatori)
    fastify.delete(
        "/:id",
        {
            schema: {
                tags: ["Eventi"],
                params: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                    },
                },
            },
            onRequest: [fastify.authenticate, fastify.authorizeOrganizzatore],
        },
        async (request, reply) => {
            const { id } = request.params;

            // Prima eliminiamo le iscrizioni collegate all'evento
            await db.execute("DELETE FROM Iscrizioni WHERE EventoID = ?", [id]);

            const result = await db.execute(
                "DELETE FROM Eventi WHERE EventoID = ?",
                [id],
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ error: "Evento non trovato" });
            }

            return { message: "Evento eliminato con successo" };
        },
    );
}

export default eventiRoutes;
