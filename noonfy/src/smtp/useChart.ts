import { useEffect, useRef } from 'react';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Filler, LinearScale,
  LineController, LineElement, PointElement, Tooltip, type ChartConfiguration, type ChartType,
} from 'chart.js';

// Only what the SMTP screen's bar, doughnut and line charts need.
Chart.register(BarController, BarElement, DoughnutController, ArcElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);
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
