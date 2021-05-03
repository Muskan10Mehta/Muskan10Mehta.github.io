import { useState, useRef, useCallback, useEffect, createElement, createContext, useContext, useMemo } from 'react';

var calculateTotalDuration = ({ duration = 0.3, delay = 0, overlay = 0, }) => duration + delay - overlay || 0;

var isUndefined = (val) => val === undefined;

function getSequenceId(sequenceIndex, sequenceId, defaultValue) {
    if (isUndefined(sequenceId) && isUndefined(sequenceIndex)) {
        return defaultValue || 0;
    }
    if (sequenceIndex && sequenceIndex >= 0) {
        return sequenceIndex;
    }
    if (sequenceId) {
        return sequenceId;
    }
    return 0;
}

const DEFAULT_DURATION = 0.3;
const DEFAULT_EASE_TYPE = 'linear';
const DEFAULT_DIRECTION = 'normal';
const DEFAULT_FILLMODE = 'none';
const RUNNING = 'running';
const ALL = 'all';

const AnimateContext = createContext({
    animationStates: {},
    register: (data) => { },
});
function AnimateGroup({ play, sequences = [], children, }) {
    const [animationStates, setAnimationStates] = useState({});
    const animationsRef = useRef({});
    const register = useCallback((data) => {
        const { sequenceIndex, sequenceId } = data;
        if (!isUndefined(sequenceId) || !isUndefined(sequenceIndex)) {
            animationsRef.current[getSequenceId(sequenceIndex, sequenceId)] = data;
        }
    }, []);
    useEffect(() => {
        const sequencesToAnimate = Array.isArray(sequences) && sequences.length
            ? sequences
            : Object.values(animationsRef.current);
        const localAnimationState = {};
        (play ? sequencesToAnimate : [...sequencesToAnimate].reverse()).reduce((previous, { sequenceId, sequenceIndex, duration = DEFAULT_DURATION, delay, overlay, }, currentIndex) => {
            const id = getSequenceId(sequenceIndex, sequenceId, currentIndex);
            const currentTotalDuration = calculateTotalDuration({
                duration,
                delay,
                overlay,
            });
            const totalDuration = currentTotalDuration + previous;
            localAnimationState[id] = {
                play,
                pause: !play,
                delay: currentIndex === 0
                    ? delay || 0
                    : delay
                        ? previous + delay
                        : previous,
                controlled: true,
            };
            return totalDuration;
        }, 0);
        setAnimationStates(localAnimationState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [play]);
    return (createElement(AnimateContext.Provider, { value: { animationStates, register } }, children));
}

var secToMs = (ms) => (ms || 0) * 1000;

function Animate(props) {
    const { play, children, render, start, end, complete = '', onComplete, delay = 0, duration = DEFAULT_DURATION, easeType = DEFAULT_EASE_TYPE, sequenceId, sequenceIndex, } = props;
    const onCompleteTimeRef = useRef();
    const [style, setStyle] = useState(start || {});
    const { register, animationStates = {} } = useContext(AnimateContext);
    const id = getSequenceId(sequenceIndex, sequenceId);
    useEffect(() => {
        if ((!isUndefined(sequenceIndex) && sequenceIndex >= 0) || sequenceId) {
            register(props);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const animationState = animationStates[id] || {};
        setStyle(Object.assign(Object.assign({}, (play || animationState.play ? end : start)), { transition: `${ALL} ${duration}s ${easeType} ${parseFloat(animationState.delay || delay)}s` }));
        if (play && (complete || onComplete)) {
            onCompleteTimeRef.current = setTimeout(() => {
                complete && setStyle(complete);
                onComplete && onComplete();
            }, secToMs(parseFloat(animationState.delay || delay) + duration));
        }
        return () => onCompleteTimeRef.current && clearTimeout(onCompleteTimeRef.current);
    }, [
        id,
        animationStates,
        play,
        duration,
        easeType,
        delay,
        onComplete,
        start,
        end,
        complete,
    ]);
    return render ? render({ style }) : createElement("div", { style: style }, children);
}

var camelCaseToDash = (camelCase) => camelCase ? camelCase.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`) : '';

const generateKeyframes = keyframes => {
    const animationLength = keyframes.length;
    return keyframes.reduce((previous, keyframe, currentIndex) => {
        const keyframePercentage = animationLength === 2
            ? currentIndex * 100
            : parseFloat((100 / (animationLength - 1)).toFixed(2)) * currentIndex;
        if (typeof keyframe === 'string') {
            return `${previous} ${keyframePercentage}% {${keyframe}}`;
        }
        const keys = Object.keys(keyframe);
        if (keys.length && isNaN(+keys[0])) {
            const keyframeContent = keys.reduce((acc, key) => `${acc} ${camelCaseToDash(key)}: ${keyframe[key]};`, '');
            return `${previous} ${keyframePercentage}% {${keyframeContent}}`;
        }
        return `${previous} ${Object.keys(keyframe)[0]}% {${Object.values(keyframe)[0]}}`;
    }, '');
};
function createStyle({ keyframes, animationName, }) {
    return `@keyframes ${animationName} {${generateKeyframes(keyframes)}}`;
}

function createTag({ keyframes, animationName, }) {
    let styleTag = document.querySelector('style[data-id=rsi]');
    let index;
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.setAttribute('data-id', 'rsi');
        document.head.appendChild(styleTag);
    }
    try {
        // @ts-ignore
        index = styleTag.sheet.cssRules.length;
    }
    catch (e) {
        index = 0;
    }
    try {
        // @ts-ignore
        styleTag.sheet.insertRule(createStyle({
            keyframes,
            animationName,
        }), index);
    }
    catch (e) {
        console.error('react simple animate, error found during insert style ', e); // eslint-disable-line no-console
    }
    return {
        styleTag,
        index,
    };
}

var deleteRules = (sheet, deleteName) => {
    const index = Object.values(sheet.cssRules).findIndex(({ name }) => name === deleteName);
    if (index >= 0) {
        sheet.deleteRule(index);
    }
};

var createRandomName = () => `RSI-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

var getPlayState = (pause) => (pause ? 'paused' : RUNNING);

function AnimateKeyframes(props) {
    const { children, play = false, pause = false, render, duration = DEFAULT_DURATION, delay = 0, easeType = DEFAULT_EASE_TYPE, direction = DEFAULT_DIRECTION, fillMode = DEFAULT_FILLMODE, iterationCount = 1, sequenceIndex, keyframes, sequenceId, } = props;
    let pauseValue;
    const animationNameRef = useRef({
        forward: '',
        reverse: '',
    });
    const controlled = useRef(false);
    const styleTagRef = useRef({
        forward: { sheet: {} },
        reverse: { sheet: {} },
    });
    const id = getSequenceId(sequenceIndex, sequenceId);
    const { register, animationStates = {} } = useContext(AnimateContext);
    const animateState = animationStates[id] || {};
    const [, forceUpdate] = useState(false);
    useEffect(() => {
        const styleTag = styleTagRef.current;
        const animationName = animationNameRef.current;
        animationNameRef.current.forward = createRandomName();
        let result = createTag({
            animationName: animationNameRef.current.forward,
            keyframes,
        });
        animationNameRef.current.reverse = createRandomName();
        styleTagRef.current.forward = result.styleTag;
        result = createTag({
            animationName: animationNameRef.current.reverse,
            keyframes: keyframes.reverse(),
        });
        styleTagRef.current.reverse = result.styleTag;
        register(props);
        if (play) {
            forceUpdate(true);
        }
        return () => {
            deleteRules(styleTag.forward.sheet, animationName.forward);
            deleteRules(styleTag.reverse.sheet, animationName.reverse);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (animateState.controlled && !controlled.current) {
        pauseValue = animateState.pause;
        if (!animateState.pause) {
            controlled.current = true;
        }
    }
    else {
        pauseValue = pause;
    }
    const style = {
        animation: `${duration}s ${easeType} ${animateState.delay || delay}s ${iterationCount} ${direction} ${fillMode} ${getPlayState(pauseValue)} ${((animateState.controlled ? animateState.play : play)
            ? animationNameRef.current.forward
            : animationNameRef.current.reverse) || ''}`,
    };
    return render ? render({ style }) : createElement("div", { style: style || {} }, children);
}

function useAnimate(props) {
    const { start, end, complete, onComplete, delay = 0, duration = DEFAULT_DURATION, easeType = DEFAULT_EASE_TYPE, } = props;
    const transition = useMemo(() => `${ALL} ${duration}s ${easeType} ${delay}s`, [duration, easeType, delay]);
    const [animate, setAnimate] = useState({
        isPlaying: false,
        style: Object.assign(Object.assign({}, start), { transition }),
    });
    const { isPlaying, style } = animate;
    const onCompleteTimeRef = useRef();
    useEffect(() => {
        if ((onCompleteTimeRef.current || complete) && isPlaying) {
            onCompleteTimeRef.current = setTimeout(() => {
                if (onComplete) {
                    onComplete();
                }
                if (complete) {
                    setAnimate(Object.assign(Object.assign({}, animate), { style: complete }));
                }
            }, secToMs(delay + duration));
        }
        return () => onCompleteTimeRef.current && clearTimeout(onCompleteTimeRef.current);
    }, [isPlaying]);
    return {
        isPlaying,
        style,
        play: useCallback((isPlaying) => {
            setAnimate(Object.assign(Object.assign({}, animate), { style: Object.assign(Object.assign({}, (isPlaying ? end : start)), { transition }), isPlaying }));
        }, []),
    };
}

function useAnimateKeyframes(props) {
    const { duration = DEFAULT_DURATION, delay = 0, easeType = DEFAULT_EASE_TYPE, direction = DEFAULT_DIRECTION, fillMode = DEFAULT_FILLMODE, iterationCount = 1, keyframes, } = props;
    const animationNameRef = useRef({
        forward: '',
        reverse: '',
    });
    const styleTagRef = useRef({
        forward: { sheet: {} },
        reverse: { sheet: {} },
    });
    const { register } = useContext(AnimateContext);
    const [isPlaying, setIsPlaying] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const playRef = useRef();
    useEffect(() => {
        const styleTag = styleTagRef.current;
        const animationName = animationNameRef.current;
        animationNameRef.current.forward = createRandomName();
        let result = createTag({
            animationName: animationNameRef.current.forward,
            keyframes,
        });
        styleTagRef.current.forward = result.styleTag;
        animationNameRef.current.reverse = createRandomName();
        result = createTag({
            animationName: animationNameRef.current.reverse,
            keyframes: keyframes.reverse(),
        });
        styleTagRef.current.reverse = result.styleTag;
        register(props);
        return () => {
            deleteRules(styleTag.forward.sheet, animationName.forward);
            deleteRules(styleTag.reverse.sheet, animationName.reverse);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    playRef.current = playRef.current
        ? playRef.current
        : (isPlay) => setIsPlaying(isPlay);
    const style = {
        animation: `${duration}s ${easeType} ${delay}s ${iterationCount} ${direction} ${fillMode} ${getPlayState(isPaused)} ${isPlaying === null
            ? ''
            : isPlaying
                ? animationNameRef.current.forward
                : animationNameRef.current.reverse}`,
    };
    return {
        style,
        play: playRef.current,
        pause: setIsPaused,
        isPlaying: !!isPlaying,
    };
}

function createArrayWithNumbers(length) {
    return Array.from({ length }, () => null);
}

function useAnimateGroup(props) {
    const { sequences = [] } = props;
    const defaultArray = createArrayWithNumbers(sequences.length).map((_, index) => props.sequences[index].start);
    const [styles, setStyles] = useState(defaultArray);
    const [isPlaying, setPlaying] = useState(false);
    const animationNamesRef = useRef([]);
    const styleTagRef = useRef([]);
    const playRef = useRef();
    useEffect(() => {
        sequences.forEach(({ keyframes = false }, i) => {
            if (!Array.isArray(keyframes)) {
                return;
            }
            if (!animationNamesRef.current[i]) {
                animationNamesRef.current[i] = {};
                styleTagRef.current[i] = {};
            }
            animationNamesRef.current[i].forward = createRandomName();
            let result = createTag({
                animationName: animationNamesRef.current[i].forward,
                keyframes,
            });
            styleTagRef.current[i].forward = result.styleTag;
            animationNamesRef.current[i].reverse = createRandomName();
            result = createTag({
                animationName: animationNamesRef.current[i].reverse,
                keyframes: keyframes.reverse(),
            });
            styleTagRef.current[i].reverse = result.styleTag;
        });
        return () => Object.values(animationNamesRef).forEach(({ forward, reverse }, i) => {
            if (!styleTagRef[i]) {
                return;
            }
            deleteRules(styleTagRef[i].sheet, forward);
            deleteRules(styleTagRef[i].sheet, reverse);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    playRef.current = playRef.current
        ? playRef.current
        : (isPlay) => {
            let totalDuration = 0;
            const animationRefWithOrder = isPlay
                ? animationNamesRef.current
                : [...animationNamesRef.current].reverse();
            const styles = (isPlay ? sequences : [...sequences].reverse()).map((current, currentIndex) => {
                const { duration = DEFAULT_DURATION, delay = 0, overlay, keyframes, iterationCount = 1, easeType = DEFAULT_EASE_TYPE, direction = DEFAULT_DIRECTION, fillMode = DEFAULT_FILLMODE, end = {}, start = {}, } = current;
                const delayDuration = currentIndex === 0 ? delay : totalDuration;
                const transition = `${ALL} ${duration}s ${easeType} ${delayDuration}s`;
                totalDuration =
                    calculateTotalDuration({ duration, delay, overlay }) +
                        totalDuration;
                return keyframes
                    ? {
                        animation: `${duration}s ${easeType} ${delayDuration}s ${iterationCount} ${direction} ${fillMode} ${RUNNING} ${isPlay
                            ? animationRefWithOrder[currentIndex].forward
                            : animationRefWithOrder[currentIndex].reverse}`,
                    }
                    : Object.assign(Object.assign({}, (isPlay ? end : start)), { transition });
            });
            setStyles(isPlay ? styles : [...styles].reverse());
            setPlaying(!isPlaying);
        };
    return { styles, play: playRef.current, isPlaying };
}

export { Animate, AnimateGroup, AnimateKeyframes, useAnimate, useAnimateGroup, useAnimateKeyframes };