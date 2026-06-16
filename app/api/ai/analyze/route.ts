import { NextResponse } from "next/server";

type OpenAITextPart = {
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAITextPart[];
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        input: prompt,
        temperature: 0.2,
      }),
    });

    const data = (await response.json()) as OpenAIResponseBody;
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "OpenAI request failed." }, { status: response.status });
    }

    const text = data?.output_text
      ?? data?.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("")
      ?? "";

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
