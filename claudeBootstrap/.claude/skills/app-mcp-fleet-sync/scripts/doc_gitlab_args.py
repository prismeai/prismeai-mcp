#!/usr/bin/env python3
"""Inject GitLab-accurate `description:` into every argument of the public op
automations of the gitlab connector. id/iid are resource-aware (derived from the
op name). Text injection after each `type:` line — preserves formatting, skips
args that already have a description. One-off; safe to re-run (idempotent)."""
import os, re, sys, glob

ARG_DESC = {
  "access_level": "Access level granted (10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner).",
  "actions": "Array of file actions for the commit (each: action, file_path, content).",
  "active": "Whether the resource is active (boolean).",
  "all_available": "If true, include all accessible groups, not just owned ones (boolean).",
  "assignee_ids": "Array of user IDs to assign.",
  "assignee_username": "Username of the assignee to filter by.",
  "author": "Filter by author.",
  "author_email": "Email of the commit author.",
  "author_name": "Name of the commit author.",
  "blocked": "Filter by blocked state (boolean).",
  "body": "Body text of the note/comment (Markdown supported).",
  "branch": "Name of the branch.",
  "can_push": "Whether the deploy key may push to the repository (boolean).",
  "color": "Label color as a 6-digit hex code (e.g. #FF0000) or a CSS color name.",
  "commit_message": "Commit message.",
  "confidential": "Whether the issue is confidential (boolean).",
  "content": "Content of the file or wiki page.",
  "default_branch": "Name of the default branch (e.g. main).",
  "description": "Description text (Markdown supported).",
  "dry_run": "If true, validate without applying changes (boolean).",
  "due_date": "Due date in ISO format (YYYY-MM-DD).",
  "enable_ssl_verification": "Whether to verify SSL when delivering webhook payloads (boolean).",
  "environment_id": "ID of the environment.",
  "environment_scope": "Environment scope the variable applies to (e.g. * or production).",
  "expires_at": "Expiration date in ISO format (YYYY-MM-DD).",
  "filter[environment_scope]": "Filter by environment scope.",
  "format": "Output/archive format.",
  "groupPath": "URL-encoded full path of the group (e.g. group%2Fsubgroup).",
  "hook_id": "ID of the project webhook (hook).",
  "initialize_with_readme": "If true, create an initial commit with a README (boolean).",
  "issues_events": "Trigger the webhook on issue events (boolean).",
  "job_events": "Trigger the webhook on job events (boolean).",
  "job_id": "ID of the CI/CD job.",
  "key": "Variable key, or the SSH public key for a deploy key.",
  "key_id": "ID of the deploy key.",
  "label_id": "ID or name of the label.",
  "labels": "Comma-separated list of label names.",
  "masked": "Whether the variable value is masked in job logs (boolean).",
  "membership": "If true, limit to projects the current user is a member of (boolean).",
  "merge_commit_message": "Custom merge commit message.",
  "merge_requests_events": "Trigger the webhook on merge request events (boolean).",
  "merge_when_pipeline_succeeds": "If true, merge automatically once the pipeline succeeds (boolean).",
  "message": "Message text (e.g. tag or commit message).",
  "milestone": "Milestone title to filter by.",
  "milestone_id": "ID of the milestone.",
  "min_access_level": "Limit to resources where the user has at least this access level (10/20/30/40/50).",
  "name": "Name of the resource (project, group, label, etc.).",
  "namespace": "Namespace (group or user path) to fork into.",
  "namespace_id": "ID of the namespace (group) to create the project in.",
  "new_name": "New name to rename the resource to.",
  "note_events": "Trigger the webhook on comment/note events (boolean).",
  "note_id": "ID of the note (comment).",
  "order_by": "Field to order results by (e.g. created_at, updated_at).",
  "owned": "If true, limit to resources owned by the current user (boolean).",
  "page": "Page number to retrieve, 1-based (pagination).",
  "parent_id": "ID of the parent group (when creating a subgroup).",
  "path": "URL path/slug of the resource (e.g. project path).",
  "per_page": "Number of items per page (1-100, default 20).",
  "pipeline_events": "Trigger the webhook on pipeline events (boolean).",
  "pipeline_id": "ID of the pipeline.",
  "priority": "Priority of the label (integer).",
  "protected": "Whether the variable or branch is protected (boolean).",
  "push_events": "Trigger the webhook on push events (boolean).",
  "query": "Search query string.",
  "raw": "If true, return the raw value without variable expansion (boolean).",
  "ref": "Git reference: branch name, tag, or commit SHA.",
  "ref_name": "Branch or tag name to filter by.",
  "released_at": "Release date/time in ISO 8601 format.",
  "remove_source_branch": "If true, remove the source branch after merge (boolean).",
  "render_html": "If true, return rendered HTML for the wiki page (boolean).",
  "reviewer_ids": "Array of user IDs to set as reviewers.",
  "scope": "Scope filter (e.g. for jobs: created, pending, running, failed, success).",
  "search": "Search query to filter results.",
  "sha": "Commit SHA.",
  "should_remove_source_branch": "If true, remove the source branch after merge (boolean).",
  "since": "Only include results after this ISO 8601 date.",
  "slug": "URL slug of the wiki page.",
  "sort": "Sort direction: asc or desc.",
  "source_branch": "Name of the source branch.",
  "squash": "If true, squash commits on merge (boolean).",
  "squash_commit_message": "Custom squash commit message.",
  "start_branch": "Branch to start the new commit from.",
  "start_date": "Start date in ISO format (YYYY-MM-DD).",
  "start_sha": "Starting commit SHA.",
  "state": "Filter by state (issues: opened/closed/all; merge requests: opened/closed/locked/merged/all).",
  "state_event": "State transition to apply (issues: close/reopen; merge requests: close/reopen).",
  "states": "Filter by one or more states.",
  "status": "Filter by status.",
  "tag_name": "Name of the tag.",
  "tag_push_events": "Trigger the webhook on tag push events (boolean).",
  "target_branch": "Name of the target branch.",
  "title": "Title (e.g. of the issue, merge request, milestone, or release).",
  "token": "Secret token sent with webhook deliveries for verification.",
  "top_level_only": "If true, return only top-level groups (boolean).",
  "until": "Only include results before this ISO 8601 date.",
  "url": "Target URL the webhook posts to.",
  "user_id": "ID of the user.",
  "username": "Username of the user.",
  "value": "Value of the CI/CD variable.",
  "variable_type": "Type of variable: env_var or file.",
  "variables": "Array of pipeline variables (each: key, value).",
  "version": "Version identifier.",
  "visibility": "Visibility level: private, internal, or public.",
  "wiki_page_events": "Trigger the webhook on wiki page events (boolean).",
  "with_content": "If true, include the wiki page content (boolean).",
  "with_counts": "If true, include issue counts per label (boolean).",
}

HELPERS = {"method-restOp","method-graphqlOp","tool-restOp","tool-graphqlOp","mcp","onInstall",
  "generateKey","getConfig","buildAppAuth","executeApiCall","handleApiError","formatToolOutput",
  "routeToolCall","ensureAuthentication","connect","disconnect","initiateOAuth","oauthCallback",
  "checkAuthStatus","refreshOAuthToken","disconnectOAuth","method-connect","method-disconnect",
  "tool-connect","tool-disconnect"}

def id_desc(op):
    o = op.lower()
    if "group" in o:  # group, subgroup, descendantgroup
        return "ID or URL-encoded path of the group (e.g. 42 or group%2Fsubgroup)."
    if "user" in o:
        return "ID or username of the user."
    return "ID or URL-encoded path of the project (e.g. 42 or group%2Fproject)."

def iid_desc(op):
    if "MergeRequest" in op:
        return "Internal ID (iid) of the merge request within its project."
    if "Issue" in op:
        return "Internal ID (iid) of the issue within its project."
    return "Internal ID (iid) of the resource within its project."

def yq(s):  # YAML single-quoted scalar
    return "'" + s.replace("'", "''") + "'"

def desc_for(op, arg):
    if arg == "id":  return id_desc(op)
    if arg == "iid": return iid_desc(op)
    if arg in ARG_DESC: return ARG_DESC[arg]
    return arg.replace("_", " ").strip().capitalize() + "."

def process(path):
    op = os.path.basename(path)[:-4]
    with open(path) as f:
        lines = f.readlines()
    out, i, n, changed = [], 0, len(lines), 0
    in_args = False
    cur_arg = None
    while i < n:
        ln = lines[i]
        if re.match(r"^arguments:\s*$", ln):
            in_args = True; out.append(ln); i += 1; continue
        if in_args and re.match(r"^[^\s#]", ln):  # dedent to top-level key -> end of args
            in_args = False
        if in_args:
            m = re.match(r"^  ([^\s][^:]*):\s*$", ln)  # 2-space arg key
            if m:
                cur_arg = m.group(1)
                out.append(ln); i += 1; continue
            if cur_arg and re.match(r"^    type:\s*\S+\s*$", ln):
                out.append(ln)
                # peek: is there already a description for this arg?
                nxt = lines[i+1] if i+1 < n else ""
                if not re.match(r"^    description:", nxt):
                    out.append("    description: " + yq(desc_for(op, cur_arg)) + "\n")
                    changed += 1
                i += 1; continue
        out.append(ln); i += 1
    if changed:
        with open(path, "w") as f:
            f.writelines(out)
    return changed

if __name__ == "__main__":
    folder = sys.argv[1]
    total_files, total_args = 0, 0
    for path in sorted(glob.glob(os.path.join(folder, "automations", "*.yml"))):
        op = os.path.basename(path)[:-4]
        if op in HELPERS: continue
        with open(path) as f:
            if "\narguments:" not in f.read() and not open(path).read().startswith("arguments:"):
                pass
        with open(path) as f:
            if "arguments:" not in f.read(): continue
        c = process(path)
        if c: total_files += 1; total_args += c
    print(f"patched {total_args} args across {total_files} op files")
