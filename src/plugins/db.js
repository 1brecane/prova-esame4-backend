import fp from "fastify-plugin";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

async function initSchema(connection) {
    // Utenti
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS Utenti (
            UtenteID INT AUTO_INCREMENT PRIMARY KEY,
            Nome VARCHAR(255),
            Cognome VARCHAR(255),
            Email VARCHAR(255) NOT NULL UNIQUE,
            Password VARCHAR(255) NOT NULL,
            Ruolo ENUM('Dipendente', 'Organizzatore') NOT NULL DEFAULT 'Dipendente'
        )
    `);

    // Eventi
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS Eventi (
            EventoID INT AUTO_INCREMENT PRIMARY KEY,
            Titolo VARCHAR(255) NOT NULL,
            Data DATE NOT NULL,
            Descrizione TEXT
        )
    `);

    // Iscrizioni
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS Iscrizioni (
            IscrizioneID INT AUTO_INCREMENT PRIMARY KEY,
            UtenteID INT NOT NULL,
            EventoID INT NOT NULL,
            CheckinEffettuato BOOLEAN NOT NULL DEFAULT FALSE,
            OraCheckin DATETIME NULL,
            FOREIGN KEY (UtenteID) REFERENCES Utenti(UtenteID),
            FOREIGN KEY (EventoID) REFERENCES Eventi(EventoID)
        )
    `);
}

async function seedData(connection) {
    const [rows] = await connection.execute(
        "SELECT COUNT(*) as count FROM Utenti",
    );
    if (rows[0].count > 0) {
        return;
    }

    console.log("Seeding database...");

    const passwordHash = await bcrypt.hash("password", 10);

    // Seed Utenti (Nome, Cognome, Email, Password, Ruolo)
    await connection.execute(
        `
        INSERT INTO Utenti (Nome, Cognome, Email, Password, Ruolo) VALUES 
        ('Admin', 'Sistema', 'admin@eventi.it', ?, 'Organizzatore'),
        ('Mario', 'Rossi', 'mariorossi@eventi.it', ?, 'Dipendente'),
        ('Laura', 'Bianchi', 'laurabianchi@eventi.it', ?, 'Dipendente')
    `,
        [passwordHash, passwordHash, passwordHash],
    );

    // Seed Eventi
    await connection.execute(`
        INSERT INTO Eventi (Titolo, Data, Descrizione) VALUES 
        ('Conferenza Annuale 2025', '2026-04-15', 'Conferenza aziendale con keynote e workshop'),
        ('Team Building', '2026-05-20', 'Giornata di attività di gruppo'),
        ('Webinar Tecnologico', '2026-06-10', 'Presentazione delle nuove tecnologie')
    `);
}

export default fp(async function dbPlugin(fastify, options) {
    const poolConfig = process.env.DATABASE_URL || {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "password",
        database: process.env.DB_NAME || "prova_esame",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };
    const pool = mysql.createPool(poolConfig);

    let connection;
    let retries = 10;

    while (retries > 0) {
        try {
            connection = await pool.getConnection();
            fastify.log.info("Database connected successfully");
            await initSchema(connection);
            await seedData(connection);
            break;
        } catch (err) {
            retries--;
            fastify.log.warn(
                `Database connection failed. Retries left: ${retries}. Error: ${err.message}`,
            );
            if (retries === 0) {
                fastify.log.error(
                    "Could not connect to database after multiple attempts",
                );
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
        } finally {
            if (connection) connection.release();
        }
    }

    fastify.decorate("db", {
        pool,
        async query(sql, params) {
            const [rows] = await pool.query(sql, params);
            return rows;
        },
        async execute(sql, params) {
            const [result] = await pool.execute(sql, params);
            return result;
        },
        async getConnection() {
            return pool.getConnection();
        },
    });

    fastify.addHook("onClose", async () => {
        await pool.end();
    });
});
