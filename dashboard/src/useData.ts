import { useEffect, useState } from "react";

export const REFRESH_MS = 2000;

/** Load data once, or keep it fresh by loading it again every two seconds. */
export function useData<T>(load: () => Promise<T>, refresh: boolean) {
  const [data, setData] = useState<T>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchData = () => {
      void load().then(
        (value) => {
          if (active) {
            setData(value);
            setFailed(false);
          }
        },
        () => {
          if (active) setFailed(true);
        },
      );
    };
    fetchData();
    const timer = refresh ? setInterval(fetchData, REFRESH_MS) : undefined;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, refresh]);

  return { data, failed, setData };
}
