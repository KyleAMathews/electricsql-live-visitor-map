/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */
import "sst"
export {}
import "sst"
declare module "sst" {
  export interface Resource {
    "ElectricUrl": {
      "type": "sst.sst.Linkable"
      "url": string
    }
    "databaseUriLink": {
      "type": "sst.sst.Linkable"
      "url": string
    }
    "electricInfo": {
      "database_id": string
      "token": string
      "type": "sst.sst.Linkable"
    }
    "visitormap": {
      "type": "sst.aws.Astro"
      "url": string
    }
  }
}
// cloudflare 
import * as cloudflare from "@cloudflare/workers-types";
declare module "sst" {
  export interface Resource {
    "VisitorMapAPI": cloudflare.Service
  }
}
