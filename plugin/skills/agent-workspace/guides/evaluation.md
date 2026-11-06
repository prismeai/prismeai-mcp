# Evaluation: a bench method, not a single run

The evaluation module runs the agent on a case set through Agent Evaluations, in small batches, and
keeps every answer, score and judge reason in workspace state. Contract: `templates/workspace/DESIGN.md`
§3 and §5.1. Console: the optional Bench view.

## 1. Cases

- `_content-agent-tests` (agent content) returns `{tests: [{id, question, expected, criteria, tags}]}`; or post them to
  `importCases {cases}`. Ids must be stable: a replay compares the same ids.
- Build the set from **real questions** when they exist; stratify by source, question type, language
  and production outcome. 30 well-chosen cases give a cheap, stable signal; keep a small subset (`tags`)
  for iterations and the full set for releases.
- **Never commit client cases.** Keep `_content-agent-tests` as an empty stub in git; load the real set on the
  environment through `importCases`.

## 2. Running a bench

```text
importCases {}                           → {count, hash}
runBenchmark {agents?, tags?, limit?}    → {benchId, queued}
pollBenchmark (schedule) / advanceBenchmark (endpoint, faster)
benchmarkReport {benchId?}               → scores per agent, worst cases with judge reasons
exportBenchmark {benchId?}               → JSONL file: question, answer, expected, score, reasons, tokens, duration
```

- One bench at a time; `force` (admin-only) abandons the running one.
- Each tick starts at most one batch (Agent Evaluations derives ids from the execution), within
  `runner.messagesPerHour`; error-like results are retried up to `runner.maxAttempts`.
- `controlBenchmark {action: pause | resume | stop | abandon}`; `runBenchmark {onlyErrored: true}`
  replays the errored cases of a bench.
- Variants (`variantOf` agents, optional in the manifest) are benched side by side to compare a model
  or a prompt change on the same cases.

- **Agent Evaluations plays the cases without your session.** A run calls the agent asynchronously, so
  the product needs an organization API key of its own to reach the agent; without it every case
  ends `AGENT_ERROR` (« Run has no user session … not an org API key »). The bench then marks the agent
  `rejected`, the console says so in plain words and offers « Rejouer les cas en erreur ». Check this
  on a new environment with a two-case bench before loading the real set.

## 3. Why the workspace batches on top of Agent Evaluations

Agent Evaluations stays the system of record (cases, runs, judge, results). The workspace adds only
what one product run does not give a bench, as observed in production:

- **Comparable agents on the same cases.** One run evaluates one agent's case set; comparing a variant
  means several runs whose cases must stay identical: the bench owns the case list and replays it.
- **A pace the platform can sustain.** Long runs of many cases stalled and hit message limits; small
  batches within `messagesPerHour`, one in flight per agent, finish reliably.
- **Ids imposed by the execution.** Agent Evaluations derives case and run ids from the execution, so
  one execution starts one batch; the queue is what lets the next batch start later.
- **Results kept after the product purges runs** (only the last runs per agent are kept), for the
  report and the JSONL export.
- **Pause, stop and replay of the errored cases only**, which a single run does not offer.

When none of these applies (one agent, a few cases, no comparison), start one run with
`Evaluation.startRun` and read its results: the bench is not needed.

## 4. Method

1. Run a **baseline** before changing anything.
2. Change **one thing** per iteration (prompt rule, limit, model, retrieval tool).
3. Compare **question by question**, not only the average; read the judge's reasons on every drop
   before concluding. A one-point move can be judge noise; report it as noise.
4. Measure what the judge does not: answer language, empty answers, tool names leaking into answers.
   Read them from the export.
5. Estimate cost before a run (cases × agents × average tokens).

The bench is a thin process on top of Agent Evaluations; the product stays the system of record for
cases and runs.
