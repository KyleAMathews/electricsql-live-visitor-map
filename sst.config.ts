/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { createExampleDbAndAddtoElectric } from "./create-db-and-add-to-electric";

export default $config({
  app(input) {
    return {
      name: "project",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { neon: "0.6.3", cloudflare: "5.43.1" },
    };
  },
  async run() {
    try {
      const { electricInfo, databaseUri } = createExampleDbAndAddtoElectric({
        name: `visitor-map`,
      });

      databaseUri.apply(applyMigrations);
      // databaseUri.apply(loadData);
      // TOOD
      // - add migration file
      // - dev command to run astro locally
      //    - link in the db, etc.
      // - add cloudflare worker

      const website = deploySite(electricInfo);

      return {
        databaseUri,
        database_id: electricInfo.id,
        electric_token: electricInfo.token,
        website: website.url,
      };
    } catch (e) {
      console.error(`Failed to deploy linearlite stack`, e);
    }
  },
});

function applyMigrations(uri: string) {
  execSync(`npx pg-migrations apply --directory ./db/migrations`, {
    env: {
      ...process.env,
      DATABASE_URL: uri,
    },
  });
}

function loadData(uri: string) {
  execSync(`pnpm run db:load-data`, {
    env: {
      ...process.env,
      DATABASE_URL: uri,
    },
  });
}

function deploySite(electricInfo: $util.Output<{ id: string; token: string }>) {
  return new sst.aws.Astro("visitormap", {
    domain: {
      name: `visitor-map${$app.stage === `production` ? `` : `-stage-${$app.stage}`}.electric-sql.com`,
      dns: sst.cloudflare.dns(),
    },
    environment: {
      VITE_ELECTRIC_URL: `https://api-dev-production.electric-sql.com`,
      VITE_ELECTRIC_TOKEN: electricInfo.token,
      VITE_DATABASE_ID: electricInfo.id,
    },
  });
}
