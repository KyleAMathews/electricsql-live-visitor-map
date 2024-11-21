/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { createExampleDbAndAddtoElectric } from "./create-db-and-add-to-electric";

const ELECTRIC_URL = "https://api-dev-production.electric-sql.com";

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

      databaseUri.properties.url.apply(applyMigrations);

      const electricUrlLink = new sst.Linkable("ElectricUrl", {
        properties: {
          url: ELECTRIC_URL
        },
      });

      // Add Cloudflare Worker
      const worker = new sst.cloudflare.Worker("VisitorMapAPI", {
        handler: "./server/index.ts",
        url: true,
        link: [databaseUri, electricInfo, electricUrlLink],
      });

      const website = deploySite(electricInfo, worker);

      return {
        databaseUri: databaseUri.properties.url,
        ...electricInfo.properties,
        website: website.url,
        api: worker.url,
      };
    } catch (e) {
      console.error(`Failed to deploy linearlite stack`, e);
    }
  },
});

function applyMigrations(uri: string) {
  console.log(`apply migrations to `, uri)
  execSync(`npx pg-migrations apply --directory ./db/migrations`, {
    env: {
      ...process.env,
      DATABASE_URL: uri,
    },
  });
}

function deploySite(
  electricInfo: sst.Linkable<{ id: string; token: string }>,
  worker: sst.cloudflare.Worker,
) {
  return new sst.aws.Astro("visitormap", {
    domain: {
      name: `visitor-map${$app.stage === `production` ? `` : `-stage-${$app.stage}`}.electric-sql.com`,
      dns: sst.cloudflare.dns(),
    },
    dev: {
      url: `http://localhost:4321`,
    },
    link: [worker],
    environment: {
      PUBLIC_ELECTRIC_TOKEN: electricInfo.properties.token,
      PUBLIC_DATABASE_ID: electricInfo.properties.id,
      PUBLIC_ELECTRIC_URL: ELECTRIC_URL,
      PUBLIC_API_URL: worker.url as unknown as string,
    },
  });
}
