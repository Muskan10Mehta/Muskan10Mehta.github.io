import { AnimationProps, Style } from './types';
export default function useAnimate(props: AnimationProps): {
    isPlaying: boolean;
    style: Style;
    play: (boolean: any) => void;
};