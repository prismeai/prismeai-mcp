# Agent Evaluations

Agent Evaluations is the automated evaluation product for Agent Factory agents. It stores reusable test cases, starts async evaluation runs, calls target agents through Agent Factory, judges responses through LLM Gateway, and stores per-case results, run scores, cost data, and regression summaries.

**Workspace:** `agent-evaluations` (`6TWWLly`)

## Core Model

| Entity | Collection | Purpose |
|--------|------------|---------|
| Test case | `eval_cases` | Agent-scoped prompts, expected outputs, criteria, tags, tool assertions, optional multi-turn conversation |
| Run | `eval_runs` | Async run status, progress, final score, duration, cost summary, regression data |
| Result | `eval_results` | Judged case output, score, pass/fail, criteria results, reasoning, token/cost/tool metadata |
| Batch | `eval_batches` | Scheduled multi-agent run scaffold |

## APIs And Flow

| API | Methods | Purpose |
|-----|---------|---------|
| `/v1/eval/cases` | `GET`, `POST`, `DELETE` | List/create cases; bulk delete by `agent_id` |
| `/v1/eval/cases/:case_id` | `GET`, `PATCH`, `DELETE` | Single-case CRUD |
| `/v1/eval/cases/import` | `POST` | Replace all cases for an agent from JSON |
| `/v1/eval/cases/export` | `GET` | Export cases as JSON |
| `/v1/eval/runs` | `GET`, `POST` | List runs or create a pending run and emit `eval.run.start` |
| `/v1/eval/runs/:run_id` | `GET`, `PATCH`, `DELETE` | Get, cancel, or delete a run |
| `/v1/eval/runs/:run_id/export` | `GET` | Export run results as CSV |

`POST /v1/eval/runs` emits `eval.run.start`; `_run-evaluation` loads enabled cases, calls Agent Factory, judges via `_judge-case`, stores results, updates progress, computes score/duration/cost, detects regression, and emits `eval.run.completed`.

## Judging And Scoring

Judging is LLM-as-judge through LLM Gateway. Scores are 0-100, with pass normally at 70. Multi-turn cases preserve a context ID across turns and average turn scores. Tool assertions can require or forbid tool calls and check argument matches.

## Maturity Notes

Core cases/runs APIs, async worker, LLM judge, multi-turn cases, tool assertions, run export, cost summary, and regression detection are implemented. Batch/nightly scheduling is scaffolded and should be documented conservatively.

Use Agent Evaluations for test cases, evaluation runs, scoring, exports, and regression tracking for Agent Factory agents.
