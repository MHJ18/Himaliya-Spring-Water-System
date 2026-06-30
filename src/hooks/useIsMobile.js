import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(breakpoint = MOBILE_QUERY) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(breakpoint).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(breakpoint);
    const onChange = (event) => setIsMobile(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
