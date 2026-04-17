import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface Metrics {
  avgHipHinge: number;
  avgWeightDistribution: number; // 0-1, where 0.5 is balanced, >0.5 is front-weighted
  avgGuardHeight: number; // positive = hands above nose, negative = dropped
  chinExposure: number; // 0-1, lower = more tucked
  stanceWidth: number; // ratio of ankle width to shoulder width
  shoulderRotation: number; // degrees, higher = more side-on
  duration: number; // seconds
}

async function searchBoxingBrain(query: string, limit = 5): Promise<string> {
  try {
    // Try keyword search since we may not have RPC set up
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("content")
      .ilike("content", `%${query}%`)
      .limit(limit);

    if (error || !data || data.length === 0) {
      // Try broader search terms
      const terms = query.split(" ").slice(0, 2);
      for (const term of terms) {
        const { data: fallback } = await supabase
          .from("knowledge_chunks")
          .select("content")
          .ilike("content", `%${term}%`)
          .limit(limit);
        if (fallback && fallback.length > 0) {
          return fallback.map((c) => c.content).join("\n\n");
        }
      }
      return "";
    }

    return data.map((c) => c.content).join("\n\n");
  } catch {
    return "";
  }
}

function buildSearchQuery(metrics: Metrics): string {
  const issues: string[] = [];

  if (metrics.avgHipHinge < 155) issues.push("hip hinge posture stance");
  if (metrics.avgWeightDistribution > 0.65 || metrics.avgWeightDistribution < 0.35)
    issues.push("weight distribution balance footwork");
  if (metrics.chinExposure > 0.6) issues.push("chin guard head position defence");
  if (metrics.avgGuardHeight < -0.05) issues.push("guard hands up defence");
  if (metrics.stanceWidth < 1.2) issues.push("stance width footwork balance");
  if (metrics.shoulderRotation < 20) issues.push("shoulder rotation orthodox stance");

  return issues.length > 0
    ? issues.join(" ")
    : "boxing stance fundamentals posture guard";
}

function metricsToText(metrics: Metrics): string {
  const frontPct = Math.round(metrics.avgWeightDistribution * 100);
  const backPct = 100 - frontPct;
  const chinStatus = metrics.chinExposure < 0.5 ? "tucked (good)" : "exposed (needs improvement)";
  const guardStatus = metrics.avgGuardHeight > -0.03 ? "high (good)" : "dropped (needs improvement)";
  const stanceStatus = metrics.stanceWidth >= 1.2 ? "wide enough" : "too narrow";
  const shoulderStatus = metrics.shoulderRotation >= 25 ? "good rotation (side-on)" : "needs more rotation";

  return `
Boxing Form Analysis Metrics:
- Hip Hinge Angle: ${metrics.avgHipHinge.toFixed(1)}° (ideal: 155-175°, slight forward lean)
- Weight Distribution: Front ${frontPct}% / Back ${backPct}% (ideal: ~55-60% front)
- Guard Height: ${guardStatus} (wrists vs nose level: ${(metrics.avgGuardHeight * 100).toFixed(0)}%)
- Chin Position: ${chinStatus} (exposure score: ${(metrics.chinExposure * 100).toFixed(0)}%)
- Stance Width: ${stanceStatus} (${metrics.stanceWidth.toFixed(2)}x shoulder width, ideal: 1.3-1.7x)
- Shoulder Rotation: ${metrics.shoulderRotation.toFixed(1)}° from horizontal (${shoulderStatus}, ideal: 25-45° side-on)
- Clip Duration: ${metrics.duration.toFixed(1)}s
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { metrics } = body as { metrics: Metrics };

    if (!metrics) {
      return NextResponse.json({ error: "Missing metrics" }, { status: 400 });
    }

    // Search the Boxing Brain for relevant knowledge
    const searchQuery = buildSearchQuery(metrics);
    const boxingBrainContext = await searchBoxingBrain(searchQuery, 6);

    const metricsText = metricsToText(metrics);

    const systemPrompt = `You are an expert boxing coach at Oracle Boxing. You analyse a student's form based on pose detection metrics and provide clear, actionable coaching feedback.

Be direct, specific, and encouraging. Focus on 2-3 key improvements. Use simple language the student can act on immediately.

Format your response with:
1. A brief overall assessment (1-2 sentences)
2. Key strengths (what they're doing well)
3. Priority fixes (most important things to address, max 3)
4. One drill or exercise to work on

Keep the total response under 300 words. No bullet walls - be conversational.`;

    const userMessage = boxingBrainContext
      ? `Here are the pose analysis metrics from a student's boxing video:\n\n${metricsText}\n\nRelevant coaching context from the Oracle Boxing knowledge base:\n${boxingBrainContext}\n\nPlease provide coaching feedback based on these metrics.`
      : `Here are the pose analysis metrics from a student's boxing video:\n\n${metricsText}\n\nPlease provide coaching feedback based on these metrics.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      system: systemPrompt,
    });

    const feedback =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({
      feedback,
      metrics,
      searchQuery,
      hasBoxingBrainContext: boxingBrainContext.length > 0,
    });
  } catch (err) {
    console.error("Analysis review error:", err);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
