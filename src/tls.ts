import { readFileSync } from "fs";
import { Agent } from "https";
import { createSecureContext, rootCertificates } from "tls";

const extraCaAgents = new Map<string, Agent>();

/**
 * Create an HTTPS agent that mirrors NODE_EXTRA_CA_CERTS for one configured
 * environment. Passing `ca` to an Agent replaces Node's default CA list, so
 * the built-in roots must be included alongside the extra PEM bundle.
 */
export function createExtraCaAgent(nodeExtraCaCerts?: string): Agent | undefined {
  if (!nodeExtraCaCerts) return undefined;
  const cached = extraCaAgents.get(nodeExtraCaCerts);
  if (cached) return cached;

  let extraCa: string;
  try {
    extraCa = readFileSync(nodeExtraCaCerts, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read NODE_EXTRA_CA_CERTS file "${nodeExtraCaCerts}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!extraCa.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(
      `NODE_EXTRA_CA_CERTS file "${nodeExtraCaCerts}" does not contain a PEM certificate`
    );
  }

  try {
    createSecureContext({ ca: extraCa });
  } catch (error) {
    throw new Error(
      `NODE_EXTRA_CA_CERTS file "${nodeExtraCaCerts}" is not a valid PEM CA bundle: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const agent = new Agent({
    ca: [...rootCertificates, extraCa],
  });
  extraCaAgents.set(nodeExtraCaCerts, agent);
  return agent;
}
