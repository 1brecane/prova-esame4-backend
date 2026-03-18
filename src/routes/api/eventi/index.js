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
            const utenteId = request.user.utenteId;
            const eventi = await db.query(
                `
                SELECT e.EventoID, e.Titolo, e.Data, e.Descrizione,
                       (SELECT COUNT(*) FROM Iscrizioni i WHERE i.EventoID = e.EventoID AND i.UtenteID = ?) as Iscritto
                FROM Eventi e 
                ORDER BY e.Data ASC
                `,
                [utenteId]
            );
            return eventi.map(e => ({
                ...e,
                Iscritto: e.Iscritto > 0
            }));
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

    // Elenco iscrizioni per un evento specifico (solo organizzatori)
    fastify.get(
        "/:id/iscrizioni",
        {
            schema: {
                tags: ["Eventi", "Iscrizioni"],
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

            // Controlla se l'evento esiste
            const eventi = await db.query("SELECT EventoID FROM Eventi WHERE EventoID = ?", [id]);
            if (eventi.length === 0) {
                return reply.code(404).send({ error: "Evento non trovato" });
            }

            const iscrizioni = await db.query(
                `
                SELECT i.IscrizioneID, i.CheckinEffettuato, i.OraCheckin, u.UtenteID, u.Nome, u.Cognome, u.Email
                FROM Iscrizioni i
                JOIN Utenti u ON i.UtenteID = u.UtenteID
                WHERE i.EventoID = ?
                ORDER BY u.Cognome ASC, u.Nome ASC
                `,
                [id]
            );

            return iscrizioni;
        },
    );
}

export default eventiRoutes;
