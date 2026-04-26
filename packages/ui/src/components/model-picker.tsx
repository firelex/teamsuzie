import * as React from "react"

import { cn } from "../lib/utils"

export interface ModelPricing {
  /** USD per 1M input tokens. */
  inputPer1M: number
  /** USD per 1M output tokens. */
  outputPer1M: number
  /** Free-form note to display under the price (e.g. "approximate; see provider"). */
  note?: string
}

export interface ModelOption {
  /** Model id sent to the chat backend (e.g. "qwen3.6-plus", "anthropic/claude-sonnet-4-6"). */
  id: string
  /** Display name. */
  name: string
  /** Provider label (e.g. "Anthropic", "Alibaba (Dashscope)"). */
  provider: string
  /** One-line description shown under the name. */
  description?: string
  pricing?: ModelPricing
  /** Optional link to provider pricing page. */
  pricingUrl?: string
}

/**
 * Starter model list — three commonly-used frontier-grade options spanning a
 * wide cost band. Apps free to override or extend. Pricing values are
 * approximate and meant for orientation, not billing — `pricingUrl` always
 * points at the provider's actual pricing page so users can verify.
 */
export const DEFAULT_MODELS: ModelOption[] = [
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    description: "Strong on tool use, long-form drafting, and structured output.",
    pricing: { inputPer1M: 3, outputPer1M: 15, note: "approx." },
    pricingUrl: "https://www.anthropic.com/pricing",
  },
  {
    id: "openai/gpt-5.5",
    name: "GPT-5.5",
    provider: "OpenAI",
    description: "Reliable at structured tool use; broadly available.",
    pricing: { inputPer1M: 2.5, outputPer1M: 10, note: "approx." },
    pricingUrl: "https://openai.com/api/pricing/",
  },
  {
    id: "qwen3.6-plus",
    name: "Qwen 3.6-Plus",
    provider: "Alibaba (Dashscope)",
    description: "Strong reasoning at a fraction of the cost of US frontier models.",
    pricing: { inputPer1M: 0.4, outputPer1M: 1.2, note: "approx." },
    pricingUrl:
      "https://www.alibabacloud.com/help/en/model-studio/billing-of-model-studio",
  },
]

function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2).replace(/\.00$/, "")}`
  return `$${value.toFixed(2)}`
}

/**
 * Radio-style picker for selecting a chat model. The picker is purely
 * presentational — apps own the list of options, where pricing comes from,
 * and how the selection is persisted (localStorage, user prefs, etc.).
 *
 * Pricing values are display-only. Hard numbers tend to drift; treat them as
 * informational and keep `pricingUrl` set so users can verify on the
 * provider's actual pricing page.
 */
export function ModelPicker({
  models,
  selected,
  onSelect,
  className,
}: {
  models: ModelOption[]
  selected?: string
  onSelect: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)} role="radiogroup">
      {models.map((model) => {
        const isSelected = model.id === selected
        return (
          <button
            key={model.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(model.id)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
              isSelected
                ? "border-foreground/30 ring-1 ring-foreground/10"
                : "border-border hover:border-foreground/20 hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                isSelected ? "border-foreground" : "border-muted-foreground/40",
              )}
              aria-hidden="true"
            >
              {isSelected && <span className="size-2 rounded-full bg-foreground" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {model.name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {model.provider}
                  </div>
                </div>
                {model.pricing && (
                  <div className="shrink-0 text-right text-[11px]">
                    <div className="font-mono text-foreground">
                      {formatUsd(model.pricing.inputPer1M)} /{" "}
                      {formatUsd(model.pricing.outputPer1M)}
                    </div>
                    <div className="text-muted-foreground">per 1M tokens</div>
                  </div>
                )}
              </div>
              {model.description && (
                <div className="text-xs text-muted-foreground">{model.description}</div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="font-mono">{model.id}</span>
                {model.pricingUrl && (
                  <a
                    href={model.pricingUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Verify pricing →
                  </a>
                )}
                {model.pricing?.note && <span>{model.pricing.note}</span>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
