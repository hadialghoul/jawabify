import Svg, { Circle, Rect } from 'react-native-svg';

export function InstagramIcon({ size = 14, color = '#EE2A7B' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={2} />
      <Circle cx="17.2" cy="6.8" r="1.2" fill={color} />
    </Svg>
  );
}
