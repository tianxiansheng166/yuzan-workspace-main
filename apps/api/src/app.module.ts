import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { markRootHealthRoutesPublic } from "./bootstrap/public-health.js";
import { applyRootRouteCompatibility } from "./bootstrap/route-compatibility.js";
import { validateEnvironment } from "./config/environment.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ClassesModule } from "./modules/classes/classes.module.js";
import { CurriculumModule } from "./modules/curriculum/curriculum.module.js";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { DatabaseModule } from "./shared/database/index.js";

markRootHealthRoutesPublic();
applyRootRouteCompatibility();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
    OrganizationsModule,
    ClassesModule,
    CurriculumModule,
    // Keep security last so its APP_GUARD providers execute in the documented
    // authentication -> tenant -> policy order after feature composition.
    AuthModule,
  ],
})
export class AppModule {}
