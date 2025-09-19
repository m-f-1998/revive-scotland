import { Pool } from "pg"

export let pool: Pool | undefined

export const initDB = async ( ) => {
  pool = new Pool ( {
    host: "db",
    port: 5432,
    user: process.env [ "POSTGRES_USER" ] || "youruser",
    password: process.env [ "POSTGRES_PASSWORD" ] || "yourpass",
    database: process.env [ "POSTGRES_DB" ] || "yourdb",
  } )
  await pool.connect ( )
}