const { Client } = require("pg");
const { scrypt } = require("node:crypto");

process.loadEnvFile("../../.env");
const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  school: "22222222-2222-4222-8222-222222222222",
  membership: "33333333-3333-4333-8333-333333333333",
};

const derive = (password, salt) =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 67108864 },
      (error, value) => error ? reject(error) : resolve(value)),
  );

async function cleanup(client) {
  await client.query('DELETE FROM "SessionPair" WHERE "userId"=$1', [ids.user]);
  await client.query('DELETE FROM "Course" WHERE "authorUserId"=$1', [ids.user]);
  await client.query('DELETE FROM "Membership" WHERE "userId"=$1', [ids.user]);
  await client.query('DELETE FROM "User" WHERE id=$1', [ids.user]);
  await client.query('DELETE FROM "School" WHERE id=$1', [ids.school]);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await cleanup(client);
  if (process.argv[2] === "cleanup") {
    await client.end();
    return;
  }
  const salt = Buffer.from("windows-smoke-salt");
  const hash = await derive("SmokeOnly-2026", salt);
  const encoded = `$scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
  await client.query(
    'INSERT INTO "School" (id,code,name,"isActive","createdAt","updatedAt") VALUES ($1,$2,$3,true,now(),now())',
    [ids.school, "windows-smoke", "Windows Smoke School"],
  );
  await client.query(
    'INSERT INTO "User" (id,"loginIdentifier","displayName","passwordHash",status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,\'ACTIVE\',now(),now())',
    [ids.user, "windows-smoke@example.invalid", "Windows Smoke Teacher", encoded],
  );
  await client.query(
    'INSERT INTO "Membership" (id,"schoolId","userId",role,status,"joinedAt") VALUES ($1,$2,$3,\'TEACHER\',\'ACTIVE\',now())',
    [ids.membership, ids.school, ids.user],
  );
  await client.end();
}

main().catch((error) => {
  console.error(error.code || error.name);
  process.exitCode = 1;
});
