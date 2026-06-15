/**
 * Minimal i18n for the connector config SPA. No host locale prop is passed, so
 * we detect from the browser/studio UI language (navigator.language) once at
 * load, defaulting to English. Add a locale by extending `dict`; `t()` falls
 * back to English then to the raw key. `{var}` placeholders are interpolated.
 */
type Lang = 'en' | 'fr'

const dict: Record<Lang, Record<string, string>> = {
  en: {
    loading: 'Loading…',
    missingContext: 'Missing context. Open this page from the connector configAppUrl.',
    copy: 'Copy',
    copied: 'Copied',
    workspace: 'Workspace',
    'title.config': 'configuration',

    'auth.title': 'Authentication',
    'auth.method': 'Method',
    'auth.callbackLabel': 'Callback URL — register this in the Connected App',
    'auth.connected': '✅ Connected{instance}. Token available for automations / cron (via targetUserId).',

    'mode.jwt': 'JWT Bearer (service account) — recommended',
    'mode.clientCredentials': 'OAuth2 Client Credentials',
    'mode.oauth': 'OAuth2 per-user (delegated)',
    'mode.accessToken': 'Access token (direct)',

    'preamble.jwt':
      'Server-to-server, no user. Salesforce → Setup → App Manager → New Connected App → enable OAuth Settings, “Use digital signatures” and upload the X.509 certificate matching the private key below. OAuth scopes: api, refresh_token, offline_access. Pre-authorize the run-as user (Username) on the Connected App (Profiles/Permission Sets). Then copy the Consumer Key.',
    'preamble.clientCredentials':
      'Server-to-server, no user. Salesforce → Connected App → enable OAuth + “Enable Client Credentials Flow”, and set a Run-As user (Setup → Manage Connected Apps → Client Credentials Flow). Scope: api. Copy the Consumer Key and Consumer Secret.',
    'preamble.oauth':
      'Per-user (delegated): each end-user connects their own Salesforce account. Salesforce → Connected App → enable OAuth, set the Callback URL shown below, scopes: api refresh_token offline_access. Copy the Consumer Key and Consumer Secret.',
    'preamble.accessToken':
      'Paste a valid Salesforce access token and your org Instance URL (e.g. https://myorg.my.salesforce.com). Used as-is, no exchange — handy for testing or externally-managed sessions.',

    'field.loginHost': 'Login host',
    'field.jwtUsername': 'Username (run-as)',
    'field.oauthClientId': 'Consumer Key',
    'field.oauthClientSecret': 'Consumer Secret',
    'field.jwtPrivateKey': 'JWT Private Key (PEM)',
    'field.scopes': 'Scopes',
    'field.instanceUrl': 'Instance URL',
    'field.accessToken': 'Access Token',

    'btn.saveAuth': 'Save authentication',
    'btn.connect': 'Connect',
    'btn.disconnect': 'Disconnect',
    'btn.testConn': 'Test connection',
    'btn.installing': 'Installing…',
    'btn.reinstall': 'Reinstall',
    'btn.install': 'Install capability',
    'btn.closeNow': 'Close now',

    'msg.authSaved': 'Authentication saved.',
    'msg.oauthPopup': 'Saved. Complete the Salesforce login in the popup, then return here.',
    'msg.testOk': 'Connection OK — credentials valid.',
    'msg.testFail': 'Test failed ({status}).',
    'msg.allowlistSaved': 'Allowlist saved ({n} agents).',
    'msg.allowAllOn': 'All agents are now allowed (agent verification disabled).',
    'msg.allowAllOff': 'Per-agent allowlist restored.',
    'msg.capInstalled': 'Capability installed on {name}.',
    'msg.installFail': 'Install failed ({status}). {detail}',
    'msg.listAgentsFail': 'Could not list your agents ({status}). {detail}',
    'msg.notAllowed': 'You are not allowed to configure this workspace.',
    'msg.forbidden': 'Forbidden — you must be a workspace admin.',
    'msg.saveFailed': 'Save failed ({status}).',

    'mcp.title': 'MCP endpoint',
    'mcp.useUrl': "Use this URL as the capability's SSE/WebSocket URL:",
    'mcp.scopeHint':
      'Wiring this as a capability manually (Governance → Org → Capabilities)? Set its Scope field to context_id,agent_id,user_id — that is how the agent is identified to the connector (distinct from the OAuth scopes in the auth block). The “Install capability” button sets it for you.',
    'mcp.oauthCapTitle': 'OAuth capability config',
    'mcp.oauthCapHint':
      'To enable the per-user connect button on a capability, create an MCP capability under Governance → Org → Capabilities and paste this auth block (it carries the connect / status / disconnect URLs):',

    'agents.title': 'Authorized agents',
    'agents.subtitle': "Tick the agents allowed to call this connector's MCP endpoint.",
    'agents.allowAll': 'Allow all agents (disables selection + verification)',
    'agents.allowAllWarning': '⚠️ Any agent can call this connector — the calling-agent verification is disabled.',
    'agents.none': 'No agents found for your account.',
    'agents.search': 'Search agents by name or id…',
    'agents.noMatch': 'No agent matches “{q}”.',

    'cb.connected': 'Salesforce connected',
    'cb.disconnected': 'Salesforce disconnected',
    'cb.failed': 'Connection failed',
    'cb.autoclose': 'This window closes automatically in {secs}s.',
  },
  fr: {
    loading: 'Chargement…',
    missingContext: 'Contexte manquant. Ouvrez cette page depuis le configAppUrl du connecteur.',
    copy: 'Copier',
    copied: 'Copié',
    workspace: 'Workspace',
    'title.config': 'configuration',

    'auth.title': 'Authentification',
    'auth.method': 'Méthode',
    'auth.callbackLabel': "Callback URL — à enregistrer dans la Connected App",
    'auth.connected': '✅ Connecté{instance}. Token disponible pour les automations / cron (via targetUserId).',

    'mode.jwt': 'JWT Bearer (compte de service) — recommandé',
    'mode.clientCredentials': 'OAuth2 Client Credentials',
    'mode.oauth': 'OAuth2 par utilisateur (délégué)',
    'mode.accessToken': 'Access token (direct)',

    'preamble.jwt':
      'Serveur à serveur, sans utilisateur. Salesforce → Setup → App Manager → New Connected App → activez OAuth Settings, « Use digital signatures » et téléversez le certificat X.509 correspondant à la clé privée ci-dessous. Scopes OAuth : api, refresh_token, offline_access. Pré-autorisez l’utilisateur run-as (Username) sur la Connected App (Profiles/Permission Sets). Puis copiez la Consumer Key.',
    'preamble.clientCredentials':
      'Serveur à serveur, sans utilisateur. Salesforce → Connected App → activez OAuth + « Enable Client Credentials Flow », et définissez un utilisateur Run-As (Setup → Manage Connected Apps → Client Credentials Flow). Scope : api. Copiez la Consumer Key et la Consumer Secret.',
    'preamble.oauth':
      'Par utilisateur (délégué) : chaque utilisateur connecte son propre compte Salesforce. Salesforce → Connected App → activez OAuth, renseignez la Callback URL ci-dessous, scopes : api refresh_token offline_access. Copiez la Consumer Key et la Consumer Secret.',
    'preamble.accessToken':
      'Collez un access token Salesforce valide et l’Instance URL de votre org (ex. https://myorg.my.salesforce.com). Utilisé tel quel, sans échange — pratique pour tester ou pour des sessions gérées en externe.',

    'field.loginHost': 'Login host',
    'field.jwtUsername': 'Username (run-as)',
    'field.oauthClientId': 'Consumer Key',
    'field.oauthClientSecret': 'Consumer Secret',
    'field.jwtPrivateKey': 'Clé privée JWT (PEM)',
    'field.scopes': 'Scopes',
    'field.instanceUrl': 'Instance URL',
    'field.accessToken': 'Access Token',

    'btn.saveAuth': "Enregistrer l'authentification",
    'btn.connect': 'Connexion',
    'btn.disconnect': 'Déconnexion',
    'btn.testConn': 'Test connexion',
    'btn.installing': 'Installation…',
    'btn.reinstall': 'Réinstaller',
    'btn.install': 'Installer la capacité',
    'btn.closeNow': 'Fermer',

    'msg.authSaved': 'Authentification enregistrée.',
    'msg.oauthPopup': 'Enregistré. Terminez la connexion Salesforce dans la popup, puis revenez ici.',
    'msg.testOk': 'Connexion OK — identifiants valides.',
    'msg.testFail': 'Échec du test ({status}).',
    'msg.allowlistSaved': 'Allowlist enregistrée ({n} agents).',
    'msg.allowAllOn': 'Tous les agents sont désormais autorisés (vérification désactivée).',
    'msg.allowAllOff': 'Allowlist par agent rétablie.',
    'msg.capInstalled': 'Capacité installée sur {name}.',
    'msg.installFail': "Échec de l'installation ({status}). {detail}",
    'msg.listAgentsFail': 'Impossible de lister vos agents ({status}). {detail}',
    'msg.notAllowed': "Vous n'êtes pas autorisé à configurer ce workspace.",
    'msg.forbidden': 'Interdit — vous devez être administrateur du workspace.',
    'msg.saveFailed': "Échec de l'enregistrement ({status}).",

    'mcp.title': 'Endpoint MCP',
    'mcp.useUrl': "Utilisez cette URL comme SSE/WebSocket URL de la capacité :",
    'mcp.scopeHint':
      'Vous câblez la capacité manuellement (Governance → Org → Capabilities) ? Mettez son champ Scope à context_id,agent_id,user_id — c’est ainsi que l’agent est identifié auprès du connecteur (distinct des scopes OAuth du bloc auth). Le bouton « Installer la capacité » le fait pour vous.',
    'mcp.oauthCapTitle': 'Config OAuth de la capacité',
    'mcp.oauthCapHint':
      'Pour activer le bouton de connexion par utilisateur sur une capacité, créez une capacité MCP dans Governance → Org → Capabilities et collez ce bloc auth (il porte les URLs connect / status / disconnect) :',

    'agents.title': 'Agents autorisés',
    'agents.subtitle': "Cochez les agents autorisés à appeler l'endpoint MCP de ce connecteur.",
    'agents.allowAll': 'Autoriser tous les agents (désactive la sélection + la vérification)',
    'agents.allowAllWarning': "⚠️ N'importe quel agent peut appeler ce connecteur — la vérification de l'agent appelant est désactivée.",
    'agents.none': 'Aucun agent trouvé pour votre compte.',
    'agents.search': 'Rechercher un agent par nom ou id…',
    'agents.noMatch': 'Aucun agent ne correspond à « {q} ».',

    'cb.connected': 'Salesforce connecté',
    'cb.disconnected': 'Salesforce déconnecté',
    'cb.failed': 'Échec de la connexion',
    'cb.autoclose': 'Cette fenêtre se ferme automatiquement dans {secs}s.',
  },
}

export const lang: Lang =
  (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[lang][key] ?? dict.en[key] ?? key
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]))
  return s
}
