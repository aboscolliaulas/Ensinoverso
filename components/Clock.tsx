
import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center select-none animate-desktop-in">
      <div className="text-[12rem] leading-none font-light text-white opacity-100 tracking-tighter text-shadow-strong">
        {hours}
      </div>
      <div className="text-[12rem] leading-none font-light text-orange-500 opacity-100 tracking-tighter -mt-12 text-shadow-strong">
        {minutes}
      </div>
      <div className="mt-4 text-white text-xl font-bold tracking-[0.5em] uppercase text-shadow-strong">
        Ensinoverso
      </div>
    </div>
  );
};

export default Clock;
