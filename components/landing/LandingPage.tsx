import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import { ChalkCursor } from '../ui/ChalkCursor';



const WaterRippleFilter = () => (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
            <filter id="water-ripple-filter">
                {/* numOctaves 1 is smoother/glassier */}
                <feTurbulence type="fractalNoise" baseFrequency="0.0" numOctaves="1" result="warp" id="turbulence" />
                <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="warp" />
            </filter>
        </defs>
    </svg>
);

const WaterText = () => {
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const turbulence = document.getElementById('turbulence');
        let frame: number;
        let freq = 0.0;
        let targetFreq = 0.0;

        const animate = () => {
            const time = Date.now() / 1000;

            if (isHovered) {
                // Target base is 0.015, with slower oscillation for smoother effect
                const oscillation = Math.sin(time * 1.5) * 0.003;
                targetFreq = 0.015 + oscillation;
            } else {
                targetFreq = 0.0;
            }

            // LERP for smooth transition to the dancing state
            freq += (targetFreq - freq) * 0.05;

            // Stop animation only when very close to 0
            if (!isHovered && freq < 0.001) {
                freq = 0;
            }

            if (turbulence) {
                turbulence.setAttribute('baseFrequency', `0.0 ${freq}`);
            }

            if (freq > 0.001 || isHovered) {
                frame = requestAnimationFrame(animate);
            }
        };

        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [isHovered]);

    return (
        <div
            className="infinite-monolith"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ filter: 'url(#water-ripple-filter)', cursor: 'crosshair', transition: 'transform 0.5s ease' }}
        >
            <span className="monolith-cn">無限</span>
            <span className="monolith-en">INFINITE</span>
        </div>
    );
};

export default function LandingPage() {
    return (
        <div className="landing">
            <ChalkCursor />
            <WaterRippleFilter />

            <main className="yohji-container">

                {/* Header - Reorganized */}
                <header className="landing-header">
                    <div className="header-left">
                        <span className="brand-logo">设计无限生成器</span>
                    </div>
                    <div className="header-right">
                        <Link to="/login" className="nav-pill">登录</Link>
                    </div>
                </header>

                {/* Hero Layer */}
                <section className="hero-avant-garde">

                    {/* TOP - INFINITE (White) */}
                    <div className="position-top-center">
                        <WaterText />
                    </div>

                    {/* LEFT - DESIGN (Grey) */}
                    <div className="text-scatter position-mid-left">
                        <h1 className="title-serif text-grey">DESIGN <br /> <span className="cn-serif text-dark-grey">設計</span></h1>
                    </div>

                    {/* RIGHT - GENERATOR (Grey) */}
                    <div className="text-scatter position-mid-right">
                        <h1 className="title-serif align-right text-grey">GENERATOR <br /> <span className="cn-serif text-dark-grey">生成器</span></h1>
                    </div>

                    {/* Unconventional Signature Line: The Thread */}
                    <div className="signature-thread-container">
                        <svg className="signature-thread-svg" viewBox="0 0 20 400" preserveAspectRatio="none">
                            {/* Jagged, organic stitch line */}
                            <path d="M10,0 Q12,50 8,100 T10,200 Q14,250 6,300 T10,400"
                                fill="none" stroke="url(#thread-gradient)" strokeWidth="1.5" strokeDasharray="4, 8, 2, 12" />
                            <defs>
                                <linearGradient id="thread-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#444" stopOpacity="0" />
                                    <stop offset="20%" stopColor="#aaa" stopOpacity="0.5" />
                                    <stop offset="50%" stopColor="#fff" stopOpacity="1" />
                                    <stop offset="80%" stopColor="#aaa" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#444" stopOpacity="0.2" />
                                </linearGradient>
                            </defs>
                        </svg>
                        {/* A needle or knot at the end? */}
                        <div className="thread-knot"></div>
                    </div>
                </section>

                {/* Collection / CTA - The Signature */}
                <section className="collection-cta">
                    <Link to="/register" className="signature-cta">
                        <span className="sig-text">REGISTER / 注册</span>
                        <svg className="hover-scratch" viewBox="0 0 200 10" preserveAspectRatio="none">
                            <path d="M0,5 Q50,0 100,5 T200,5" stroke="currentColor" fill="none" strokeWidth="2" />
                        </svg>
                    </Link>
                </section>

                <footer className="yohji-footer">
                    <span>DESIGN INFINITE INC.</span>
                    <span>EST. 2024</span>
                </footer>
            </main>
        </div>
    );
}
