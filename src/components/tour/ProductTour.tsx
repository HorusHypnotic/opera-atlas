import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TourStep } from "@/hooks/useProductTour";

interface ProductTourProps {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour({ isActive, currentStep, steps, onNext, onPrev, onSkip }: ProductTourProps) {
  const [targetRect, setTargetRect] = useState<Position | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive || !step) return;

    const findTarget = () => {
      if (step.placement === "center") {
        setTargetRect(null);
        return;
      }

      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });

        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    const timer = setTimeout(findTarget, 300);
    window.addEventListener("resize", findTarget);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", findTarget);
    };
  }, [isActive, currentStep, step]);

  if (!isActive || !step) return null;

  const isCenter = step.placement === "center";
  const progress = ((currentStep + 1) / steps.length) * 100;

  const getTooltipPosition = (): React.CSSProperties => {
    if (isCenter || !targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const pad = 16;
    const tooltipW = 380;
    const tooltipH = 220;

    switch (step.placement) {
      case "bottom":
        return {
          position: "absolute",
          top: targetRect.top + targetRect.height + pad,
          left: Math.max(pad, Math.min(targetRect.left + targetRect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - pad)),
        };
      case "top":
        return {
          position: "absolute",
          top: targetRect.top - tooltipH - pad,
          left: Math.max(pad, Math.min(targetRect.left + targetRect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - pad)),
        };
      case "right":
        return {
          position: "absolute",
          top: targetRect.top + targetRect.height / 2 - tooltipH / 2,
          left: targetRect.left + targetRect.width + pad,
        };
      case "left":
        return {
          position: "absolute",
          top: targetRect.top + targetRect.height / 2 - tooltipH / 2,
          left: targetRect.left - tooltipW - pad,
        };
      default:
        return {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-label="Tour do produto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={onSkip} />

      {/* Spotlight cutout */}
      {targetRect && !isCenter && (
        <div
          className="absolute rounded-xl transition-all duration-500 ease-out"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 30px 4px hsl(var(--primary) / 0.3)",
            border: "2px solid hsl(var(--primary) / 0.5)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="z-10 w-[380px] max-w-[calc(100vw-32px)]"
        style={getTooltipPosition()}
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-400">
          {/* Progress bar */}
          <div className="h-1 bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {currentStep + 1} de {steps.length}
                  </span>
                </div>
              </div>
              <button
                onClick={onSkip}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {step.content}
            </p>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? "w-6 bg-primary"
                      : i < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-secondary"
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Pular tour
              </button>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={onPrev} className="gap-1 h-8">
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Button>
                )}
                <Button size="sm" onClick={onNext} className="gap-1 h-8">
                  {currentStep === steps.length - 1 ? (
                    "Concluir 🎉"
                  ) : (
                    <>Próximo <ChevronRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
