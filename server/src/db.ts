import { Pool } from "pg"

export const pool = new Pool ( {
  host: "db",
  port: 5432,
  user: process.env [ "POSTGRES_USER" ] || "youruser",
  password: process.env [ "POSTGRES_PASSWORD" ] || "yourpass",
  database: process.env [ "POSTGRES_DB" ] || "yourdb",
} )
