import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import { api, type QuestionEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

const AT = "2026-09-29T09:14:00Z";

function question(overrides: Partial<QuestionEntry> = {}): QuestionEntry {
  const entry = makeEntry("question");
  if (entry.question === null) {
    throw new Error("the question fixture has no payload");
  }
  return { ...entry.question, ...overrides };
}

const MULTI = question({
  questions: [
    {
      question: "Which checks?",
      header: "Checks",
      options: [
        { label: "Lint", description: "" },
        { label: "Tests", description: "" },
      ],
      multiSelect: true,
    },
  ],
});

const TWO = question({
  questions: [
    ...(question().questions ?? []),
    {
      question: "Which cache?",
      header: "Cache",
      options: [
        { label: "Redis", description: "" },
        { label: "None", description: "" },
      ],
      multiSelect: false,
    },
  ],
});

function card(q: QuestionEntry = question(), extra: { readOnly?: boolean; flash?: boolean } = {}) {
  return renderWithStore(
    <>
      <QuestionCard stage="prd" taskId="task-1" question={q} createdAt={AT} {...extra} />
      <textarea id="composer-input" aria-label="Composer" />
    </>,
  );
}

describe("QuestionCard pending", () => {
  it("shows the header, the question and the numbered options, Other… last", () => {
    card();

    expect(screen.getByRole("article", { name: "Question, answer with 1 to 3" })).toHaveAttribute(
      "data-pending-card",
      "question",
    );
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Which database?" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "1SQLiteOne file, no server",
      "2PostgresA server to run",
      "3Other…Write your own answer.",
    ]);
  });

  it("dashes Answer with what is missing until everything is chosen", async () => {
    const { user } = card();

    expect(screen.getByRole("button", { name: /Answer/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose an option")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /SQLite/ }));

    expect(screen.getByRole("radio", { name: /SQLite/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Answer/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("counts the questions left with several", async () => {
    const { user } = card(TWO);

    expect(screen.getByText("Answer 2 more questions")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /SQLite/ }));

    expect(screen.getByText("Answer 1 more question")).toBeInTheDocument();
  });

  it("sends the options picked and says it sends", async () => {
    let resolve: () => void = () => {};
    vi.mocked(api.answerQuestion).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { user } = card();

    await user.click(screen.getByRole("radio", { name: /Postgres/ }));
    await user.click(screen.getByRole("button", { name: /Answer/ }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "Postgres",
    });
    expect(screen.getByText("Sending “Postgres”…")).toBeInTheDocument();
    resolve();
  });

  it("tells the failure at its foot and gives Answer back", async () => {
    vi.mocked(api.answerQuestion).mockRejectedValueOnce(new Error("the session stopped"));
    const { user } = card();

    await user.click(screen.getByRole("radio", { name: /SQLite/ }));
    await user.click(screen.getByRole("button", { name: /Answer/ }));

    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Answer/ })).toBeInTheDocument();
    expect(useAppStore.getState().error).toBeNull();
  });

  it("toggles the checkboxes of a multiSelect", async () => {
    const { user } = card(MULTI);

    await user.click(screen.getByRole("checkbox", { name: /Lint/ }));
    await user.click(screen.getByRole("checkbox", { name: /Tests/ }));
    await user.click(screen.getByRole("button", { name: /Answer/ }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which checks?": "Lint, Tests",
    });
  });

  it("takes Other… to the composer, and shows the text the composer put there", async () => {
    const { user } = card();

    await user.click(screen.getByRole("radio", { name: /Other…/ }));

    expect(screen.getByRole("textbox", { name: "Composer" })).toHaveFocus();
    expect(useAppStore.getState().questionChoices["req-1"]).toEqual({
      0: { labels: [], other: "" },
    });

    useAppStore.getState().setQuestionChoices("req-1", { 0: { labels: [], other: "MySQL" } });

    expect(await screen.findByRole("radio", { name: /Other: MySQL/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("picks with the digits, walks round with the arrows and sends with Enter", async () => {
    const { user } = card();

    screen.getByRole("article").focus();
    await user.keyboard("2");

    expect(screen.getByRole("radio", { name: /Postgres/ })).toHaveAttribute("aria-checked", "true");

    screen.getByRole("radio", { name: /Other…/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /SQLite/ })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "Postgres",
    });
  });

  it("blinks when born with the screen open", () => {
    card(question(), { flash: true });

    expect(screen.getByRole("article")).toHaveAttribute("data-flash", "wait");
  });
});

describe("QuestionCard settled", () => {
  it("is a flat line per question with the answer, the time in the tooltip", async () => {
    const { user } = card(
      question({
        status: "allowed",
        answers: { "Which database?": "SQLite" },
        answeredAt: "2026-09-29T09:19:00Z",
      }),
    );

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Answer/ })).not.toBeInTheDocument();
    expect(screen.getByText("SQLite")).toBeInTheDocument();

    await user.hover(screen.getByText("Which database?"));

    expect(await screen.findByText(/^Answered at /)).toBeInTheDocument();
  });

  it("says a cancelled question", () => {
    card(question({ status: "cancelled" }));

    expect(screen.getByText("Cancelled before an answer")).toBeInTheDocument();
  });

  it("takes no answer in an earlier conversation", () => {
    card(question(), { readOnly: true });

    expect(screen.getByText("Which database?")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(document.querySelector("[data-pending-card]")).toBeNull();
  });
});
