import { memo, useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  duration?: number;
  formatter?: (value: number) => string;
  value: number;
}

/** §C.43*/
export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  duration = 500,
  formatter,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef(value);

  useEffect(() => {
    const startValue = startValueRef.current;
    const diff = value - startValue;
    if (diff === 0) return;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) startTimeRef.current = currentTime;
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - (1 - progress) ** 3;
      setDisplayValue(startValue + diff * easeProgress);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startValueRef.current = value;
        startTimeRef.current = undefined;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [duration, value]);

  return formatter ? formatter(displayValue) : Math.round(displayValue).toLocaleString();
});
