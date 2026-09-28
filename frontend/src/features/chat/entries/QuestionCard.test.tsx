import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import { api, type QuestionEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

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
        { label: "Types", description: "" },
      ],
      multiSelect: true,
    },
  ],
});

describe("QuestionCard", () => {
  it("shows the question with its options", () => {
    renderWithStore(<QuestionCard stage="prd" taskId="task-1" question={question()} />);

    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Which database?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /SQLite/ })).toBeInTheDocument();
    expect(screen.getByText("One file, no server")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Other…" })).toBeInTheDocument();
  });

  it("waits for an answer before it can be sent", async () => {
    const { user } = renderWithStore(
      <QuestionCard stage="prd" taskId="task-1" question={question()} />,
    );

    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /SQLite/ }));

    expect(screen.getByRole("button", { name: "Answer" })).toBeEnabled();
  });

  it("sends the option that was picked", async () => {
    const { user } = renderWithStore(
      <QuestionCard stage="prd" taskId="task-1" question={question()} />,
    );

    await user.click(screen.getByRole("radio", { name: /Postgres/ }));
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "Postgres",
    });
  });

  it("keeps only the last option of a single choice", async () => {
    const { user } = renderWithStore(
      <QuestionCard stage="prd" taskId="task-1" question={question()} />,
    );

    await user.click(screen.getByRole("radio", { name: /SQLite/ }));
    await user.click(screen.getByRole("radio", { name: /Postgres/ }));
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "Postgres",
    });
  });

  it("joins the options of a multiple choice", async () => {
    const { user } = renderWithStore(<QuestionCard stage="prd" taskId="task-1" question={MULTI} />);

    await user.click(screen.getByRole("checkbox", { name: "Lint" }));
    await user.click(screen.getByRole("checkbox", { name: "Types" }));
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which checks?": "Lint, Types",
    });
  });

  it("takes an answer of the user's own", async () => {
    const { user } = renderWithStore(
      <QuestionCard stage="prd" taskId="task-1" question={question()} />,
    );

    await user.click(screen.getByRole("radio", { name: "Other…" }));

    const answer = screen.getByRole("textbox", { name: "Other answer for Database" });
    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();

    await user.type(answer, "DuckDB");
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "DuckDB",
    });
  });

  it("waits for every question of the batch", async () => {
    const both = question({
      questions: [
        {
          question: "Which database?",
          header: "Database",
          options: [{ label: "SQLite", description: "" }],
          multiSelect: false,
        },
        {
          question: "Which server?",
          header: "Server",
          options: [{ label: "Fiber", description: "" }],
          multiSelect: false,
        },
      ],
    });
    const { user } = renderWithStore(<QuestionCard stage="prd" taskId="task-1" question={both} />);

    await user.click(screen.getByRole("radio", { name: "SQLite" }));
    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Fiber" }));
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "SQLite",
      "Which server?": "Fiber",
    });
  });

  it("reports the answer once it is given", () => {
    renderWithStore(
      <QuestionCard
        stage="prd"
        taskId="task-1"
        question={question({ status: "allowed", answers: { "Which database?": "SQLite" } })}
      />,
    );

    expect(screen.getByText("Database: SQLite")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Answer" })).not.toBeInTheDocument();
  });

  it("says when the session stopped before an answer", () => {
    renderWithStore(
      <QuestionCard stage="prd" taskId="task-1" question={question({ status: "cancelled" })} />,
    );

    expect(screen.getByText("Cancelled before an answer")).toBeInTheDocument();
  });

  it("reads a question of an earlier conversation as text, with nothing to answer", () => {
    renderWithStore(<QuestionCard stage="prd" taskId="task-1" question={question()} readOnly />);

    expect(screen.getByText("Which database?")).toBeInTheDocument();
    expect(screen.getByText("SQLite")).toBeInTheDocument();
    expect(screen.getByText("· One file, no server")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives the answer of a question of an earlier conversation when there was one", () => {
    renderWithStore(
      <QuestionCard
        stage="prd"
        taskId="task-1"
        question={question({ status: "allowed", answers: { "Which database?": "Postgres" } })}
        readOnly
      />,
    );

    expect(screen.getByText("Which database?")).toBeInTheDocument();
    expect(screen.getByText("Database: Postgres")).toBeInTheDocument();
  });
});
