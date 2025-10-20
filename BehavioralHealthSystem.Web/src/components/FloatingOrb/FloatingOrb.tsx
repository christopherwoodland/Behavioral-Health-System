import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './FloatingOrb.css';

interface FloatingOrbProps {
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  agentId: string;
}

/**
 * FloatingOrb Component - Now a 2D Sine Wave Visualization
 * Renders an animated sine wave viewed from the side (X plane)
 * Wave amplitude and frequency increase when agent speaks
 */
export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  isAgentSpeaking,
  isUserSpeaking,
  agentId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const waveLineRef = useRef<THREE.Line | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Get agent-specific color
  const getAgentColor = (id: string): THREE.Color => {
    switch (id) {
      case 'tars':
        return new THREE.Color(0x4a90e2); // Blue
      case 'matron':
        return new THREE.Color(0xe24a90); // Pink/Magenta
      case 'phq2':
        return new THREE.Color(0x4ae2e2); // Cyan
      case 'phq9':
        return new THREE.Color(0xa24ae2); // Purple
      case 'vocalist':
        return new THREE.Color(0xe2a24a); // Orange
      default:
        return new THREE.Color(0x4a90e2); // Default blue
    }
  };

  // Initialize Three.js scene with 2D sine wave
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - orthographic for 2D view
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.OrthographicCamera(
      -width / 200,
      width / 200,
      height / 200,
      -height / 200,
      0.1,
      1000
    );
    camera.position.z = 1;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create sine wave curve
    const resolution = 512; // High resolution for smooth curve
    const waveLength = 4; // Wave wavelength
    const amplitude = 1; // Base amplitude

    const baseColor = getAgentColor(agentId);

    // Function to generate AM-modulated sine wave points (radio frequency effect)
    const generateWavePoints = (
      amp: number,
      freq: number,
      phase: number,
      modulationDepth: number,
      modulationPhase: number
    ) => {
      const pts: THREE.Vector3[] = [];
      // Carrier frequency (high frequency wave)
      const carrierFreq = freq;
      // Modulation frequency (slower, creates the "speech" effect)
      const modulationFreq = 2.5;

      for (let i = 0; i <= resolution; i++) {
        const x = (i / resolution) * waveLength - waveLength / 2;

        // AM: Amplitude Modulation formula
        // y = [A + D*sin(ωm*t)] * sin(ωc*t + φ)
        // Where:
        // A = base amplitude
        // D = modulation depth (0 to 1)
        // ωm = modulation frequency (slow)
        // ωc = carrier frequency (fast)
        // φ = phase

        // Calculate modulation envelope (slower oscillation)
        const modulation = 1 + modulationDepth * Math.sin(x * modulationFreq + modulationPhase);

        // Calculate carrier wave (fast oscillation)
        const carrier = Math.sin(x * carrierFreq + phase);

        // Apply AM modulation
        const y = modulation * carrier * amp;

        pts.push(new THREE.Vector3(x, y, 0));
      }
      return pts;
    };

    // Initial wave points
    let currentWavePoints = generateWavePoints(
      amplitude,
      Math.PI * 2,
      0,
      0.3,
      0
    );

    // Create line geometry with initial points
    const geometry = new THREE.BufferGeometry().setFromPoints(currentWavePoints);
    const material = new THREE.LineBasicMaterial({
      color: baseColor,
      linewidth: 3,
      fog: false
    });

    const waveLine = new THREE.Line(geometry, material);
    scene.add(waveLine);
    waveLineRef.current = waveLine;

    // Store shader-like uniforms for wave calculation
    const waveParams = {
      amplitude: amplitude,
      frequency: Math.PI * 2,
      phase: 0,
      modulationDepth: 0.3, // How much the modulation affects amplitude (0-1)
      modulationPhase: 0,
      targetAmplitude: amplitude,
      targetFrequency: Math.PI * 2,
      targetModulationDepth: 0.3,
      speedIntensity: 1.0,
      targetSpeedIntensity: 1.0
    };

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.left = -newWidth / 200;
      camera.right = newWidth / 200;
      camera.top = newHeight / 200;
      camera.bottom = -newHeight / 200;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.016; // ~60fps

      if (waveLineRef.current) {
        // Update target amplitude and frequency based on speaking state
        if (isAgentSpeaking) {
          waveParams.targetAmplitude = amplitude * 2.0; // Stronger modulation carrier
          waveParams.targetFrequency = Math.PI * 2 * 1.5; // Moderate carrier frequency
          waveParams.targetModulationDepth = 0.85; // Deep modulation when speaking (AM effect)
          waveParams.targetSpeedIntensity = 2.0;
        } else if (isUserSpeaking) {
          waveParams.targetAmplitude = amplitude * 1.3;
          waveParams.targetFrequency = Math.PI * 2 * 1.2;
          waveParams.targetModulationDepth = 0.5;
          waveParams.targetSpeedIntensity = 1.3;
        } else {
          waveParams.targetAmplitude = amplitude;
          waveParams.targetFrequency = Math.PI * 2;
          waveParams.targetModulationDepth = 0.2; // Subtle modulation when idle
          waveParams.targetSpeedIntensity = 1.0;
        }

        // Smooth interpolation to target values
        waveParams.amplitude += (waveParams.targetAmplitude - waveParams.amplitude) * 0.08;
        waveParams.frequency += (waveParams.targetFrequency - waveParams.frequency) * 0.08;
        waveParams.modulationDepth +=
          (waveParams.targetModulationDepth - waveParams.modulationDepth) * 0.1;
        waveParams.speedIntensity +=
          (waveParams.targetSpeedIntensity - waveParams.speedIntensity) * 0.08;

        // Update phase based on speed intensity
        waveParams.phase += 0.05 * waveParams.speedIntensity;

        // Update modulation phase (creates the "breathing" effect)
        waveParams.modulationPhase += 0.02 * waveParams.speedIntensity;

        // Generate new wave points with current parameters
        const newPoints = generateWavePoints(
          waveParams.amplitude,
          waveParams.frequency,
          waveParams.phase,
          waveParams.modulationDepth,
          waveParams.modulationPhase
        );

        // Update geometry with new points
        const positionAttribute = waveLineRef.current.geometry.getAttribute('position');
        if (positionAttribute instanceof THREE.BufferAttribute) {
          for (let i = 0; i < newPoints.length; i++) {
            positionAttribute.setXYZ(i, newPoints[i].x, newPoints[i].y, newPoints[i].z);
          }
          positionAttribute.needsUpdate = true;
        }

        // Update line color based on agent
        if (waveLineRef.current.material instanceof THREE.LineBasicMaterial) {
          waveLineRef.current.material.color = getAgentColor(agentId);

          // Brighten color when speaking
          if (isAgentSpeaking) {
            const brightFactor = 1.5;
            const color = getAgentColor(agentId);
            waveLineRef.current.material.color.r = Math.min(1, color.r * brightFactor);
            waveLineRef.current.material.color.g = Math.min(1, color.g * brightFactor);
            waveLineRef.current.material.color.b = Math.min(1, color.b * brightFactor);
          }

          // Increase line width based on speaking
          waveLineRef.current.material.linewidth = 3 + waveParams.speedIntensity * 2;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [agentId]);

  return (
    <div className="floating-orb-container" ref={containerRef} data-agent={agentId} />
  );
};

export default FloatingOrb;
