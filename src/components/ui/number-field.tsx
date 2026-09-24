"use client"

import * as React from "react"
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field"
import { cn } from "cn"
import { MinusIcon, PlusIcon } from "lucide-react"

// A number input with − and + buttons, styled to match Input.
function NumberField({
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: NumberFieldPrimitive.Root.Props & {
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const stepButton =
    "flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5"

  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      className={cn("w-fit", className)}
      {...props}
    >
      <NumberFieldPrimitive.Group
        data-invalid={ariaInvalid || undefined}
        className="flex h-8 items-center gap-1 rounded-lg border border-input px-1 transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 dark:bg-input/30"
      >
        <NumberFieldPrimitive.Decrement aria-label="Decrease" className={stepButton}>
          <MinusIcon />
        </NumberFieldPrimitive.Decrement>
        <NumberFieldPrimitive.Input
          id={id}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className="w-12 min-w-0 bg-transparent text-center text-base tabular-nums outline-none md:text-sm"
        />
        <NumberFieldPrimitive.Increment aria-label="Increase" className={stepButton}>
          <PlusIcon />
        </NumberFieldPrimitive.Increment>
      </NumberFieldPrimitive.Group>
    </NumberFieldPrimitive.Root>
  )
}

export { NumberField }
