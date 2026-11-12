import "dotenv/config";
import { createServer } from "node:http";

import { parseObjectId } from "./shared/object-id.js";

import { createApp } from "./app/create-app.js";
import { installShutdown } from "./app/shutdown.js";
import { readApiEnv } from "./config/env.js";
import { createCredentialCipher, readDataEncryptionKey } from "./infrastructure/crypto/index.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import {
  closeMongo,
  connectMongo,
  purgeAccount,
  readMongoConfig
} from "./infrastructure/mongodb/index.js";
import { MongoAuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createGoogleOAuthClient } from "./modules/auth/google-oauth.js";
import { createPersonalServices } from "./modules/personal-services.js";
import { MongoRoutinesRepository } from "./modules/routines/routines.repository.js";
import { MongoTimersRepository } from "./modules/timers/timers.repository.js";
import { MongoUsersRepository } from "./modules/users/users.repository.js";
import { UsersService } from "./modules/users/users.service.js";
import { MongoWidgetsRepository } from "./modules/widgets/widgets.repository.js";

try {
  const runtime = readApiEnv(process.env);
  const logger = createLogger(runtime.config.logLevel);
  const mongo = readMongoConfig(process.env);
  const client = await connectMongo(mongo);
  const db = client.db(mongo.dbName);
  const cipher = createCredentialCipher(readDataEncryptionKey(process.env));
  const authService = new AuthService(
    new MongoAuthRepository(db),
    createGoogleOAuthClient({
      clientId: runtime.googleClientId,
      clientSecret: runtime.googleClientSecret,
      redirectUri: runtime.config.googleRedirectUri
    }),
    cipher,
    runtime.config.sessionTtlMs,
    runtime.config.oauthStateTtlMs
  );
  const personal = createPersonalServices({
    widgets: new MongoWidgetsRepository(db),
    routines: new MongoRoutinesRepository(db),
    timers: new MongoTimersRepository(db)
  });
  const usersService = new UsersService(new MongoUsersRepository(db), async (userId) => {
    const id = parseObjectId(userId);

    if (!id) {
      throw new Error("Некорректный идентификатор пользователя");
    }

    await purgeAccount(db, id);
  });
  const app = createApp({
    config: runtime.config,
    logger,
    authService,
    usersService,
    widgetsService: personal.widgets,
    routinesService: personal.routines,
    timersService: personal.timers,
    dashboardService: personal.dashboard,
    readyCheck: async () => {
      try {
        await db.command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    }
  });
  const server = createServer(app);
  server.listen(runtime.config.port, () => {
    logger.info({ port: runtime.config.port }, "API слушает порт");
  });
  installShutdown({
    server,
    logger,
    closeStorage: () => closeMongo(client)
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "API не запустился";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
