import { HookSequences, Style } from './types';
interface Props {
    sequences: HookSequences;
}
export default function useAnimateGroup(props: Props): {
    styles: (Style | null)[];
    play: (boolean: any) => void;
    isPlaying: boolean;
};
export {};