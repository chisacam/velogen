import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import type { AgentProvider } from "@velogen/shared";

/**
 * 각 AI 에이전트 CLI와 통신하는 서비스.
 *
 * 프롬프트는 공통적으로 stdin으로 전달됩니다.
 * CLI 도구들은 환경변수가 아닌 stdin/인자(arg)를 통해 프롬프트를 받기 때문입니다.
 *
 * ## 환경변수 설정 (.env 참조)
 *
 * ### Claude (Anthropic Claude Code CLI)
 * - `CLAUDE_COMMAND`  명령어 경로 (기본: `claude`)
 * - `CLAUDE_MODEL`    모델 이름 (예: `claude-opus-4-5`, 기본: Claude 기본값)
 * - Claude의 MCP 서버 설정은 `~/.claude/claude_desktop_config.json` 또는
 *   프로젝트 루트의 `.mcp.json`에 작성하면 자동으로 적용됩니다.
 *
 * ### Codex (OpenAI Codex CLI)
 * - `CODEX_COMMAND`   명령어 경로 (기본: `codex`)
 * - `CODEX_MODEL`     모델 이름 (예: `o4-mini`, 기본: Codex 기본값)
 *
 * ### Opencode
 * - `OPENCODE_COMMAND` 명령어 경로 (기본: `opencode`)
 * - `OPENCODE_MODEL`   모델 이름 (예: `anthropic/claude-sonnet-4-5`)
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  /** 프롬프트를 지정된 프로바이더 CLI에 전달하고 결과를 반환합니다. */
  async run(prompt: string, provider: Exclude<AgentProvider, "mock">): Promise<string> {
    const { command, args, stdinInput, model } = this.resolveCommand(provider, prompt);

    this.logger.log(`[${provider}] Running: ${command}${model ? ` (model: ${model})` : ""}`);

    try {
      const output = await this.spawnWithStdin(command, args, stdinInput);

      if (output.length === 0) {
        this.logger.warn(`[${provider}] Empty output, falling back to mock`);
        return this.fallback(prompt, provider);
      }

      return output;
    } catch (error) {
      this.logger.warn(
        `[${provider}] Failed — ${error instanceof Error ? error.message : String(error)}`
      );
      return this.fallback(prompt, provider);
    }
  }

  async runStream(
    prompt: string,
    provider: Exclude<AgentProvider, "mock">,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const { command, args, stdinInput, model } = this.resolveCommand(provider, prompt);

    this.logger.log(`[${provider}] Running(stream): ${command}${model ? ` (model: ${model})` : ""}`);

    try {
      const output = await this.spawnWithStdin(command, args, stdinInput, onChunk);

      if (output.length === 0) {
        this.logger.warn(`[${provider}] Empty output, falling back to mock`);
        const fallback = this.fallback(prompt, provider);
        onChunk(fallback);
        return fallback;
      }

      return output;
    } catch (error) {
      this.logger.warn(
        `[${provider}] Stream failed — ${error instanceof Error ? error.message : String(error)}`
      );
      const fallback = this.fallback(prompt, provider);
      onChunk(fallback);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * 각 프로바이더에 맞는 CLI 명령어, 인자, stdin 입력을 반환합니다.
   *
   * 공통 규칙: 프롬프트는 stdin으로 전달합니다.
   * 예외:
   * - gemini: `--prompt <text>` 형태로 인자에 직접 포함해야 합니다.
   *   `gemini --prompt` 만 실행하면 "Not enough arguments following: prompt" 에러 발생.
   */
  private resolveCommand(
    provider: Exclude<AgentProvider, "mock">,
    prompt: string
  ): {
    command: string;
    args: string[];
    stdinInput: string;
    model: string | undefined;
  } {
    switch (provider) {
      case "claude": {
        /**
         * Claude Code CLI 비대화형 모드.
         * `--print` 플래그로 응답만 출력하고 종료합니다.
         * MCP 서버는 `~/.claude/claude_desktop_config.json` 또는 프로젝트의
         * `.mcp.json`에 설정하면 claude가 자동으로 읽습니다.
         */
        const command = process.env.CLAUDE_COMMAND ?? "claude";
        const args = ["--print", "--skip-git-repo-check"];
        const model = process.env.CLAUDE_MODEL;
        if (model) args.push("--model", model);
        return { command, args, stdinInput: prompt, model };
      }

      case "codex": {
        /**
         * OpenAI Codex CLI 비대화형 모드.
         * `--approval-mode full-auto` 로 사람의 승인 없이 자동 실행합니다.
         */
        const command = process.env.CODEX_COMMAND ?? "codex";
        const args = ["exec", "--full-auto", "--skip-git-repo-check"];
        const model = process.env.CODEX_MODEL;
        if (model) args.push("--model", model);
        return { command, args, stdinInput: prompt, model };
      }

      case "opencode": {
        /**
         * Opencode CLI.
         * `run` 서브커맨드로 단일 프롬프트를 실행합니다.
         */
        const command = process.env.OPENCODE_COMMAND ?? "opencode";
        const args = ["run"];
        const model = process.env.OPENCODE_MODEL;
        if (model) args.push("--model", model);
        return { command, args, stdinInput: prompt, model };
      }

      case "gemini": {
        /**
         * Gemini CLI 비대화형 모드.
         * `--prompt <text>` 형태로 반드시 인자에 직접 포함해야 합니다.
         * stdin만 보내면 "Not enough arguments following: prompt" 에러 발생.
         * stdin은 사용하지 않으므로 빈 문자열로 둡니다.
         */
        const command = process.env.GEMINI_COMMAND ?? "gemini";
        const args: string[] = ["--prompt", prompt];
        const model = process.env.GEMINI_MODEL;
        if (model) args.push("--model", model);
        return { command, args, stdinInput: "", model };
      }
    }
  }

  /**
   * 자식 프로세스를 생성하고 stdin으로 입력을 전달한 뒤 stdout을 수집합니다.
   * 타임아웃은 5분입니다.
   */
  private spawnWithStdin(
    command: string,
    args: string[],
    input: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: homedir(),
        env: { ...process.env }
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const settle = (fn: () => void): void => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      // 5분 타임아웃
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        settle(() => reject(new Error("Agent process timed out (5 min)")));
      }, 300_000);

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        if (onChunk && text.length > 0) {
          onChunk(text);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        // stdout 우선, 없으면 stderr 사용 (일부 CLI는 stderr로 출력)
        const output = (stdout.trim().length > 0 ? stdout : stderr).trim();
        if (onChunk && stdout.trim().length === 0 && output.length > 0) {
          onChunk(output);
        }
        if (code === 0) {
          settle(() => resolve(output));
        } else {
          settle(() =>
            reject(
              new Error(
                `Process exited with code ${code ?? "null"}: ${stderr.slice(0, 400) || "(no stderr)"}`
              )
            )
          );
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        settle(() => reject(err));
      });

      // stdin으로 프롬프트 전달 후 닫기
      try {
        child.stdin.write(input, "utf8");
        child.stdin.end();
      } catch (writeErr) {
        child.kill();
        settle(() => reject(writeErr));
      }
    });
  }

  /** CLI 실패 시 사용자에게 원인을 안내하는 목 응답을 반환합니다. */
  private fallback(prompt: string, provider: string): string {
    const body = prompt.length > 1200 ? `${prompt.slice(0, 1200)}\n\n...(truncated)` : prompt;
    return [
      "# Generated Blog Draft (Fallback)",
      "",
      `> **주의**: \`${provider}\` 에이전트 실행에 실패하여 목 응답으로 대체되었습니다.`,
      ">",
      `> \`${provider}\` CLI가 설치되어 있고 PATH에 등록되어 있는지 확인하세요.`,
      "> 서버 로그에서 자세한 오류 내용을 확인할 수 있습니다.",
      "",
      "## 에이전트 설정 방법",
      "",
      "**Claude**: `npm install -g @anthropic-ai/claude-code` 후 `claude --print` 동작 확인",
      "**Codex**: `npm install -g @openai/codex` 후 `codex --approval-mode full-auto` 동작 확인",
      "**Opencode**: 공식 문서에 따라 설치 후 `opencode run` 동작 확인",
      "**Gemini**: `npm install -g @google/gemini-cli` 후 `gemini` 동작 확인",
      "",
      "## 포함된 컨텍스트 (디버그용)",
      "",
      "```",
      body,
      "```"
    ].join("\n");
  }
}
