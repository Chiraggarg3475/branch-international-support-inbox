import { useState, useEffect, useCallback } from 'react';

export function useResizable(
    initialLeftWidth: number,
    initialRightWidth: number,
    minLeft: number = 260,
    minRight: number = 280,
    maxLeft: number = 400,
    maxRight: number = 400
) {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const [rightWidth, setRightWidth] = useState(initialRightWidth);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);

    const startResizingLeft = useCallback(() => setIsResizingLeft(true), []);
    const startResizingRight = useCallback(() => setIsResizingRight(true), []);
    const stopResizing = useCallback(() => {
        setIsResizingLeft(false);
        setIsResizingRight(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizingLeft) {
                const newWidth = e.clientX;
                if (newWidth >= minLeft && newWidth <= maxLeft) {
                    setLeftWidth(newWidth);
                }
            } else if (isResizingRight) {
                // Right panel width is windowWidth - mouseX
                // But typically simpler: 
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= minRight && newWidth <= maxRight) {
                    setRightWidth(newWidth);
                }
            }
        },
        [isResizingLeft, isResizingRight, minLeft, maxLeft, minRight, maxRight]
    );

    useEffect(() => {
        if (isResizingLeft || isResizingRight) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'auto';
            document.body.style.userSelect = 'auto';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizingLeft, isResizingRight, resize, stopResizing]);

    return {
        leftWidth,
        rightWidth,
        startResizingLeft,
        startResizingRight,
        isResizingLeft,
        isResizingRight
    };
}
