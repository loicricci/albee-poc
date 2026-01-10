"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const originalPositions = useRef<Float32Array | null>(null);
  const tempVector = useRef(new THREE.Vector3());

  // Generate particle positions on a sphere
  const particlesCount = 8000;
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 2.5;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    originalPositions.current = new Float32Array(pos);
    return pos;
  }, []);

  // Handle mouse movement for interactive effect
  useFrame((state) => {
    if (pointsRef.current && originalPositions.current) {
      // Gentle rotation
      pointsRef.current.rotation.y += 0.001;
      pointsRef.current.rotation.x += 0.0005;
      
      // Get mouse position from state
      const mouse = state.mouse;
      
      // Interactive displacement based on mouse
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const origPositions = originalPositions.current;
      
      for (let i = 0; i < particlesCount; i++) {
        const i3 = i * 3;
        
        // Get original position
        const x = origPositions[i3];
        const y = origPositions[i3 + 1];
        const z = origPositions[i3 + 2];
        
        // Project 3D position to 2D screen space
        tempVector.current.set(x, y, z);
        tempVector.current.applyMatrix4(pointsRef.current.matrixWorld);
        tempVector.current.project(state.camera);
        
        // Calculate distance from mouse
        const dx = tempVector.current.x - mouse.x;
        const dy = tempVector.current.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Much more pronounced displacement for visible hover effect
        if (distance < 0.8) {
          const force = (0.8 - distance) * 1.2; // Increased force
          const angle = Math.atan2(dy, dx);
          
          // Push particles away from mouse
          positions[i3] = origPositions[i3] + Math.cos(angle) * force;
          positions[i3 + 1] = origPositions[i3 + 1] + Math.sin(angle) * force;
          positions[i3 + 2] = origPositions[i3 + 2] + force * 0.5;
        } else {
          // Smoothly return to original position
          positions[i3] += (origPositions[i3] - positions[i3]) * 0.08;
          positions[i3 + 1] += (origPositions[i3 + 1] - positions[i3 + 1]) * 0.08;
          positions[i3 + 2] += (origPositions[i3 + 2] - positions[i3 + 2]) * 0.08;
        }
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color="#6B9BFF"
        sizeAttenuation
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleSphere() {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        className="w-full h-full"
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <Particles />
      </Canvas>
    </div>
  );
}

