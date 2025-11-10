import fs from "fs";
import path from "path";

// ✅ Step 1: Create folder for generated app
function createAppFolder(appName) {
  const dir = path.join("./generated_apps", appName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ✅ Step 2: Generate models file (for SQLite)
function generateModelsFile(appDir, models) {
  let content = `
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function initDB() {
  const db = await open({
    filename: '${appDir}/db.sqlite',
    driver: sqlite3.Database
  });
`;

  models.forEach(model => {
    const fields = Object.entries(model.fields)
      .map(([key, type]) => `${key} ${type === "number" ? "INTEGER" : "TEXT"}`)
      .join(", ");
    content += `\n  await db.exec("CREATE TABLE IF NOT EXISTS ${model.name} (${fields})");`;
  });

  content += `
  return db;
}
`;

  fs.writeFileSync(path.join(appDir, "models.js"), content);
}

// ✅ Step 3: Generate API routes in server.js
function generateServerFile(appDir, appName, routes) {
  let content = `
import express from 'express';
import bodyParser from 'body-parser';
import { initDB } from './models.js';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

(async () => {
  const db = await initDB();
`;

  routes.forEach(route => {
    const model = route.model;
    if (route.methods.includes("GET")) {
      content += `
  app.get('/api/${model.toLowerCase()}', async (req, res) => {
    const rows = await db.all('SELECT * FROM ${model}');
    res.json(rows);
  });
`;
    }
    if (route.methods.includes("POST")) {
      content += `
  app.post('/api/${model.toLowerCase()}', async (req, res) => {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map(() => '?').join(',');
    await db.run(\`INSERT INTO ${model} (\${keys.join(',')}) VALUES (\${placeholders})\`, values);
    res.json({ message: '${model} created' });
  });
`;
    }
    if (route.methods.includes("DELETE")) {
      content += `
  app.delete('/api/${model.toLowerCase()}/:id', async (req, res) => {
    await db.run('DELETE FROM ${model} WHERE id=?', req.params.id);
    res.json({ message: '${model} deleted' });
  });
`;
    }
  });

  content += `
  app.listen(PORT, () => console.log('${appName} running on port ' + PORT));
})();
`;

  fs.writeFileSync(path.join(appDir, "server.js"), content);
}

// ✅ Step 4: Main generator
export function generateBackend(schema) {
  const { appName, models, routes } = schema;
  const appDir = createAppFolder(appName);
  generateModelsFile(appDir, models);
  generateServerFile(appDir, appName, routes);
  console.log(\`✅ Backend for \${appName} generated at \${appDir}\`);
}

// Example usage:
const exampleSchema = {
  appName: "NotesApp",
  models: [
    { name: "User", fields: { id: "number", email: "string", password: "string" } },
    { name: "Note", fields: { id: "number", title: "string", content: "string", userId: "number" } }
  ],
  routes: [
    { model: "Note", methods: ["GET", "POST", "DELETE"] }
  ]
};

// Run generator
generateBackend(exampleSchema);

