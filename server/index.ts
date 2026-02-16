import { getDb } from "./db/index";
import { createApp } from "./app";

const PORT = process.env.PORT || 3001;

const db = getDb();
const app = createApp(db);

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
