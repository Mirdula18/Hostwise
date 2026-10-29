import {
  MAX_QUESTIONS,
  nextFallbackQuestion,
  questionFor,
  REQUIRED_ORDER,
} from "../../src/lib/intakeFallback";
import { NextQuestion } from "../../src/schemas/ai";

const required = {
  occasion: "kids_birthday",
  date: "2026-12-20",
  guestCount: 25,
  totalBudget: 1_000_000,
  currency: "INR",
  priorities: ["food", "entertainment"],
} as const;

describe("intake fallback", () => {
  it("asks required fields first, in order", () => {
    expect(nextFallbackQuestion({}, []).field).toBe("occasion");
    expect(nextFallbackQuestion({ occasion: "birthday" }, ["occasion"]).field).toBe("date");
    const asked: string[] = [];
    let answers = {};
    for (const field of REQUIRED_ORDER) {
      expect(nextFallbackQuestion(answers, asked).field).toBe(field);
      answers = { ...answers, [field]: required[field as keyof typeof required] };
      asked.push(field);
    }
  });

  it("asks different follow-ups for a kid's birthday and an anniversary", () => {
    const kids = nextFallbackQuestion({ ...required, priorities: ["food"] }, []);
    const anniversary = nextFallbackQuestion(
      { ...required, occasion: "anniversary", priorities: ["food"] },
      ["ageMix"],
    );
    expect(kids.field).toBe("ageMix");
    expect(anniversary.field).toBe("accessibility");
  });

  it("finishes after the optional questions or the question limit", () => {
    const answers = { ...required, priorities: ["food" as const] };
    expect(nextFallbackQuestion(answers, ["ageMix", "dietary", "setting", "title"])).toEqual({
      done: true,
    });
    expect(nextFallbackQuestion(answers, Array(MAX_QUESTIONS).fill("x"))).toEqual({ done: true });
  });

  it("produces questions that satisfy the AI NextQuestion schema", () => {
    expect(NextQuestion.safeParse(questionFor("priorities")).success).toBe(true);
    expect(questionFor("priorities").options).toContain("guest_comfort");
    expect(questionFor("date").options).toBeUndefined();
  });
});
