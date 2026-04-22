import React, { useEffect, useRef, useState } from 'react';

export interface Packet {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  progress: number;
  status: 'traveling' | 'arrived' | 'failed';
  color: string;
}

export interface PacketAnimationProps {
  packets: Packet[];
  onAnimationComplete?: (packetId: string) => void;
}

export const PacketAnimation: React.FC<PacketAnimationProps> = ({
  packets,
  onAnimationComplete
}) => {
  const [animatedPackets, setAnimatedPackets] = useState<Packet[]>(() => []);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setAnimatedPackets(packets.map(p => ({ ...p, progress: 0, status: 'traveling' as const })));
  }, [packets]);

  useEffect(() => {
    const animate = () => {
      setAnimatedPackets(prev => {
        let updated = false;
        const newPackets = prev.map(packet => {
          if (packet.status !== 'traveling') return packet;

          const newProgress = packet.progress + 0.02; // Animation speed
          if (newProgress >= 1) {
            if (onAnimationComplete) {
              onAnimationComplete(packet.id);
            }
            updated = true;
            return { ...packet, progress: 1, status: 'arrived' as const };
          }
          updated = true;
          return { ...packet, progress: newProgress };
        });

        if (updated) {
          return newPackets;
        }
        return prev;
      });
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onAnimationComplete]);

  return (
    <g>
      {animatedPackets.map(packet => (
        <circle
          key={packet.id}
          r={6}
          fill={packet.color}
          opacity={packet.status === 'arrived' ? 0 : 1}
          style={{
            filter: 'drop-shadow(0 0 4px ' + packet.color + ')'
          }}
        >
          <animate
            attributeName="r"
            values="4;6;4"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
};

/**
 * Hook to manage packet animation lifecycle
 */
export function usePacketAnimation() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = (nodePath: string[], color: string = '#3b82f6') => {
    const newPackets: Packet[] = [];
    
    for (let i = 0; i < nodePath.length - 1; i++) {
      newPackets.push({
        id: `packet-${Date.now()}-${i}`,
        fromNodeId: nodePath[i],
        toNodeId: nodePath[i + 1],
        progress: 0,
        status: 'traveling',
        color
      });
    }
    
    setPackets(newPackets);
    setIsAnimating(true);
  };

  const stopAnimation = () => {
    setPackets([]);
    setIsAnimating(false);
  };

  const handlePacketComplete = (packetId: string) => {
    setPackets(prev => {
      const packet = prev.find(p => p.id === packetId);
      if (!packet) return prev;

      const completed = prev.every(p => p.status === 'arrived');
      if (completed) {
        setIsAnimating(false);
      }

      return prev;
    });
  };

  return {
    packets,
    isAnimating,
    startAnimation,
    stopAnimation,
    handlePacketComplete
  };
}
