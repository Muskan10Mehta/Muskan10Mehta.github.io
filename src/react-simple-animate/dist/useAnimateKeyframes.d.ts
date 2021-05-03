import { AnimateKeyframesProps, Style } from './types';
export default function useAnimateKeyframes(props: AnimateKeyframesProps): {
    style: Style;
    play: (boolean: any) => void;
    pause: (boolean: any) => void;
    isPlaying: boolean;
};