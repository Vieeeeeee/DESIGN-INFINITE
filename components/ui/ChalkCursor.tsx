import React, { useEffect, useState } from 'react';
import './ChalkCursor.css';

export const ChalkCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
            const target = e.target as HTMLElement;
            const isClickable = target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a') || target.closest('button') || target.tagName === 'INPUT';
            setIsHovering(!!isClickable);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div
            className={`cursor-chalk ${isHovering ? 'cursor-active' : ''}`}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {/* Rough SVG Circle mimicking chalk */}
            <svg width="60" height="60" viewBox="0 0 100 100" className="chalk-svg">
                <path d="M50,10 C70,10 90,30 90,50 C90,75 70,90 50,90 C30,90 10,70 10,50 C10,30 35,10 50,10"
                    fill="none" stroke="white" strokeWidth="2" strokeDasharray="5,5" strokeLinecap="round" />
            </svg>
        </div>
    );
};
