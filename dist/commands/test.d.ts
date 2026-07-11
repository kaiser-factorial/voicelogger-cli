/**
 * `voicelogger test <path>` — detect the project at <path>, get its dev server (or an
 * already-built CLI binary) ready, open it in the browser if applicable, then hand off to
 * `record --test-log` in-process. See docs/TEST_LOG_PLAN.md Phase 1b for the full design.
 *
 *   voicelogger test <path> [--prod [<link>]] [--redetect] [record --test-log flags...]
 *
 * Any flag `record` understands (--project, --user, --title, --scope, --feature, --app,
 * --clean/--no-clean) is simply forwarded — `record`'s own arg parsing only looks for the
 * flag names it knows, so passing through `--prod`/`--redetect`/the path positional alongside
 * them is harmless.
 */
export declare function testCommand(args: string[]): Promise<void>;
