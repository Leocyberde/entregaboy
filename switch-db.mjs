import fs from 'fs';
import path from 'path';

const provider = process.env.DATABASE_PROVIDER || 'sqlite';
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

let schema = fs.readFileSync(schemaPath, 'utf8');

const enums = ['Role', 'PersonType', 'RideStatus', 'NotificationType'];

if (provider === 'sqlite') {
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  
  // Comentar blocos de enum
  schema = schema.replace(/enum\s+(\w+)\s*\{[\s\S]*?\}/g, (match) => {
    return match.split('\n').map(line => `// ${line}`).join('\n');
  });

  // Substituir tipos de campo por String
  enums.forEach(e => {
    const regex = new RegExp(`(\\s+)${e}(\\s+|\\n|\\s*\\[\\]|\\?)`, 'g');
    schema = schema.replace(regex, `$1String$2`);
  });

  // Corrigir defaults que agora são Strings (adicionar aspas)
  schema = schema.replace(/@default\((cliente|PENDENTE)\)/g, '@default("$1")');
  
  console.log("Ajustado para SQLite");
} else {
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  console.log("Ajustado para PostgreSQL");
}

fs.writeFileSync(schemaPath, schema);
