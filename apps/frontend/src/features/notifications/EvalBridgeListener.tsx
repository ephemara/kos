import { useEffect, useRef } from 'react';
import { pushPerfHudEntry } from '@/lib/stores/perfHudStore';
import { sharedMeshBridge } from '@/services/raycastClient';

export function EvalBridgeListener() {
    const lastSignatureRef = useRef<string>('');

    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            const started = performance.now();
            const info = await sharedMeshBridge.getInfo();
            if (cancelled) return;

            const readyCount = info.filter((item) => item.bridge_ready).length;
            const totalPositionBytes = info.reduce((sum, item) => sum + item.bridge_position_bytes, 0);
            const totalNormalBytes = info.reduce((sum, item) => sum + item.bridge_normal_bytes, 0);
            const totalIndexBytes = info.reduce((sum, item) => sum + item.bridge_index_bytes, 0);
            const signature = `${info.length}:${readyCount}:${totalPositionBytes}:${totalNormalBytes}:${totalIndexBytes}`;

            if (signature !== lastSignatureRef.current) {
                lastSignatureRef.current = signature;
                pushPerfHudEntry({
                    at: Date.now(),
                    cmd: 'eval-bridge/shared-meshes',
                    invoke_ms: performance.now() - started,
                    payload_bytes: totalPositionBytes + totalNormalBytes + totalIndexBytes,
                    note: `meshes=${info.length} ready=${readyCount}`,
                });
            }
        };

        void tick();
        const interval = window.setInterval(() => {
            void tick();
        }, 1500);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    return null;
}

export default EvalBridgeListener;
