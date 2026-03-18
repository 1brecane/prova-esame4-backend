import dayjs from "dayjs";

async function iscrizioniRoutes(fastify) {
    const db = fastify.db;

    // Elenco delle proprie iscrizioni (dipendente)
    fastify.get(
        "/",
        {
            schema: { tags: ["Iscrizioni"] },
            onRequest: [fastify.authenticate, fastify.authorizeDipendente],
        },
        async (request, reply) => {
            const utenteId = request.user.utenteId;

            const iscrizioni = await db.query(
                `
                SELECT i.IscrizioneID, i.CheckinEffettuato, i.OraCheckin, e.EventoID, e.Titolo, e.Data 
                FROM Iscrizioni i
                JOIN Eventi e ON i.EventoID = e.EventoID
                WHERE i.UtenteID = ?
                ORDER BY e.Data ASC
                `,
                [utenteId],
            );

            return iscrizioni;
        },
    );

    // Iscrizione ad un evento (dipendente)
    fastify.post(
        "/",
        {
            schema: {
                tags: ["Iscrizioni"],
                body: {
                    type: "object",
                    required: ["EventoID"],
                    properties: {
                        EventoID: { type: "integer" },
                    },
                },
            },
            onRequest: [fastify.authenticate, fastify.authorizeDipendente],
        },
        async (request, reply) => {
            const utenteId = request.user.utenteId;
            const { EventoID } = request.body;

            // Controlla se l'evento esiste e recupera la data
            const eventi = await db.query(
                "SELECT Data FROM Eventi WHERE EventoID = ?",
                [EventoID],
            );

            if (eventi.length === 0) {
                return reply.code(404).send({ error: "Evento non trovato" });
            }

            const dataEvento = dayjs(eventi[0].Data).startOf('day');
            const oggi = dayjs().startOf('day');

            // Regola: Un dipendente può iscriversi fino al giorno prima della data dell’evento
            if (!oggi.isBefore(dataEvento)) {
                return reply.code(400).send({ error: "Le iscrizioni per questo evento sono chiuse (scadenza: giorno prima)" });
            }

            // Controlla se è già iscritto
            const esistente = await db.query(
                "SELECT IscrizioneID FROM Iscrizioni WHERE UtenteID = ? AND EventoID = ?",
                [utenteId, EventoID]
            );

            if (esistente.length > 0) {
                return reply.code(409).send({ error: "Sei già iscritto a questo evento" });
            }

            const result = await db.execute(
                "INSERT INTO Iscrizioni (UtenteID, EventoID) VALUES (?, ?)",
                [utenteId, EventoID],
            );

            return reply.code(201).send({
                IscrizioneID: result.insertId,
                UtenteID: utenteId,
                EventoID,
                CheckinEffettuato: false
            });
        },
    );

    // Disiscrizione da un evento (dipendente)
    fastify.delete(
        "/:id",
        {
            schema: {
                tags: ["Iscrizioni"],
                params: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                    },
                },
            },
            onRequest: [fastify.authenticate, fastify.authorizeDipendente],
        },
        async (request, reply) => {
            const utenteId = request.user.utenteId;
            const { id } = request.params;

            // Recupera l'iscrizione e la data dell'evento
            const iscrizioni = await db.query(
                `
                SELECT i.UtenteID, e.Data 
                FROM Iscrizioni i
                JOIN Eventi e ON i.EventoID = e.EventoID
                WHERE i.IscrizioneID = ?
                `,
                [id]
            );

            if (iscrizioni.length === 0) {
                return reply.code(404).send({ error: "Iscrizione non trovata" });
            }

            const iscrizione = iscrizioni[0];

            // Regola: Un dipendente può annullare solo una propria iscrizione
            if (iscrizione.UtenteID !== utenteId) {
                return reply.code(403).send({ error: "Non puoi annullare un'iscrizione non tua" });
            }

            const dataEvento = dayjs(iscrizione.Data).startOf('day');
            const oggi = dayjs().startOf('day');

            // Regola: Un dipendente può annullare l’iscrizione fino al giorno prima della data dell’evento
            if (!oggi.isBefore(dataEvento)) {
                return reply.code(400).send({ error: "Non è più possibile annullare l'iscrizione (scadenza: giorno prima)" });
            }

            await db.execute("DELETE FROM Iscrizioni WHERE IscrizioneID = ?", [id]);

            return { message: "Iscrizione annullata con successo" };
        },
    );

    // Registrazione del check-in (solo organizzatori)
    fastify.post(
        "/:id/checkin",
        {
            schema: {
                tags: ["Iscrizioni"],
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

            const iscrizioni = await db.query(
                "SELECT CheckinEffettuato FROM Iscrizioni WHERE IscrizioneID = ?",
                [id]
            );

            if (iscrizioni.length === 0) {
                return reply.code(404).send({ error: "Iscrizione non trovata" });
            }

            if (iscrizioni[0].CheckinEffettuato) {
                return reply.code(400).send({ error: "Check-in già effettuato per questa iscrizione" });
            }

            const oraCheckin = dayjs().format('YYYY-MM-DD HH:mm:ss');

            await db.execute(
                "UPDATE Iscrizioni SET CheckinEffettuato = TRUE, OraCheckin = ? WHERE IscrizioneID = ?",
                [oraCheckin, id]
            );

            return { message: "Check-in registrato con successo", OraCheckin: oraCheckin };
        },
    );
}

export default iscrizioniRoutes;
