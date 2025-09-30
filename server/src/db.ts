import { Pool } from "pg"

export let pool: Pool | undefined

export const initDB = async ( ) => {
  pool = new Pool ( {
    host: process.env [ "POSTGRES_HOST" ] || "db",
    port: parseInt ( process.env [ "POSTGRES_PORT" ] || "5432", 10 ),
    user: process.env [ "POSTGRES_USER" ] || "youruser",
    password: process.env [ "POSTGRES_PASSWORD" ] || "yourpass",
    database: process.env [ "POSTGRES_DB" ] || "yourdb",
  } )
  await pool.connect ( )
}