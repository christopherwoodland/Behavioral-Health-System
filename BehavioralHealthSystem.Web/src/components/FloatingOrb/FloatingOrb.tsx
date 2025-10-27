import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './FloatingOrb.css';

interface FloatingOrbProps {
  isAgentSpeaking: boolean;
  agentId: string;
}

export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  isAgentSpeaking,
  agentId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const originalVerticesRef = useRef<THREE.BufferAttribute | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const isAgentSpeakingRef = useRef(isAgentSpeaking);

  const getAgentColor = (id: string): number => {
    switch (id) {
      case 'tars': return 0x4a90e2;
      case 'matron': return 0xe24a90;
      case 'jekyll': return 0x0891b2; // teal
      default: return 0x4a90e2;
    }
  };

  // Keep ref in sync with prop
  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking;
    console.log('🎬 FloatingOrb prop updated: isAgentSpeaking =', isAgentSpeaking);
  }, [isAgentSpeaking]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Use different geometry based on agent
    let ballGeometry: THREE.BufferGeometry;
    if (agentId === 'jekyll') {
      // Create upside-down pyramid/triangle for Jekyll
      // Using cone geometry with point facing down
      console.log('🔺 Creating PYRAMID geometry for Jekyll agent');
      ballGeometry = new THREE.ConeGeometry(7, 14, 32, 6);
      // Rotate so point faces down
      ballGeometry.rotateX(Math.PI);
    } else {
      // Default sphere for other agents
      console.log('⚪ Creating SPHERE geometry for agent:', agentId);
      ballGeometry = new THREE.IcosahedronGeometry(7, 6);
    }

    const ballColor = getAgentColor(agentId);
    const ballMaterial = new THREE.MeshLambertMaterial({
      color: ballColor,
      wireframe: true,
      emissive: ballColor,
      emissiveIntensity: 0.3
    });

    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0, 0);
    group.add(ball);
    ballRef.current = ball;

    const positionAttribute = ballGeometry.getAttribute('position');
    if (positionAttribute) {
      originalVerticesRef.current = positionAttribute.clone();
    }

    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.8);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 0.9);
    spotLight.position.set(-10, 40, 20);
    spotLight.castShadow = true;
    scene.add(spotLight);

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    const animState = {
      targetAmplitude: 0,
      currentAmplitude: 0,
      lastSpeakingTime: 0,
      holdDuration: 5000, // Hold animation for 5 seconds after last speaking event
      randomSeed: Math.random() * 1000 // Different seed per component instance
    };

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.016;

      // Use ref to get current speaking state (not captured in closure)
      const isSpeaking = isAgentSpeakingRef.current;

      // Debug: Log when state changes
      if (isSpeaking && animState.currentAmplitude === 0) {
        console.log('🎤 ANIMATION TRIGGERED: Agent started speaking');
      }

      if (isSpeaking) {
        animState.targetAmplitude = 20; // Increased for more dramatic deformation
        animState.lastSpeakingTime = Date.now(); // Update last speaking time whenever agent is actively speaking
      } else {
        // Check if we should still be animating (within hold duration)
        const timeSinceLastSpeak = Date.now() - animState.lastSpeakingTime;

        if (timeSinceLastSpeak < animState.holdDuration) {
          // Keep animating even though isAISpeaking is false
          animState.targetAmplitude = 12;
        } else {
          // Beyond hold duration, start decay
          animState.targetAmplitude = 0;
        }
      }

      // Always smooth interpolation for natural ramp - faster response
      animState.currentAmplitude +=
        (animState.targetAmplitude - animState.currentAmplitude) * 0.25;

      // Log amplitude every 30 frames (about once per second at 60fps)
      if (timeRef.current % 30 < 0.016 && !isSpeaking && animState.currentAmplitude > 0.1) {
        const timeSinceLastSpeak = Date.now() - animState.lastSpeakingTime;
        console.log(`📊 AMPLITUDE: ${animState.currentAmplitude.toFixed(2)}, Time since last speak: ${timeSinceLastSpeak}ms, Target: ${animState.targetAmplitude}`);
      }

      if (ballRef.current && originalVerticesRef.current) {
        const posAttr = ballRef.current.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const origAttr = originalVerticesRef.current;

        for (let i = 0; i < posAttr.count; i++) {
          const x = origAttr.getX(i);
          const y = origAttr.getY(i);
          const z = origAttr.getZ(i);

          const length = Math.sqrt(x * x + y * y + z * z);

          const time = timeRef.current;

          // Simulate bass and treble with frequency-like modulation
          // Bass: slower, dominant frequencies
          const bass = Math.sin(time * 1.2 + animState.randomSeed) * 0.4 +
                       Math.sin(time * 0.8 - animState.randomSeed) * 0.3;

          // Treble: faster, higher frequencies
          const treble = Math.sin(time * 4.5 + i * 0.2) * 0.3 +
                         Math.cos(time * 7.2 - i * 0.1) * 0.2 +
                         Math.sin(time * 11.8 + i * 0.3) * 0.15;

          // Rich noise layer inspired by Simplex noise pattern
          const noise =
            Math.sin(time * 2 + i * 0.1) * 0.6 +
            Math.cos(time * 3.5 + i * 0.2) * 0.4 +
            Math.sin(time * 5.2 - i * 0.15) * 0.3 +
            Math.cos(time * 8.1 + i * 0.05) * 0.2 +
            Math.sin(time * 13.3 - i * 0.25) * 0.15;

          // Combine bass and treble with amplitude
          const totalDeformation = (bass * 0.5 + treble * 0.5 + noise * 0.3) * animState.currentAmplitude;
          const deformation = animState.currentAmplitude * (0.5 + 0.5 * totalDeformation);

          const newX = (x / length) * (length + deformation);
          const newY = (y / length) * (length + deformation);
          const newZ = (z / length) * (length + deformation);

          posAttr.setXYZ(i, newX, newY, newZ);
        }

        posAttr.needsUpdate = true;
        ballRef.current.geometry.computeVertexNormals();

        if (ballRef.current.material instanceof THREE.MeshLambertMaterial) {
          if (isSpeaking) {
            const brightColor = new THREE.Color(ballColor);
            brightColor.multiplyScalar(1.5);
            ballRef.current.material.color = brightColor;
            ballRef.current.material.emissiveIntensity = 0.6;
          } else {
            ballRef.current.material.color.setHex(ballColor);
            ballRef.current.material.emissiveIntensity = 0.3;
          }
        }
      }

      if (groupRef.current) {
        groupRef.current.rotation.x += 0.0005;
        groupRef.current.rotation.y += 0.001;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      ballGeometry.dispose();
      ballMaterial.dispose();
    };
  }, [agentId, isAgentSpeaking]);

  return (
    <div className="floating-orb-container" ref={containerRef} data-agent={agentId} />
  );
};

export default FloatingOrb;
