import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCatalogue } from "@/domain/catalogue/parse";
import type { Catalogue } from "@/domain/catalogue/types";
import { CsvRegistryAdapter } from "@/adapters/registry/csv-registry";

export const DATA_DIR = process.env.UDYAM_DATA_DIR ?? path.join(process.cwd(), "data");

let catalogue: Catalogue | undefined;

/** Server-only: load and cache the product catalogue. */
export function getCatalogue(): Catalogue {
  catalogue ??= parseCatalogue(readFileSync(path.join(DATA_DIR, "product_catalogue.csv"), "utf8"));
  return catalogue;
}

let registry: CsvRegistryAdapter | undefined;

/** Server-only: load and cache the mock GSTIN + Udyam registries. */
export function getRegistry(): CsvRegistryAdapter {
  registry ??= new CsvRegistryAdapter(readDataFile("mock_gstin_registry.csv"), readDataFile("mock_udyam_registry.csv"));
  return registry;
}

export function readDataFile(name: string): string {
  return readFileSync(path.join(DATA_DIR, name), "utf8");
}
