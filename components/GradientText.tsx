// components/GradientText.tsx
import React, { useState, useCallback } from 'react';

const GradientText = ({ text, className }: { text: string; className?: string }) => {
  const [mousePosition, setMousePosition] = useState({ x: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isHovering) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setMousePosition({ x });
  }, [isHovering]);

  const gradientStyle = {
    backgroundImage: `linear-gradient(90deg, #60A5FA ${mousePosition.x - 50}%, #8B5CF6 ${mousePosition.x + 50}%)`,
    backgroundSize: '100%',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    textShadow: '0 0 20px rgba(255, 255, 255, 0.1)',
    display: 'inline-block',
    fontWeight: 300,
    transition: 'all 300ms ease-in-out, background-image 0ms'
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="inline-block"
    >
      <h1 className={className} style={gradientStyle}>
        {text}
      </h1>
    </div>
  );
};

export default GradientText;
