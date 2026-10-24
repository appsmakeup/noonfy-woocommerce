import { useEffect, useRef } from 'react';
import { Chart, registerables, type ChartConfiguration, type ChartType } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'Manrope',sans-serif";
Chart.defaults.color = '#A5A8BD';

/** Mounts a Chart.js chart on the returned canvas ref; the config is built once per mount. */
export function useChart<T extends ChartType>(makeConfig: () => ChartConfiguration<T>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const make = useRef(makeConfig);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, make.current());
    return () => chart.destroy();
  }, []);
  return ref;
}
