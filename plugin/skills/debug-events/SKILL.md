---
name: debug-events
description: >-
  Tracer et diagnostiquer une exécution Prisme.ai via le flux d'events (activity feed).
  À partir d'un correlationId, d'un slug d'automation, d'un message d'erreur ou d'un
  symptôme ("l'agent boucle", "le tool call ne part jamais", "500 intermittent"),
  reconstruit la chaîne d'exécution avec `search_events`, localise l'automation+étape
  fautive et propose la cause racine. Read-only. Déclencheurs : "debug cette erreur",
  "trace ce correlationId", "pourquoi cette exécution a échoué", "activity feed",
  "search events", "/debug-events".
allowed-tools: Read, Grep, Glob, mcp__prisme-ai-builder__search_events, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__list_automations, mcp__prisme-ai-builder__get_prisme_documentation
---

# `/debug-events` — Diagnostic d'exécution via le flux d'events

Workflow **read-only** pour reconstituer ce qui s'est passé pendant une exécution
Prisme.ai et pointer la cause racine. L'activity feed (events Elasticsearch) est la
source de vérité : chaque automation exécutée, chaque fetch, chaque erreur y laisse une
trace corrélée par `source.correlationId`.

---

## Entrées possibles

Demander/identifier au moins un point d'ancrage :

| L'utilisateur fournit | Stratégie |
|-----------------------|-----------|
| Un `correlationId` | Pivot idéal — récupère toute la chaîne d'un coup (§2.1) |
| Un slug d'automation | Filtrer sur `source.automationSlug`, trier par `@timestamp` desc (§2.2) |
| Un message d'erreur | Filtrer `type: error` + plein-texte sur le message (§2.3) |
| Un symptôme seul ("ça boucle") | Filtrer par workspace + fenêtre temporelle, repérer l'anomalie (§2.4) |

**Workspace** : récupérer l'`id` depuis l'`index.yml` local du workspace (cf. CLAUDE.md),
le passer en `workspaceId`. Par défaut : `ai-knowledge` en `sandbox`.

---

## 1. Schéma d'event (rappel)

| Champ | Rôle |
|-------|------|
| `type` | Catégorie (`runtime.automations.executed`, `error`, `runtime.fetch.failed`…) |
| `source.correlationId` | **Groupe** tous les events d'une même opération |
| `source.automationSlug` | Nom de l'automation |
| `source.workspaceId` | Workspace |
| `source.userId` | Utilisateur déclencheur |
| `payload` | Données spécifiques (args d'entrée, output, détails d'erreur) |
| `@timestamp` | **Toujours** trier là-dessus (jamais `timestamp`) |

Types fréquents : `runtime.automations.executed` (automation terminée),
`runtime.fetch.failed` (HTTP KO), `error` (générique), `workspaces.automations.updated`.

---

## 2. Requêtes pivots (`search_events`, DSL Elasticsearch)

### 2.1 — Toute la chaîne d'un correlationId
```json
{"bool": {"filter": [{"term": {"source.correlationId": "uuid-here"}}]}}
```
Trier `@timestamp` **asc** pour lire l'exécution dans l'ordre. C'est le pivot maître :
on voit l'enchaînement automation → automation → fetch → erreur.

### 2.2 — Dernières exécutions d'une automation
```json
{"bool": {"filter": [{"term": {"source.automationSlug": "automation-name"}}]}}
```
Trier `@timestamp` **desc**, limiter à ~20. Récupérer le `correlationId` de l'exécution
suspecte puis revenir en §2.1.

### 2.3 — Toutes les erreurs (puis remonter)
```json
{"bool": {"filter": [{"term": {"type": "error"}}]}}
```
Combiner avec un `match` sur le message si connu. Une fois l'erreur trouvée, son
`correlationId` ouvre la chaîne complète (§2.1).

### 2.4 — Fetch HTTP échoués
```json
{"bool": {"filter": [{"term": {"type": "runtime.fetch.failed"}}]}}
```

> Toujours ajouter `{"term": {"source.workspaceId": "<id>"}}` au `filter` et une borne
> temporelle pour réduire le bruit.

---

## 3. Méthode de diagnostic

1. **Ancrer** : obtenir un `correlationId` (directement, ou via §2.2/§2.3).
2. **Dérouler** la chaîne en §2.1, `@timestamp` asc. Lister la séquence d'automations exécutées.
3. **Repérer la rupture** :
   - La **dernière** `runtime.automations.executed` avant l'erreur = l'automation qui a planté ou produit la mauvaise valeur.
   - Un `runtime.fetch.failed` = problème HTTP/credential (regarder le status, l'URL).
   - **Absence** d'un event attendu (ex. seulement `ensureAuthentication` + `mcp`, jamais `routeToolCall`) = le flux s'est arrêté plus tôt que prévu → suspecter un `break` mal scopé ou une condition qui ne matche pas (cf. `/dsul-rules` §2 et §5).
4. **Lire l'automation** fautive (`get_automation`) à l'étape pointée. Croiser le symptôme avec les pièges connus → **invoquer `/dsul-rules`** :
   - 500 sans assertion / `InvalidExpressionSyntax` → ternaire, `[]`/`|| []`, `{{` littéral.
   - Branche jamais prise → comparaison `"{{var}}"`, clé hyphénée pointée.
   - Sortie = nom de capture littéral → variable nommée `output`.
   - `Function not found` alors que la fonction existe → `type: array`/`oneOf` ailleurs dans le Custom Code.
   - Boucle OAuth infinie → état en `scope: user` non persisté.
5. **Confirmer la cause racine**, puis proposer le fix (sans l'appliquer — ce skill est read-only ; basculer sur `/app-dev` ou édition manuelle pour corriger).

---

## 4. Lire les payloads volumineux & enrichis

- Le runtime auto-émet `runtime.automations.executed` avec **`output` ET `payload` d'entrée** (args). C'est précieux : pour savoir avec quels arguments une automation a été appelée, lire `payload` de son executed-event.
- Sur une erreur, le runtime **enrichit** `$error` avec les args d'entrée de l'automation qui a échoué : `$error.details.parent.payload.*` contient ce qui a été passé. Utile pour reproduire.
- ⚠️ **Attention OOM/redaction** : les gros blobs (b64 images, fichiers) qui traversent les frontières DSUL apparaissent dans `output`/`payload`. Les **`emit` manuels ne sont PAS redactés** (`details: {{$error}}` peut porter un blob complet). Si la recherche d'events est lente ou tronquée, c'est probablement un payload massif — restreindre les champs retournés et la fenêtre temporelle.

---

## 5. Anti-patterns de recherche

- ❌ Trier sur `timestamp` → utiliser `@timestamp`.
- ❌ Requête sans `source.workspaceId` → bruit cross-workspace.
- ❌ Conclure sur le seul event d'erreur → toujours remonter au `correlationId` pour le contexte amont.
- ❌ Oublier qu'une étape **manquante** est un signal aussi fort qu'une erreur explicite.

---

## Rendu attendu

Un récap court :
1. **Chaîne** : séquence d'automations exécutées (avec `@timestamp`).
2. **Point de rupture** : automation + étape + type d'event.
3. **Cause racine** : croisée avec un piège `/dsul-rules` quand applicable, ou cause externe (HTTP/credential/données).
4. **Fix proposé** (read-only — ne pas éditer ici).
