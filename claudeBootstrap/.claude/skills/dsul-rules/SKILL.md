---
name: dsul-rules
description: >-
  Référence des pièges DSUL & Custom Code Prisme.ai qui passent `validate_automation`
  mais explosent au runtime (InvalidExpressionSyntax, Function not found, comparaisons
  silencieusement fausses, OOM…). À consulter AVANT d'écrire ou de débugger toute
  automation, expression `{% %}`/`{{ }}`, fonction Custom Code, condition, ou requête
  Collection. Déclencheurs : "pourquoi mon automation 500", "InvalidExpressionSyntax",
  "Function not found", "ma condition ne matche jamais", "ternaire DSUL", "/dsul-rules".
allowed-tools: Read, Grep, Glob, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__search_events
---

# `/dsul-rules` — Pièges DSUL & Custom Code Prisme.ai

Catalogue des erreurs qui **passent `validate_automation` mais cassent au runtime**.
La règle d'or : `validate_automation` valide la *syntaxe YAML/DSUL statique*, pas le
comportement à l'exécution. Tout ce qui suit n'apparaît qu'avec des données réelles.

> **Mode d'emploi** : lire la section qui correspond au symptôme, appliquer le *fix*.
> Chaque règle suit le format **Symptôme → Pourquoi → Fix**. En cas de doute sur la
> syntaxe d'une instruction, croiser avec `get_prisme_documentation`.

---

## 1. Expressions `{% %}` / `{{ }}` — ce qui est INTERDIT

Le moteur d'expression DSUL n'est **pas** du JavaScript. Il fait de l'interpolation de
variables + un jeu de fonctions whitelistées (`lower`, `upper`, `json`, `date`, `rand`,
`round`, etc.). Pas de logique, pas de littéraux composés.

### 1.1 — Pas de ternaire `cond ? a : b`

- **Symptôme** : `InvalidExpressionSyntax: invalid syntax` au runtime. **Non attrapé** par `validate_automation`.
- **Pourquoi** : le moteur n'a pas d'opérateur ternaire. Piège classique sur les `output:` booléens des helpers (`setupOk: '{% {{x}} ? true : false %}'`) → 500 avant toute assertion.
- **Fix** : pré-`set` la variable puis la basculer avec un bloc `conditions:` :
  ```yaml
  - set: { name: setupOk, value: false }
  - conditions:
      '{{addedTool.id}}':
        - set: { name: setupOk, value: true }
  output:
    setupOk: '{{setupOk}}'
  ```
- Le ternaire reste valide **dans** un `code: |` Custom Code et un `<script>` de page (vrai JS). L'interdiction ne concerne que les `{% %}`/`{{ }}` DSUL.

### 1.2 — Pas de littéral tableau `[]` (ni `|| []`)

- **Symptôme** : `{% {{x}} || [] %}` → `InvalidExpressionSyntax` pointant sur le `[]`. **Non attrapé** par `validate_automation` (ne casse qu'avec des données réelles, surtout un tableau non vide).
- **Pourquoi** : le parser n'accepte pas les littéraux tableau. A causé le bug #2599 (injection de scope `attachments`/`attachment_urls` dans agent-factory → crash à chaque tool call avec pièce jointe → agent en attente infinie).
- **Fix** : passer la variable telle quelle → `value: '{{x}}'` (undefined injecte vide). Si un défaut est vraiment nécessaire, garantir que la variable est toujours définie **en amont** (init `[]` puis threading), jamais via `|| []` dans `{% %}`.

### 1.3 — Jamais de littéral `{{` dans une expression / condition / `comment:`

- **Symptôme** : `InvalidVariableNameError: Invalid variable name : unterminated` (l'erreur runtime `..`). Ici `validate_automation` **le voit** ("Unclosed variable reference: missing }}"), même dans un `comment:`.
- **Pourquoi** : l'interpolateur scanne toute chaîne DSUL pour `{{` ; un `{{` sans `}}` correspondant est une ref non terminée. Piège canonique : le guard OAuth `'{{cleanX}} matches "{{"'` (censé détecter un binding `{{secret.x}}` non résolu).
- **Fix** : faire la détection en Custom Code, jamais dans une expression DSUL :
  ```js
  function cleanCredential(value){ var v=String(value??''); return v.indexOf('{'+'{')>=0 ? '' : v; }
  ```
  puis brancher sur sa sortie.

---

## 2. Conditions — comparaisons silencieusement fausses

Dans une condition DSUL, le moteur **auto-quote** chaque `{{var}}` interpolée.

| Forme | Verdict | Résultat |
|-------|---------|----------|
| `'{{var}} = "literal"'` | ✅ | `"valeur" = "literal"` — comparer une var à une constante |
| `'{{a}} = {{b}}'` ou `'{{a}} == {{b}}'` | ✅ | var-à-var, **aucun guillemet** → `"valA" = "valB"` |
| `'{{a}} = "{{b}}"'` | ❌ | `{{b}}` interpolée PUIS re-quotée → `""valB""` → **toujours faux, silencieusement** |

- `validate_automation` passe quand même (YAML valide). Le bug ne se voit qu'au runtime : la branche ne matche jamais. Vécu sur `_resolve-image-size` (llm-gateway).
- **Règle** : ne **jamais** écrire `"{{var}}"` dans une condition.

### 2.1 — Guard "valeur vide" : `'{{var}} == ""'` est CASSÉ quand la var est vide

- **Symptôme** : un fallback du type `conditions: '{{fu}} == ""' → set fu = {{autre}}` **ne se déclenche jamais** quand `fu` est réellement vide → la variable reste vide → toute la suite échoue silencieusement.
- **Pourquoi** : quand `{{fu}}` est vide/undefined, l'interpolation produit ` == ""` (rien à gauche) → syntaxe cassée → condition **toujours fausse**. Idem `'"{{fu}}" == ""'` (var quotée, cf. §2). Vécu sur `oddo-docx-translator` (fallback `body.fileUrl` → argument `fileUrl` qui ne basculait jamais).
- **Fix** : tester le vide avec `!{{var}}` (opérateur "Empty?") ou `.length` :
  - ✅ `'!{{fu}}'` → vrai quand `fu` vide
  - ✅ `'{{fu.length}} == 0'` → robuste (insensible espaces/caractères spéciaux)
  - ❌ `'{{fu}} == ""'` et `'"{{fu}}" == ""'` → jamais vrais sur valeur vide

### 2.2 — Opérateur `matches` : le pattern n'est PAS interpolé, et ne jamais le négier

- **Symptôme** : une garde `'{{url}} matches "/v2/files/{{global.workspaceId}}/"'` ne matche **jamais**, même quand `global.workspaceId` se résout bien ailleurs. Vécu sur `oddo-docx-translator` (validation SSRF cross-instance) : `matches "/v2/files/"` = `yes` mais `matches "/v2/files/{{global.workspaceId}}/"` = `no`.
- **Pourquoi** : dans `'{{lhs}} matches "pattern"'`, seul le **LHS** est interpolé. Le **pattern** (côté droit) est pris **littéralement** comme regex → un `{{global.workspaceId}}` dans le pattern cherche la sous-chaîne littérale `{{global.workspaceId}}`, introuvable. `matches` fait un **search partiel** (sous-chaîne, non ancré) : `matches "files"` trouve `.../files/...`.
- **Fix** :
  - Pattern = **littéral pur**, jamais de `{{}}` dedans. Pour valider une URL Storage plateforme **cross-instance**, utiliser un fragment de path SANS host ni id : `'{{url}} matches "/v2/files/"'` (marche sandbox, prod, instance client Azure…). **Ne pas** figer le host `api.sandbox.prisme.ai` (env-scopé → casse à la livraison client).
  - **Ne jamais négier un `matches` dont le pattern contient `.` ou `/`** : `'!({{url}} matches "api.sandbox.prisme.ai/v2/files/")'` est mal parsé et « FIRE » alors que la version positive matche (contradiction). Pattern robuste : positif → set un flag `okUrl = "yes"`, puis condition **séparée** `'{{okUrl}} == "no"'` (comparaison simple, ni regex ni négation) pour l'erreur/`break`.

---

## 3. Accès aux propriétés — clés avec tiret

- **Symptôme** : `{{response.headers.operation-location}}` renvoie vide/undefined **silencieusement**.
- **Pourquoi** : `operation-location` est parsé comme `operation` **moins** `location`. Vaut pour tous les headers HTTP (`content-type`, `x-request-id`, `retry-after`…) et toute clé avec `-`.
- **Fix** : notation crochets + chaîne quotée, avec wrapping single-quote YAML :
  - ❌ `{{response.headers.operation-location}}`
  - ✅ `'{{response.headers["operation-location"]}}'`

---

## 4. Nommage de variables — jamais `output`

- **Symptôme** : un consommateur reçoit la **chaîne littérale** du nom de capture (ex. `"myVar"`) au lieu du résultat.
- **Pourquoi** : `someAutomation: { output: myVar }` traite `output` comme un argument nommé `output` de valeur `"myVar"`. Si l'automation appelée a `output: "{{output}}"` à la racine sans jamais set un `output` local (ou casse avant), `{{output}}` résout l'argument. Erreur **invisible** : ni erreur, ni undefined.
- **Fix** : toujours nommer le résultat interne `result` / `response` / domaine-spécifique. À la racine : `output: "{{result}}"`. Critique pour toute automation susceptible de `break` tôt.

---

## 5. `break` — scopes réels

- `break: {}` → sort du **bloc** englobant le plus proche (conditions/repeat). **Ne sort PAS** de toute l'automation quand imbriqué.
- `break: { scope: automation }` → sort de l'automation courante.
- `break: { scope: repeat }` → sort de la boucle (pas de "continue" en DSUL).
- **`scope: all` N'EXISTE PAS** — 0 usage légitime dans le codebase. Le traiter comme un bug. Observé : `scope: all` empêche le caller d'atteindre l'instruction suivante (comportement indéfini, possible propagation au parent).
- **Conseil** : préférer un flag explicite (`resolved: false` en tête, garder chaque priorité avec `!{{resolved}}`, set `resolved: true` quand une branche écrit l'output final) plutôt que des `break` imbriqués.

---

## 6. `date()` — toujours passer un argument

- **Symptôme** : `'{% date().ts %}'` produit `NaN` → crash insert Collection `column "nan" does not exist`.
- **Pourquoi** : `date()` sans argument ne renvoie pas de valeur exploitable partout. Observé en prod (image-generation).
- **Fix** : utiliser `{{run.date}}` (ISO de l'instant de la requête, fourni par le runtime) :
  ```yaml
  createdAt: '{{run.date}}'                        # ISO string, insert direct
  createdAtTs: '{% date({{run.date}}).ts %}'        # ms numériques
  age: '{% date({{run.date}}).ts - {{job.createdAtTs}} %}'
  ```
- Ne pas stocker `.ts` (ms) dans un champ Collection `type: number` (int32 — déborde). Stocker l'ISO en `type: text`, calculer `.ts` à la volée.

---

## 7. État durable par utilisateur — pas `scope: user`

- **Symptôme** : `set name: user.X scope: user` lu correctement dans le même run, mais **undefined** au run suivant pour le même user. A causé des boucles OAuth infinies (`oauthCallback` écrit l'état, le `tools/call` 90 s plus tard le trouve vide).
- **Pourquoi** : les vars de contexte `scope: user` sont session-scoped, pas durablement persistées.
- **Fix** : pour de l'état durable (workspace × user × name), utiliser le **module `secrets`** (`run: module: secrets, function: set, scope: user`) comme source de vérité. Garder `user.X` uniquement pour de l'état **intra-run** (ex. `oauthPending` pendant le redirect authorize→callback, qui marche car même session navigateur). Ne pas dupliquer l'état (drift).

---

## 8. Custom Code — le sandbox JS

### 8.1 — Format de fonction
`code:` = corps **brut**, pas de wrapper `function foo(){…}`, pas de `name:`. Les `parameters:` (obligatoires) sont injectés directement dans le scope.
```yaml
config:
  functions:
    myFunction:
      parameters:
        arg1: { type: object }
        arg2: { type: string }
      code: |-
        const result = { ... };   // arg1, arg2 dispo directement
        return result;
```

### 8.2 — Commentaires : `//` ou `/* */`, **jamais `#`**
Un `#` dans un `code: |` est passé comme source JS → `SyntaxError` qui **casse TOUTES les fonctions du fichier** (l'erreur surgit dans un contexte sans rapport). Quand un Custom Code lève une erreur de syntaxe cryptique loin du call-site, chercher d'abord un `#`.

### 8.3 — Types de paramètres : `string | number | object | boolean` UNIQUEMENT
- `type: array`, `oneOf`, (et par analogie `anyOf`/`allOf`/`not`) **cassent silencieusement le module entier** : toutes les fonctions renvoient `ObjectNotFoundError: Object not found, path: /run/<funcName>`, même les saines. **Aucune** erreur de validation/load. Quand "Function X not found" alors que `get_app_instance_config` la montre, scanner **tout** le bloc `functions:` pour un `type: array`/`oneOf` (le coupable est souvent une fonction sœur).
- **Fix** : pour un paramètre liste → `type: object` (le JS itère quand même : `Array.isArray(x) ? x.map(...) : ...`). Pour un poly-shape (string OU object) → `type: string` + typecheck JS (`typeof arg === 'string' ? JSON.parse(arg) : arg`).

### 8.4 — Pas de `fetch` global
`fetch is not defined` au runtime. Utiliser `require('https')`/`require('http')` (Promise + `await`, suivre les 3xx, capper la taille, `Buffer.concat(chunks).toString('base64')`). Réf : connecteur gitlab `fetchAsBase64`. Préférer l'instruction DSUL `fetch` quand on n'a pas besoin de b64 en une étape.

### 8.5 — Déployer une fonction CC via MCP : forcer un vrai diff de config
Une fonction peut exister dans `config.functions` (visible via `get_app_instance_config`) mais rester "not found" au runtime. **Cause racine** : le runtime CC est un microservice externe (`apps-prismeai-functions`) dont le déploiement est déclenché par l'event **`workspaces.apps.configured`**. La sauvegarde UI l'émet sur un broker **live** (deploy immédiat) ; `push_workspace` (importDSUL) écrit bien les `functions` mais sur un broker **bufferisé** (`exports.ts:505-517`) — l'event est avalé dans `workspaces.imported` et seulement rejoué en interne, donc le service externe ne le reçoit **jamais** → `ObjectNotFoundError: /run/<fn>`.

**Fix MCP pur (mime l'UI) : après `push_workspace`, forcer un VRAI diff de config** sur l'instance → `configureApp` re-tourne sur broker live → event → deploy. Procédure validée (`oddo-docx-translator`) :
1. `push_workspace` (écrit `config.functions`, deploy bufferisé).
2. `update_app_instance_config config: { lastDeploySync: "<ts>" }` — une **clé RACINE** (hors `functions`). Le merge la conserve, laisse `functions` **intact**, et le diff déclenche l'event. **Bumper ce timestamp à chaque redeploy.**
3. Vérifier appelable (`execute_automation <wrapper>` → plus d'`ObjectNotFoundError` ; ou events `Custom Code.error`).

⚠️ **Le diff doit être RÉEL** : `configureApp` court-circuite sans event si la config est identique (`areObjectsEqual`) → re-poster une config inchangée est un no-op (toujours "not found"). D'où le bump du timestamp.

⚠️ **`update_app_instance_config` merge en surface** : les clés racine de `config.value` sont mergées, mais la valeur d'une clé fournie est **remplacée en entier** (pas de deep-merge). Donc : (a) envoyer `functions.<fn>.description` **écrase tout l'objet** `<fn>` (perd `code`/`parameters`) ; (b) envoyer une map `functions` **incomplète** perd les fonctions sœurs. Ne **jamais** patcher via `functions` pour déclencher le deploy — restaurer le code exact par `push_workspace` (depuis le fichier) et déclencher via la **clé racine**.

Coder défensivement : garder contre la forme erreur avant d'écrire en aval :
```yaml
- Custom Code.run: { function: X, parameters: ..., output: result }
- conditions:
    '!{{result.error}}':
      - set: { name: downstreamField, value: '{{result}}' }
```
> Fonction enregistrée (code propre, réutilisable, idéal **exemple client**) vs `Custom Code.run code:` inline (plus simple, zéro étape de deploy) : les deux marchent en MCP. Choisir enregistré quand la lisibilité/réutilisation prime.

### 8.6 — Cache négatif persistant
Si une fonction CC est tombée en cache négatif (module load-failed à cause d'un `oneOf`/`type:array`), **rien** ne l'invalide : ni `update_app_instance_config`, ni `push_workspace`, ni renommage, ni `uninstall`+reinstall (vécu : bloquée 4 h). **Workaround** : créer une **2e instance Custom Code** avec un slug dédié (ex. `Bindings`) contenant les fonctions à débloquer ; appel via `Bindings.run`. Cache vierge → chargement immédiat.

### 8.7bis — Pas de `description` au niveau d'une fonction (schéma durci)
- **Symptôme** : au déploiement/reconfig d'une fonction CC, `RequestValidationError: request/body/functions/<fn>/description must NOT have additional properties` (errorCode `additionalProperties.openapi.validation`) → la fonction n'est **jamais déployée** → `ObjectNotFound` au runtime.
- **Pourquoi** : le service de déploiement CC valide chaque fonction contre un schéma OpenAPI `additionalProperties: false` qui n'autorise QUE `language`, `parameters`, `code`. Le champ `description` **au niveau de la fonction** est rejeté. Schéma **durci** avec les versions récentes de la plateforme : une fonction avec `description` qui « tournait » avant peut casser après un upgrade client (vécu sur `oddo-docx-translator` post-upgrade, 2026-07).
- **Fix** : ne déclarer que `language` / `parameters` / `code`. Mettre la doc de la fonction dans la **docstring du `code`**. Les `description` **par paramètre** (`parameters.<arg>.description`) sont, elles, tolérées. Diagnostiquer via `search_events type:"Custom Code.error"`.

### 8.7 — Upload depuis Custom Code = credential explicite
Le CC tourne dans un service isolé, **sans auth ambiante**. Upload anonyme vers `/files` → `401`. `prismeaiApiKey: { name: "workspace" }` n'est résolu que par l'instruction DSUL `fetch`/`Prismeai API.upload`, jamais accessible au CC. **Fix** : passer une clé API brute en paramètre (secret workspace + `config.value`), ou faire l'upload en DSUL quand le contenu n'est pas un gros blob.

---

## 9. Collection — CRUD

- Une instance Collection = un YAML d'import (`appSlug: Collection`).
- Opérations : `Collection.find`, `Collection.insert`, `Collection.updateOne`, `Collection.deleteMany`. **Pas de `findOne`** → `find` + `options.limit: 1` + `[0]`.
- `deleteMany` query vide → workaround `{ field: { $ne: "__none__" } }`.
- `insert` retourne `{acknowledged, insertedId}` → utiliser `{{result.insertedId}}`, **pas** `{{result._id}}`.
- **Champs non déclarés au schéma = strippés silencieusement.** Déclarer tout champ qu'on veut persister.
- `type: number` = int32 Postgres → ne pas y mettre des timestamps ms (déborde). ISO string en `type: text`.

---

## 10. Pages DSUL — dépréciées

- **`pages/*.yml` (Pages = stack de blocks) = déprécié** (confirmé mai 2026). Marchent encore en runtime, mais **ne plus en créer**.
- Pour toute nouvelle interface : app React dans `pages/<workspace>/` (dossier top-level frère de `workspaces/`, nommé d'après le workspace ; pattern starter-spa, skill `/app-dev`). Pour un endpoint webhook consommé par l'app React : `automations/v1/<myAction>.yml`, pas une Page.
- Les patterns Pages historiques ne valent plus que pour la **maintenance/debug** de Pages legacy : layout Kanban via HTML en CC rendu par RichText `allowUnsecure: true` ; `automation:` sur un block (appel à l'init) + `updateOn:` (ré-appel sur event) ; `session.xxx` persiste entre rendus ; `repeat:`/`if:` sur un block.

---

## Checklist anti-régression (avant push)

1. Aucun `? :`, `[]`, `|| []`, `{{` littéral dans un `{% %}`/`{{ }}`/condition.
2. Aucune comparaison `"{{var}}"` dans une condition.
3. Guard "vide" via `!{{var}}` ou `.length`, JAMAIS `'{{var}} == ""'` (cassé sur valeur vide → §2.1).
4. `matches` : pattern **littéral** (aucun `{{}}` dedans), jamais négié si `.`/`/` — flag + `== "no"` (→ §2.2). Pour une URL Storage cross-instance : `matches "/v2/files/"`, pas de host en dur.
5. Aucune clé hyphénée en notation pointée.
6. Aucune variable interne nommée `output`.
7. Aucun `break: { scope: all }`.
8. Aucun `date()` sans argument → `{{run.date}}`.
9. État durable par user → module `secrets`, pas `scope: user`.
10. Custom Code : pas de `#`, pas de `type: array`/`oneOf`, **pas de `description` fonction-level** (§8.7bis), fonctions vérifiées appelables après push (deploy = push + bump clé racine `lastDeploySync` pour forcer le vrai diff → §8.5).
11. Collection : champs déclarés au schéma, `insertedId` pas `_id`.
12. Lancer `validate_automation` — puis se rappeler qu'il ne couvre AUCUNE règle ci-dessus.
